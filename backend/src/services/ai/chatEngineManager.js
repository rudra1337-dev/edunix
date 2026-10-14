import onlineEngine from './onlineEngine.js';
import ollamaEngine from './ollamaEngine.js';

export class ChatEngineManager {
  constructor() {
    this.onlineEngine = onlineEngine;
    this.ollamaEngine = ollamaEngine;
    this.maxContextMessages = 15;
  }

  /**
   * Check status of both online and offline AI services
   */
  async getStatus() {
    const [onlineStatus, offlineStatus] = await Promise.all([
      this.onlineEngine.checkAvailability().catch((err) => ({
        available: false,
        message: err.message,
      })),
      this.ollamaEngine.checkAvailability().catch((err) => ({
        available: false,
        message: err.message,
      })),
    ]);

    return {
      online: onlineStatus,
      offline: offlineStatus,
      autoAvailable: onlineStatus.available || offlineStatus.available,
    };
  }

  /**
   * Sanitize and limit context messages to prevent token blowout
   */
  _prepareMessages(messages, systemPrompt = null) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages must be a non-empty array.');
    }

    const sanitized = messages
      .filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
        content: m.content.trim(),
      }));

    if (sanitized.length === 0) {
      throw new Error('At least one valid message is required.');
    }

    // Keep the most recent messages up to maxContextMessages
    const bounded = sanitized.slice(-this.maxContextMessages);

    // If systemPrompt provided and not already present, prepend system instruction
    if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim()) {
      return [{ role: 'system', content: systemPrompt.trim() }, ...bounded];
    }

    return bounded;
  }

  /**
   * Execute chat according to mode: 'auto' | 'online' | 'offline'
   */
  async executeChat({ messages, mode = 'auto', conversationId, context = null, systemPrompt = null }) {
    const validMode = ['auto', 'online', 'offline'].includes(mode) ? mode : 'auto';
    const effectiveSystemPrompt = systemPrompt || (typeof context === 'string' ? context : null);
    const preparedMessages = this._prepareMessages(messages, effectiveSystemPrompt);

    // 1. Explicit ONLINE Mode
    if (validMode === 'online') {
      const response = await this.onlineEngine.sendMessage(preparedMessages);
      return {
        ...response,
        conversationId,
        fallback: false,
        mode: 'online',
      };
    }

    // 2. Explicit OFFLINE Mode
    if (validMode === 'offline') {
      const response = await this.ollamaEngine.sendMessage(preparedMessages);
      return {
        ...response,
        conversationId,
        fallback: false,
        mode: 'offline',
      };
    }

    // 3. AUTO Mode: Try Online first, fallback to Ollama on qualifying availability failures
    try {
      const onlineResponse = await this.onlineEngine.sendMessage(preparedMessages);
      return {
        ...onlineResponse,
        conversationId,
        fallback: false,
        mode: 'auto',
      };
    } catch (onlineError) {
      console.warn(`[Auto Mode] Online AI failed: ${onlineError.message}. Attempting fallback to Ollama...`);

      try {
        const offlineResponse = await this.ollamaEngine.sendMessage(preparedMessages);
        return {
          ...offlineResponse,
          conversationId,
          fallback: true,
          fallbackNotice:
            'Online AI is temporarily unavailable. Responding via Local AI (Ollama).',
          mode: 'auto',
          primaryError: onlineError.message,
        };
      } catch (offlineError) {
        const combinedError = new Error(
          `Unable to generate AI response. Online AI: ${onlineError.message} | Local Ollama: ${offlineError.message}`
        );
        combinedError.statusCode = 503;
        combinedError.onlineError = onlineError.message;
        combinedError.offlineError = offlineError.message;
        throw combinedError;
      }
    }
  }
}

export default new ChatEngineManager();
