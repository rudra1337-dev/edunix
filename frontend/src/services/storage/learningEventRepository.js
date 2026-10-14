import { withRead, withWrite, STORES } from './db.js';

export const learningEventRepository = {
  /**
   * Append-only record of a meaningful learning event
   */
  async recordEvent(event) {
    if (!event.eventId) {
      throw new Error('Event must have a stable eventId.');
    }

    const document = {
      eventId: event.eventId,
      userId: event.userId,
      conversationId: event.conversationId || null,
      learningPlanId: event.learningPlanId || null,
      learningPlanItemId: event.learningPlanItemId || null,
      type: event.type,
      topic: event.topic || 'General',
      payload: event.payload || {},
      occurredAt: event.occurredAt || new Date().toISOString(),
      schemaVersion: event.schemaVersion || 1,
      syncStatus: event.syncStatus || 'pending',
    };

    await withWrite(STORES.LEARNING_EVENTS, async (store) => {
      const existing = await store.get(document.eventId);
      if (existing) {
        // Idempotency: do not re-record or duplicate existing event
        return existing;
      }
      return store.put(document);
    });

    return document;
  },

  /**
   * Get events for a user, ordered by occurredAt
   */
  async getEvents(userId, limit = 50) {
    return withRead(STORES.LEARNING_EVENTS, async (store) => {
      const index = store.index('by-user');
      const all = await index.getAll(userId);
      return (all || [])
        .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
        .slice(0, limit);
    });
  },

  /**
   * Get pending events that have not been synced
   */
  async getPendingEvents(userId) {
    return withRead(STORES.LEARNING_EVENTS, async (store) => {
      const index = store.index('by-sync');
      const pending = await index.getAll('pending');
      if (userId) {
        return (pending || []).filter((e) => e.userId === userId);
      }
      return pending || [];
    });
  },

  /**
   * Mark events as acknowledged/synced
   */
  async markEventsSynced(eventIds) {
    if (!Array.isArray(eventIds) || eventIds.length === 0) return 0;
    const idSet = new Set(eventIds);

    return withWrite(STORES.LEARNING_EVENTS, async (store) => {
      let count = 0;
      for (const id of idSet) {
        const existing = await store.get(id);
        if (existing) {
          existing.syncStatus = 'synced';
          existing.syncedAt = new Date().toISOString();
          await store.put(existing);
          count++;
        }
      }
      return count;
    });
  },
};

export default learningEventRepository;
