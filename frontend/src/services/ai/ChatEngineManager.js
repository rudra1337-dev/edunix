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

  _loadSavedMode() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (['auto', 'online', 'offline'].includes(saved)) {
        return saved;
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
    if (!['auto', 'online', 'offline'].includes(mode)) return;
    this.activeMode = mode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
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
      return res?.data || { online: { available: false }, offline: { available: false } };
    } catch (err) {
      return {
        online: { available: false, message: err.message },
        offline: { available: false, message: err.message },
        autoAvailable: false,
      };
    }
  }

  /**
   * Send messages through the manager with local context injection
   */
  async sendMessage(messages, options = {}) {
    const { conversationId, userId = 'local-user' } = options;

    // 1. Retrieve local context from IndexedDB
    let systemPrompt = '';
    try {
      const contextPackage = await contextRetrievalService.assembleContext({
        userId,
        conversationId,
        currentMessages: messages,
      });
      systemPrompt = contextRetrievalService.buildSystemPrompt(contextPackage);
    } catch (ctxErr) {
      console.warn('[ChatEngineManager] Context assembly warning:', ctxErr.message);
    }

    const sanitizedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const payload = {
      messages: sanitizedMessages,
      mode: this.activeMode,
      conversationId,
      systemPrompt,
    };

    try {
      const res = await apiPost('/chat/message', payload);
      const data = res?.data;

      return {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        conversationId,
        role: 'assistant',
        content: data.content,
        engine: data.engine,
        model: data.model,
        fallback: Boolean(data.fallback),
        fallbackNotice: data.fallbackNotice || null,
        mode: data.mode,
        createdAt: new Date().toISOString(),
      };
    } catch (backendError) {
      console.warn(
        '[ChatEngineManager] Backend API unreachable. Attempting direct local Ollama inference...',
        backendError.message
      );

      // If in online mode, do not silently fallback to Ollama per strict isolation rule
      if (this.activeMode === 'online') {
        throw backendError;
      }

      // Offline or Auto mode: attempt direct local Ollama execution
      try {
        return await this._callLocalOllamaDirectly(sanitizedMessages, systemPrompt, conversationId);
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
  async _callLocalOllamaDirectly(messages, systemPrompt, conversationId) {
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
      model: 'llama3.2:1b',
      fallback: true,
      fallbackNotice: 'Offline mode: generated directly via local Ollama.',
      mode: 'offline',
      createdAt: new Date().toISOString(),
    };
  }

  cancelActiveRequest() {
    this.onlineEngine.cancelRequest();
    this.ollamaEngine.cancelRequest();
  }
}

export default new ChatEngineManager();
