import {
  ONLINE_AI_URL,
  ONLINE_AI_API_KEY,
  ONLINE_AI_PROVIDER,
  ONLINE_AI_MODEL,
} from '../../config/env.js';

export class OnlineChatEngine {
  constructor() {
    this.name = 'online';
    this.timeoutMs = 15000;
  }

  /**
   * Check whether online AI is configured and ready
   */
  async checkAvailability() {
    if (ONLINE_AI_URL) {
      return {
        available: true,
        provider: 'custom_url',
        endpoint: ONLINE_AI_URL,
        message: 'Online AI custom endpoint configured.',
      };
    }

    if (ONLINE_AI_API_KEY) {
      return {
        available: true,
        provider: ONLINE_AI_PROVIDER,
        model: ONLINE_AI_MODEL,
        message: `Online AI configured with ${ONLINE_AI_PROVIDER} (${ONLINE_AI_MODEL}).`,
      };
    }

    return {
      available: false,
      provider: ONLINE_AI_PROVIDER,
      message:
        'Online AI is not configured. Set ONLINE_AI_API_KEY (or GEMINI_API_KEY/OPENAI_API_KEY) or ONLINE_AI_URL.',
    };
  }

  /**
   * Send chat messages to online AI provider
   * @param {Array<{role: string, content: string}>} messages
   */
  async sendMessage(messages) {
    const availability = await this.checkAvailability();
    if (!availability.available) {
      const error = new Error(availability.message);
      error.isAvailabilityError = true;
      error.engine = 'online';
      throw error;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      if (ONLINE_AI_URL) {
        return await this._callCustomEndpoint(messages, controller.signal);
      }

      if (ONLINE_AI_PROVIDER === 'gemini') {
        return await this._callGemini(messages, controller.signal);
      }

      // Default to OpenAI-compatible
      return await this._callOpenAI(messages, controller.signal);
    } catch (err) {
      const isTimeout = err.name === 'AbortError';
      const error = new Error(
        isTimeout
          ? `Online AI request timed out after ${this.timeoutMs / 1000}s.`
          : `Online AI request failed: ${err.message}`
      );
      error.isAvailabilityError = true;
      error.engine = 'online';
      error.cause = err;
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async _callCustomEndpoint(messages, signal) {
    const res = await fetch(ONLINE_AI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ONLINE_AI_API_KEY ? { Authorization: `Bearer ${ONLINE_AI_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        messages,
        model: ONLINE_AI_MODEL,
      }),
      signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`Custom online service HTTP ${res.status}: ${errorText || res.statusText}`);
    }

    const data = await res.json();
    const content =
      data.content ||
      data.message?.content ||
      data.response ||
      data.text ||
      (typeof data === 'string' ? data : JSON.stringify(data));

    return {
      role: 'assistant',
      content: content.trim(),
      engine: 'online',
      model: ONLINE_AI_MODEL || 'custom',
    };
  }

  async _callGemini(messages, signal) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${ONLINE_AI_MODEL}:generateContent?key=${ONLINE_AI_API_KEY}`;

    // Convert standard chat messages to Gemini contents format
    const contents = messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [
        {
          text:
            msg.role === 'system'
              ? `[System Context & Instructions]:\n${msg.content}`
              : msg.content,
        },
      ],
    }));

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
      signal,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const msg = errorData.error?.message || `HTTP ${res.status} ${res.statusText}`;
      throw new Error(`Gemini API error: ${msg}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text;

    if (!textPart) {
      throw new Error('Gemini returned an empty response.');
    }

    return {
      role: 'assistant',
      content: textPart.trim(),
      engine: 'online',
      model: ONLINE_AI_MODEL,
    };
  }

  async _callOpenAI(messages, signal) {
    const url = 'https://api.openai.com/v1/chat/completions';

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ONLINE_AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: ONLINE_AI_MODEL || 'gpt-4o-mini',
        messages,
      }),
      signal,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const msg = errorData.error?.message || `HTTP ${res.status} ${res.statusText}`;
      throw new Error(`OpenAI API error: ${msg}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error('OpenAI returned an empty response.');
    }

    return {
      role: 'assistant',
      content: text.trim(),
      engine: 'online',
      model: ONLINE_AI_MODEL,
    };
  }
}

export default new OnlineChatEngine();
