import onlineChatEngine from './OnlineChatEngine';
import ollamaChatEngine from './OllamaChatEngine';
import { apiPost, apiGet } from '../api';

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
   * Send messages through the manager
   */
  async sendMessage(messages, options = {}) {
    const { conversationId } = options;

    const payload = {
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      mode: this.activeMode,
      conversationId,
    };

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
  }

  cancelActiveRequest() {
    this.onlineEngine.cancelRequest();
    this.ollamaEngine.cancelRequest();
  }
}

export default new ChatEngineManager();
