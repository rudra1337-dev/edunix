import onlineEngine from './onlineEngine.js';
import ollamaEngine from './ollamaEngine.js';
import n8nService from './n8nLearningAgentService.js';

export class ChatEngineManager {
  constructor() {
    this.n8nService = n8nService;
    this.onlineEngine = onlineEngine;
    this.ollamaEngine = ollamaEngine;
    this.maxContextMessages = 15;
  }

  /**
   * Check status of n8n Agentic AI, Gemini Online AI, and Ollama Local AI
   */
  async getStatus() {
    const [n8nStatus, geminiStatus, ollamaStatus] = await Promise.all([
      this.n8nService.checkAvailability().catch((err) => ({
        available: false,
        provider: 'n8n',
        message: err.message,
      })),
      this.onlineEngine.checkAvailability().catch((err) => ({
        available: false,
        provider: 'gemini',
        message: err.message,
      })),
      this.ollamaEngine.checkAvailability().catch((err) => ({
        available: false,
        provider: 'ollama',
        message: err.message,
      })),
    ]);

    return {
      agentic: n8nStatus,
      n8n: n8nStatus,
      gemini: geminiStatus,
      online: geminiStatus, // backward-compatibility alias
      offline: ollamaStatus, // backward-compatibility alias
      ollama: ollamaStatus,
      autoAvailable: Boolean(n8nStatus.available || ollamaStatus.available),
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
   * Normalize input mode into standard keys: 'auto' | 'local' | 'gemini'
   */
  _normalizeMode(mode) {
    if (!mode) return 'auto';
    const m = String(mode).toLowerCase().trim();
    if (m === 'agentic' || m === 'n8n' || m === 'agent') return 'agentic';
    if (m === 'offline' || m === 'local' || m === 'ollama') return 'local';
    if (m === 'online' || m === 'gemini') return 'gemini';
    return 'auto';
  }

  /**
   * Execute chat according to unified provider system:
   * - 'agentic': Dedicated n8n Agentic AI only (pure agentic test mode, NO fallback)
   * - 'auto': n8n Agentic AI -> fallback to Local Ollama (NEVER Gemini)
   * - 'gemini': Gemini API -> fallback to Local Ollama (NEVER n8n)
   * - 'local': Local Ollama only (NEVER n8n or Gemini)
   */
  async executeChat({
    messages,
    mode = 'auto',
    conversationId,
    userId = 'local-user',
    context = null,
    systemPrompt = null,
    learnerContext = null,
    responsePreferences = null,
  }) {
    const selectedMode = this._normalizeMode(mode);
    const effectiveSystemPrompt = systemPrompt || (typeof context === 'string' ? context : null);
    const preparedMessages = this._prepareMessages(messages, effectiveSystemPrompt);

    // 1. Dedicated AGENTIC AI Mode: Direct n8n Agentic AI only (NO fallback)
    if (selectedMode === 'agentic') {
      const n8nResponse = await this.n8nService.sendMessage(preparedMessages, {
        conversationId,
        userId,
        learnerContext,
        responsePreferences,
        systemPrompt: effectiveSystemPrompt,
      });

      return {
        ...n8nResponse,
        conversationId,
        fallback: false,
        mode: 'agentic',
        providerLabel: 'n8n Agentic AI',
      };
    }

    // 2. Strict LOCAL / OFFLINE Mode: Local Ollama only
    if (selectedMode === 'local') {
      const response = await this.ollamaEngine.sendMessage(preparedMessages);
      return {
        ...response,
        conversationId,
        fallback: false,
        mode: 'local',
        providerLabel: 'Local AI (Ollama)',
      };
    }

    // 2. Strict GEMINI Mode: Gemini primary with Ollama fallback
    if (selectedMode === 'gemini') {
      try {
        const response = await this.onlineEngine.sendMessage(preparedMessages);
        return {
          ...response,
          conversationId,
          fallback: false,
          mode: 'gemini',
          providerLabel: 'Gemini AI',
        };
      } catch (geminiError) {
        console.warn(`[Gemini Mode] Gemini AI failed: ${geminiError.message}. Attempting fallback to Ollama...`);

        try {
          const offlineResponse = await this.ollamaEngine.sendMessage(preparedMessages);
          return {
            ...offlineResponse,
            conversationId,
            fallback: true,
            fallbackNotice: 'Gemini AI is temporarily unavailable. Responding via Local AI (Ollama).',
            mode: 'gemini',
            providerLabel: 'Local AI (Ollama)',
            primaryError: geminiError.message,
          };
        } catch (offlineError) {
          const combinedError = new Error(
            `Unable to generate AI response. Gemini AI: ${geminiError.message} | Local Ollama: ${offlineError.message}`
          );
          combinedError.statusCode = 503;
          combinedError.onlineError = geminiError.message;
          combinedError.offlineError = offlineError.message;
          throw combinedError;
        }
      }
    }

    // 3. AUTO Mode: n8n Agentic AI primary, fallback to Ollama (NEVER Gemini)
    try {
      const n8nResponse = await this.n8nService.sendMessage(preparedMessages, {
        conversationId,
        userId,
        learnerContext,
        responsePreferences,
        systemPrompt: effectiveSystemPrompt,
      });

      return {
        ...n8nResponse,
        conversationId,
        fallback: false,
        mode: 'auto',
        providerLabel: 'n8n Agentic AI',
      };
    } catch (n8nError) {
      console.warn(`[Auto Mode] n8n Agentic AI failed: ${n8nError.message}. Falling back to Local AI (Ollama)...`);

      try {
        const offlineResponse = await this.ollamaEngine.sendMessage(preparedMessages);
        return {
          ...offlineResponse,
          conversationId,
          fallback: true,
          fallbackNotice: 'n8n Agentic AI is temporarily unavailable. Responding via Local AI (Ollama).',
          mode: 'auto',
          providerLabel: 'Local AI (Ollama)',
          primaryError: n8nError.message,
        };
      } catch (offlineError) {
        const combinedError = new Error(
          `Unable to generate AI response. n8n Agentic AI: ${n8nError.message} | Local Ollama: ${offlineError.message}`
        );
        combinedError.statusCode = 503;
        combinedError.n8nError = n8nError.message;
        combinedError.offlineError = offlineError.message;
        throw combinedError;
      }
    }
  }
}

export default new ChatEngineManager();
