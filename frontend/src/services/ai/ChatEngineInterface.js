/**
 * Base abstract class defining the LearningChatEngine contract
 */
export class LearningChatEngine {
  constructor(name) {
    if (new.target === LearningChatEngine) {
      throw new TypeError('Cannot construct LearningChatEngine instances directly.');
    }
    this.name = name;
  }

  /**
   * Send messages to AI provider
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} options
   * @returns {Promise<{role: string, content: string, engine: string, model?: string}>}
   */
  async sendMessage(_messages, _options = {}) {
    throw new Error('sendMessage() must be implemented by subclass');
  }

  /**
   * Check provider availability
   * @returns {Promise<{available: boolean, message?: string}>}
   */
  async checkAvailability() {
    throw new Error('checkAvailability() must be implemented by subclass');
  }

  /**
   * Cancel an in-flight request
   */
  cancelRequest() {
    // Default no-op if not supported
  }
}

export default LearningChatEngine;
