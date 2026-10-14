import onlineChatEngine from './OnlineChatEngine.js';
import ollamaChatEngine from './OllamaChatEngine.js';
import contextRetrievalService from './contextRetrievalService.js';
import { apiPost, apiGet } from '../api.js';

const STORAGE_KEY = 'edunix_ai_mode';

export class ChatEngineManager {
  constructor() {
    this.onlineEngine = onlineChatEngine;
    this.ollamaEngine = ollamaChatEngine;
    this.activeMode = this._loadSavedMode();
    this.activeController = null;
  }

  _normalizeMode(mode) {
    if (!mode) return 'auto';
    const m = String(mode).toLowerCase().trim();
    if (m === 'agentic' || m === 'n8n' || m === 'agent') return 'agentic';
    if (m === 'offline' || m === 'local' || m === 'ollama') return 'local';
    if (m === 'online' || m === 'gemini') return 'gemini';
    return 'auto';
  }

  _loadSavedMode() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return this._normalizeMode(saved);
      }
    } catch {
      // LocalStorage unavailable
    }
    return 'auto';
  }

  getMode() {
    return this.activeMode;
  }

  setMode(mode) {
    const normalized = this._normalizeMode(mode);
    this.activeMode = normalized;
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // ignore storage errors
    }
  }

  /**
   * Check status of services
   */
  async checkStatus() {
    try {
      const res = await apiGet('/chat/status');
      return (
        res?.data || {
          n8n: { available: false },
          gemini: { available: false },
          online: { available: false },
          offline: { available: false },
          ollama: { available: false },
          autoAvailable: false,
        }
      );
    } catch (err) {
      return {
        n8n: { available: false, message: err.message },
        gemini: { available: false, message: err.message },
        online: { available: false, message: err.message },
        offline: { available: false, message: err.message },
        ollama: { available: false, message: err.message },
        autoAvailable: false,
      };
    }
  }

  /**
   * Send messages through the manager with local context injection and provider routing
   */
  async sendMessage(messages, options = {}) {
    const { conversationId, userId = 'local-user' } = options;

    // 1. Retrieve local context from IndexedDB
    let systemPrompt = '';
    let learnerContext = {};
    try {
      const contextPackage = await contextRetrievalService.assembleContext({
        userId,
        conversationId,
        currentMessages: messages,
      });
      learnerContext = contextPackage;
      systemPrompt = contextRetrievalService.buildSystemPrompt(contextPackage);
    } catch (ctxErr) {
      console.warn('[ChatEngineManager] Context assembly warning:', ctxErr.message);
    }

    const sanitizedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 2. Check offline connectivity hint
    const isBrowserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

    // Dedicated Agentic AI mode requires online connection (never falls back to Ollama in dedicated test mode)
    if (this.activeMode === 'agentic' && isBrowserOffline) {
      throw new Error('Device is offline. Dedicated Agentic AI requires an active internet connection.');
    }

    // If completely offline in browser, route directly to local Ollama
    if (isBrowserOffline) {
      console.info('[ChatEngineManager] Browser offline (navigator.onLine = false). Routing to Local Ollama.');
      return await this._callLocalOllamaDirectly(
        sanitizedMessages,
        systemPrompt,
        conversationId,
        this.activeMode === 'auto'
          ? 'Device is offline. Responding via Local AI (Ollama).'
          : this.activeMode === 'gemini'
          ? 'Device is offline. Gemini unavailable, responding via Local AI (Ollama).'
          : null
      );
    }

    const payload = {
      messages: sanitizedMessages,
      mode: this.activeMode,
      conversationId,
      systemPrompt,
      learnerContext,
      userId,
    };

    try {
      const res = await apiPost('/chat/message', payload);
      const data = res?.data;

      const providerLabel =
        data.providerLabel ||
        (data.engine === 'n8n'
          ? (this.activeMode === 'agentic' ? 'Dedicated Agentic AI (n8n)' : 'n8n Agentic AI')
          : data.engine === 'ollama'
          ? 'Local AI · Ollama'
          : 'Gemini AI');

      return {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        conversationId,
        role: 'assistant',
        content: data.content,
        engine: data.engine,
        provider: data.provider || data.engine,
        providerLabel,
        model: data.model,
        fallback: Boolean(data.fallback),
        fallbackNotice: data.fallbackNotice || null,
        mode: data.mode,
        intent: data.intent,
        nextAction: data.nextAction,
        createdAt: new Date().toISOString(),
      };
    } catch (backendError) {
      // In dedicated Agentic AI mode, propagate the direct error for accurate testing
      if (this.activeMode === 'agentic') {
        console.error('[ChatEngineManager] Dedicated Agentic AI test error:', backendError);
        throw backendError;
      }

      console.warn(
        '[ChatEngineManager] Backend API failed or unreachable. Attempting direct local Ollama inference...',
        backendError.message
      );

      // Attempt direct local Ollama execution
      try {
        const notice =
          this.activeMode === 'auto'
            ? 'n8n Agentic AI server unavailable. Responding via Local AI (Ollama).'
            : this.activeMode === 'gemini'
            ? 'Gemini service unreachable. Responding via Local AI (Ollama).'
            : null;

        return await this._callLocalOllamaDirectly(sanitizedMessages, systemPrompt, conversationId, notice);
      } catch (ollamaErr) {
        throw new Error(
          `Unable to generate AI response. Backend: ${backendError.message} | Local Ollama: ${ollamaErr.message}`
        );
      }
    }
  }

  /**
   * Direct browser-to-Ollama inference when backend server is completely offline
   */
  async _callLocalOllamaDirectly(messages, systemPrompt, conversationId, customNotice = null) {
    const payloadMessages = [];
    if (systemPrompt) {
      payloadMessages.push({ role: 'system', content: systemPrompt });
    }
    payloadMessages.push(...messages);

    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:1b',
        messages: payloadMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Local Ollama service HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      conversationId,
      role: 'assistant',
      content: data.message?.content?.trim() || '',
      engine: 'ollama',
      provider: 'ollama',
      providerLabel: 'Local AI (Ollama)',
      model: 'llama3.2:1b',
      fallback: Boolean(customNotice),
      fallbackNotice: customNotice || (this.activeMode !== 'local' ? 'Offline fallback: generated via local Ollama.' : null),
      mode: this.activeMode,
      createdAt: new Date().toISOString(),
    };
  }

  cancelActiveRequest() {
    this.onlineEngine.cancelRequest();
    this.ollamaEngine.cancelRequest();
  }
}

export default new ChatEngineManager();
