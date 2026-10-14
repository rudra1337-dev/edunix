import { OLLAMA_BASE_URL, OLLAMA_MODEL } from '../../config/env.js';

export class OllamaChatEngine {
  constructor() {
    this.name = 'ollama';
    this.timeoutMs = 90000;
  }

  getBaseUrl() {
    return (process.env.OLLAMA_BASE_URL || OLLAMA_BASE_URL).replace(/\/$/, '');
  }

  getModel() {
    return process.env.OLLAMA_MODEL || OLLAMA_MODEL || 'llama3.2:1b';
  }

  /**
   * Check whether local Ollama service is running and configured model is installed
   */
  async checkAvailability() {
    const baseUrl = this.getBaseUrl();
    const model = this.getModel();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const res = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!res.ok) {
        return {
          available: false,
          provider: 'ollama',
          baseUrl,
          message: `Ollama returned HTTP ${res.status}: ${res.statusText}`,
        };
      }

      const data = await res.json();
      const models = Array.isArray(data.models) ? data.models : [];
      const modelNames = models.map((m) => m.name);

      const hasModel = modelNames.some(
        (name) => name === model || name.startsWith(`${model}:`)
      );

      if (!hasModel) {
        return {
          available: false,
          modelMissing: true,
          provider: 'ollama',
          baseUrl,
          configuredModel: model,
          installedModels: modelNames,
          message: `Ollama is running, but model '${model}' is not installed. Run 'ollama pull ${model}'. Available models: ${modelNames.join(', ') || 'None'}`,
        };
      }

      return {
        available: true,
        provider: 'ollama',
        baseUrl,
        model,
        installedModels: modelNames,
        message: `Local Ollama is ready using model '${model}'.`,
      };
    } catch (err) {
      const isConnectionRefused =
        err.cause?.code === 'ECONNREFUSED' ||
        err.message.includes('fetch failed') ||
        err.name === 'AbortError';

      return {
        available: false,
        provider: 'ollama',
        baseUrl,
        configuredModel: model,
        message: isConnectionRefused
          ? `Local Ollama service is not running at ${baseUrl}. Start it with 'ollama serve'.`
          : `Ollama service check failed: ${err.message}`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Send chat messages to Ollama
   * @param {Array<{role: string, content: string}>} messages
   */
  async sendMessage(messages) {
    const baseUrl = this.getBaseUrl();
    const model = this.getModel();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errorDetail = '';
        try {
          const errJson = await res.json();
          errorDetail = errJson.error || '';
        } catch {
          errorDetail = await res.text().catch(() => '');
        }

        if (res.status === 404 || errorDetail.includes('not found')) {
          const err = new Error(
            `Ollama model '${model}' not found on server. Run 'ollama pull ${model}'.`
          );
          err.engine = 'ollama';
          throw err;
        }

        const err = new Error(`Ollama HTTP ${res.status}: ${errorDetail || res.statusText}`);
        err.engine = 'ollama';
        throw err;
      }

      const data = await res.json();
      const content = data.message?.content;

      if (!content && content !== '') {
        throw new Error('Ollama returned an empty message response.');
      }

      return {
        role: 'assistant',
        content: content.trim(),
        engine: 'ollama',
        model,
      };
    } catch (err) {
      if (err.engine === 'ollama') throw err;

      const isConnectionRefused =
        err.cause?.code === 'ECONNREFUSED' || err.message.includes('fetch failed');
      const isTimeout = err.name === 'AbortError';

      let message = `Local AI (Ollama) error: ${err.message}`;
      if (isConnectionRefused) {
        message = `Cannot connect to local Ollama at ${baseUrl}. Please ensure Ollama is installed and running ('ollama serve').`;
      } else if (isTimeout) {
        message = `Local AI request timed out after ${this.timeoutMs / 1000}s. Your model may be loading or generating too slowly.`;
      }

      const error = new Error(message);
      error.engine = 'ollama';
      error.isAvailabilityError = true;
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export default new OllamaChatEngine();
