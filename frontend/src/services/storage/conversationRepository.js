import { withRead, withWrite, STORES } from './db.js';

export const conversationRepository = {
  /**
   * Get all conversations, optionally filtered by userId
   */
  async getConversations(userId = null) {
    return withRead(STORES.CONVERSATIONS, async (store) => {
      let all;
      if (userId) {
        const index = store.index('by-user');
        all = await index.getAll(userId);
      } else {
        all = await store.getAll();
      }
      return (all || []).sort(
        (a, b) => new Date(b.updatedAt || b.lastMessageAt || 0) - new Date(a.updatedAt || a.lastMessageAt || 0)
      );
    });
  },

  /**
   * Get single conversation by ID
   */
  async getConversation(id) {
    return withRead(STORES.CONVERSATIONS, (store) => store.get(id));
  },

  /**
   * Save or update a conversation document
   */
  async saveConversation(conv) {
    const document = {
      ...conv,
      updatedAt: conv.updatedAt || new Date().toISOString(),
      version: conv.version !== undefined ? conv.version : 1,
    };
    await withWrite(STORES.CONVERSATIONS, (store) => store.put(document));
    return document;
  },

  /**
   * Delete a conversation and all its messages
   */
  async deleteConversation(id) {
    await withWrite(STORES.CONVERSATIONS, (store) => store.delete(id));
    // Delete corresponding messages
    await withWrite(STORES.MESSAGES, async (store) => {
      const index = store.index('by-conversation');
      let cursor = await index.openCursor(id);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    });
    return true;
  },

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId, limit = 100) {
    return withRead(STORES.MESSAGES, async (store) => {
      const index = store.index('by-conversation');
      const messages = await index.getAll(conversationId);
      return (messages || [])
        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || new Date(a.createdAt) - new Date(b.createdAt))
        .slice(-limit);
    });
  },

  /**
   * Save a single message
   */
  async saveMessage(msg) {
    const document = {
      ...msg,
      createdAt: msg.createdAt || new Date().toISOString(),
      syncStatus: msg.syncStatus || 'pending',
    };
    await withWrite(STORES.MESSAGES, (store) => store.put(document));
    return document;
  },

  /**
   * Batch save messages
   */
  async saveMessages(messages) {
    return withWrite(STORES.MESSAGES, async (store) => {
      for (const msg of messages) {
        await store.put({
          ...msg,
          createdAt: msg.createdAt || new Date().toISOString(),
          syncStatus: msg.syncStatus || 'pending',
        });
      }
      return messages;
    });
  },

  /**
   * Migrate existing localStorage conversations into IndexedDB
   */
  async migrateFromLocalStorage(userId = 'local-user') {
    try {
      const saved = localStorage.getItem('edunix_conversations');
      if (!saved) return 0;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length === 0) return 0;

      let migratedCount = 0;
      for (const conv of parsed) {
        const existing = await this.getConversation(conv.id);
        if (!existing) {
          await this.saveConversation({
            id: conv.id,
            userId,
            title: conv.title || 'Chat',
            summary: conv.summary || '',
            lastMessageAt: conv.updatedAt || conv.createdAt,
            createdAt: conv.createdAt || new Date().toISOString(),
            updatedAt: conv.updatedAt || new Date().toISOString(),
            syncStatus: 'pending',
          });

          if (Array.isArray(conv.messages)) {
            for (let i = 0; i < conv.messages.length; i++) {
              const m = conv.messages[i];
              await this.saveMessage({
                id: m.id,
                conversationId: conv.id,
                userId,
                role: m.role,
                content: m.content,
                sequence: i,
                engine: m.engine,
                model: m.model,
                createdAt: m.createdAt || new Date().toISOString(),
                syncStatus: 'pending',
              });
            }
          }
          migratedCount++;
        }
      }
      return migratedCount;
    } catch (err) {
      console.warn('[conversationRepository] Migration from localStorage failed:', err);
      return 0;
    }
  },
};

export default conversationRepository;
