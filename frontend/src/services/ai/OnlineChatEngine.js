import { LearningChatEngine } from './ChatEngineInterface';
import { apiPost, apiGet } from '../api';

export class OnlineChatEngine extends LearningChatEngine {
  constructor() {
    super('online');
    this.abortController = null;
  }

  async checkAvailability() {
    try {
      const res = await apiGet('/chat/status');
      return res?.data?.online || { available: false, message: 'Status unavailable' };
    } catch (err) {
      return { available: false, message: err.message };
    }
  }

  async sendMessage(messages, options = {}) {
    this.abortController = new AbortController();
    try {
      const payload = {
        messages,
        mode: 'online',
        conversationId: options.conversationId,
      };

      const res = await apiPost('/chat/message', payload);
      return res.data;
    } finally {
      this.abortController = null;
    }
  }

  cancelRequest() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

export default new OnlineChatEngine();
