import { withRead, withWrite, STORES } from './db.js';

const generateOpId = () => `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export const syncQueueRepository = {
  /**
   * Enqueue a synchronization operation with deduplication
   */
  async enqueue({ userId, entityType, entityId, operation = 'upsert', payload = {} }) {
    if (!userId || !entityType || !entityId) {
      throw new Error('Sync operation requires userId, entityType, and entityId.');
    }

    return withWrite(STORES.SYNC_QUEUE, async (store) => {
      // Deduplicate: check if a pending operation for the same entity already exists
      const allOps = await store.getAll();
      const existing = (allOps || []).find(
        (op) =>
          op.userId === userId &&
          op.entityType === entityType &&
          op.entityId === entityId &&
          op.status !== 'in_flight'
      );

      if (existing) {
        // Update payload on existing pending operation instead of creating redundant queue entries
        existing.payload = payload;
        existing.operation = operation;
        existing.updatedAt = new Date().toISOString();
        existing.status = 'pending';
        existing.lastError = null;
        await store.put(existing);
        return existing;
      }

      const newOp = {
        operationId: generateOpId(),
        userId,
        entityType,
        entityId,
        operation,
        payload,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: null,
        lastError: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await store.put(newOp);
      return newOp;
    });
  },

  /**
   * Get pending operations ready for dispatch in a bounded batch
   */
  async getPendingBatch(limit = 25) {
    return withRead(STORES.SYNC_QUEUE, async (store) => {
      const now = new Date().toISOString();
      const allOps = await store.getAll();

      return (allOps || [])
        .filter((op) => {
          if (op.status === 'in_flight') return false;
          if (op.nextAttemptAt && op.nextAttemptAt > now) return false;
          return op.status === 'pending';
        })
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .slice(0, limit);
    });
  },

  /**
   * Mark operations as in-flight during a synchronization run
   */
  async markInFlight(operationIds) {
    if (!Array.isArray(operationIds) || operationIds.length === 0) return;
    const idSet = new Set(operationIds);

    return withWrite(STORES.SYNC_QUEUE, async (store) => {
      for (const id of idSet) {
        const op = await store.get(id);
        if (op) {
          op.status = 'in_flight';
          op.updatedAt = new Date().toISOString();
          await store.put(op);
        }
      }
    });
  },

  /**
   * Remove acknowledged operations from the queue
   */
  async acknowledge(operationIds) {
    if (!Array.isArray(operationIds) || operationIds.length === 0) return 0;
    const idSet = new Set(operationIds);

    return withWrite(STORES.SYNC_QUEUE, async (store) => {
      let count = 0;
      for (const id of idSet) {
        await store.delete(id);
        count++;
      }
      return count;
    });
  },

  /**
   * Record failure on an operation with exponential backoff & jitter
   */
  async recordFailure(operationId, errorMsg, isPermanent = false) {
    return withWrite(STORES.SYNC_QUEUE, async (store) => {
      const op = await store.get(operationId);
      if (!op) return null;

      op.attempts = (op.attempts || 0) + 1;
      op.lastError = errorMsg;
      op.updatedAt = new Date().toISOString();

      if (isPermanent || op.attempts >= 10) {
        op.status = 'failed';
        op.nextAttemptAt = null; // Do not retry permanently rejected ops
      } else {
        op.status = 'pending';
        // Exponential backoff: base 2s * 2^attempts + jitter
        const baseDelayMs = Math.min(60000, 2000 * Math.pow(2, op.attempts));
        const jitterMs = Math.floor(Math.random() * 1000);
        op.nextAttemptAt = new Date(Date.now() + baseDelayMs + jitterMs).toISOString();
      }

      await store.put(op);
      return op;
    });
  },

  /**
   * Reset in-flight operations back to pending (e.g. after restart or network crash)
   */
  async resetInFlight() {
    return withWrite(STORES.SYNC_QUEUE, async (store) => {
      const allOps = await store.getAll();
      for (const op of allOps || []) {
        if (op.status === 'in_flight') {
          op.status = 'pending';
          op.updatedAt = new Date().toISOString();
          await store.put(op);
        }
      }
    });
  },

  /**
   * Count pending operations
   */
  async getQueueCount(userId = null) {
    return withRead(STORES.SYNC_QUEUE, async (store) => {
      const all = await store.getAll();
      if (!all) return 0;
      if (userId) {
        return all.filter((op) => op.userId === userId).length;
      }
      return all.length;
    });
  },
};

export default syncQueueRepository;
