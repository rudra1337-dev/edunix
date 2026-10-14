import { withRead, withWrite, STORES } from './db.js';

export const memoryRepository = {
  /**
   * Get learner memories for a user, optionally filtered by type and status
   */
  async getMemories(userId, filters = {}) {
    return withRead(STORES.LEARNER_MEMORIES, async (store) => {
      const index = store.index('by-user');
      const all = await index.getAll(userId);

      return (all || []).filter((mem) => {
        if (filters.status && mem.status !== filters.status) return false;
        if (filters.type && mem.type !== filters.type) return false;
        // Default to active if status filter not specified
        if (!filters.status && mem.status === 'deleted') return false;
        return true;
      });
    });
  },

  /**
   * Get single memory by ID
   */
  async getMemory(id) {
    return withRead(STORES.LEARNER_MEMORIES, (store) => store.get(id));
  },

  /**
   * Find an active memory by key and type for a user
   */
  async getActiveMemoryByKey(userId, key, type = null) {
    const memories = await this.getMemories(userId, { type, status: 'active' });
    const normalizedTarget = String(key).trim().toLowerCase();
    return memories.find((m) => String(m.key).trim().toLowerCase() === normalizedTarget) || null;
  },

  /**
   * Save or update a memory record
   */
  async saveMemory(memory) {
    const document = {
      ...memory,
      status: memory.status || 'active',
      version: memory.version !== undefined ? memory.version : 1,
      updatedAt: new Date().toISOString(),
      createdAt: memory.createdAt || new Date().toISOString(),
      syncStatus: memory.syncStatus || 'pending',
    };
    await withWrite(STORES.LEARNER_MEMORIES, (store) => store.put(document));
    return document;
  },

  /**
   * Tombstone a memory record (soft-delete to prevent resurrection during sync)
   */
  async deleteMemory(id) {
    return withWrite(STORES.LEARNER_MEMORIES, async (store) => {
      const existing = await store.get(id);
      if (!existing) return false;

      const tombstone = {
        ...existing,
        status: 'deleted',
        version: (existing.version || 0) + 1,
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      };
      await store.put(tombstone);
      return tombstone;
    });
  },

  /**
   * Hard-delete a memory (e.g. after sync completion or explicit cleanup)
   */
  async hardDeleteMemory(id) {
    return withWrite(STORES.LEARNER_MEMORIES, (store) => store.delete(id));
  },

  /**
   * Get learner profile by userId
   */
  async getProfile(userId) {
    return withRead(STORES.LEARNER_PROFILES, (store) => store.get(userId));
  },

  /**
   * Save learner profile
   */
  async saveProfile(profile) {
    const document = {
      ...profile,
      version: (profile.version || 0) + 1,
      updatedAt: new Date().toISOString(),
      syncStatus: profile.syncStatus || 'pending',
    };
    await withWrite(STORES.LEARNER_PROFILES, (store) => store.put(document));
    return document;
  },
};

export default memoryRepository;
