import { N8N_LEARNING_AGENT_URL } from '../../config/env.js';

export class N8nLearningAgentService {
  constructor() {
    this.name = 'n8n';
    this.timeoutMs = 20000;
  }

  getWebhookUrl() {
    return (process.env.N8N_LEARNING_AGENT_URL || N8N_LEARNING_AGENT_URL || '').trim();
  }

  /**
   * Check whether n8n Agentic AI webhook is configured
   */
  async checkAvailability() {
    const url = this.getWebhookUrl();
    if (!url) {
      return {
        available: false,
        provider: 'n8n',
        message: 'n8n Agentic AI webhook URL is not configured. Set N8N_LEARNING_AGENT_URL.',
      };
    }

    try {
      // Validate URL syntax
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return {
          available: false,
          provider: 'n8n',
          message: `Invalid n8n webhook URL protocol: ${parsed.protocol}`,
        };
      }

      return {
        available: true,
        provider: 'n8n',
        endpoint: url,
        message: 'n8n Agentic AI webhook configured and ready.',
      };
    } catch (err) {
      return {
        available: false,
        provider: 'n8n',
        message: `Invalid n8n webhook URL format: ${err.message}`,
      };
    }
  }

  /**
   * Extract text content from n8n response safely
   */
  _extractContent(data) {
    if (!data) return '';

    if (typeof data === 'string') {
      const trimmed = data.trim();
      // Guard against HTML error pages returned as string
      if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.includes('<title>Error')) {
        throw new Error('Received HTML error page instead of JSON response from n8n');
      }
      return trimmed;
    }

    // If array returned by n8n
    const payload = Array.isArray(data) ? data[0] : data;
    if (!payload || typeof payload !== 'object') {
      return String(payload || '');
    }

    // Look for recognized fields
    if (typeof payload.answer === 'string') return payload.answer;
    if (typeof payload.output === 'string') return payload.output;
    if (typeof payload.response === 'string') return payload.response;
    if (typeof payload.text === 'string') return payload.text;
    if (typeof payload.content === 'string') return payload.content;

    // Nested message structure
    if (payload.message) {
      if (typeof payload.message === 'string') return payload.message;
      if (typeof payload.message.content === 'string') return payload.message.content;
    }

    // If it's an object with answer/output as object
    if (payload.data && typeof payload.data === 'object') {
      return this._extractContent(payload.data);
    }

    return '';
  }

  /**
   * Send chat messages & learning context to n8n Agentic AI Webhook
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} options
   */
  async sendMessage(messages, options = {}) {
    const webhookUrl = this.getWebhookUrl();
    if (!webhookUrl) {
      const err = new Error('n8n Agentic AI webhook URL is not configured.');
      err.isAvailabilityError = true;
      err.engine = 'n8n';
      throw err;
    }

    const {
      conversationId = `conv-${Date.now()}`,
      userId = 'local-user',
      learnerContext = {},
      responsePreferences = { language: 'en' },
      systemPrompt = null,
    } = options;

    // Find the latest user message
    const userMessages = messages.filter((m) => m && m.role === 'user');
    const latestUserMsg = userMessages[userMessages.length - 1] || messages[messages.length - 1];
    const messageText = latestUserMsg ? latestUserMsg.content : '';

    // Build history (excluding the current user message)
    const history = messages
      .filter((m) => m && m !== latestUserMsg)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
        content: m.content,
      }));

    // If systemPrompt was passed and not in messages, include in learnerContext
    const enrichedLearnerContext = {
      ...learnerContext,
      ...(systemPrompt ? { systemPrompt } : {}),
    };

    const payload = {
      message: messageText,
      conversationId,
      userId,
      history,
      learnerContext: enrichedLearnerContext,
      responsePreferences,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain, */*',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        const err = new Error(`n8n webhook HTTP ${res.status}: ${errorText.slice(0, 200) || res.statusText}`);
        err.statusCode = res.status;
        err.isAvailabilityError = true;
        err.engine = 'n8n';
        throw err;
      }

      const contentType = res.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      const content = this._extractContent(data);
      if (!content || !content.trim()) {
        const err = new Error('n8n webhook returned an empty or unparseable response.');
        err.isAvailabilityError = true;
        err.engine = 'n8n';
        throw err;
      }

      const firstItem = Array.isArray(data) ? data[0] : data;

      return {
        role: 'assistant',
        content: content.trim(),
        engine: 'n8n',
        provider: 'n8n',
        model: 'agentic-ai',
        intent: firstItem?.intent || 'general',
        nextAction: firstItem?.next_action || null,
        raw: typeof data === 'object' ? data : null,
      };
    } catch (err) {
      const isTimeout = err.name === 'AbortError';
      const error = new Error(
        isTimeout
          ? `n8n Agentic AI request timed out after ${this.timeoutMs / 1000}s.`
          : `n8n Agentic AI request failed: ${err.message}`
      );
      error.isAvailabilityError = true;
      error.engine = 'n8n';
      error.statusCode = err.statusCode || (isTimeout ? 504 : 502);
      error.cause = err;
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export default new N8nLearningAgentService();
