import syncQueueRepository from '../storage/syncQueueRepository.js';
import learningEventRepository from '../storage/learningEventRepository.js';
import { apiPost, apiGet } from '../api.js';

export class SyncEngine {
  constructor() {
    this.syncRepo = syncQueueRepository;
    this.eventRepo = learningEventRepository;
    this.isSyncing = false;
    this.batchSize = 25;
    this.listeners = new Set();
    this.state = {
      isSyncing: false,
      pendingCount: 0,
      lastSyncTime: null,
      syncError: null,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    };

    // Auto-sync interval (every 30 seconds if online)
    this.intervalId = null;
  }

  /**
   * Subscribe to reactive sync state changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.state);
    return () => this.listeners.delete(callback);
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('[SyncEngine] Error in listener callback:', err);
      }
    }
  }

  /**
   * Initialize sync engine listeners and auto-sync
   */
  async initialize() {
    // Reset any operations that were in_flight when tab closed
    await this.syncRepo.resetInFlight();
    await this.refreshPendingCount();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.state.isOnline = true;
        this._notify();
        this.triggerSync();
      });

      window.addEventListener('offline', () => {
        this.state.isOnline = false;
        this._notify();
      });

      // Poll sync queue every 30 seconds
      if (!this.intervalId) {
        this.intervalId = setInterval(() => {
          if (this.state.isOnline) {
            this.triggerSync();
          }
        }, 30000);
      }
    }
  }

  /**
   * Refresh pending count for UI badge
   */
  async refreshPendingCount(userId = null) {
    const count = await this.syncRepo.getQueueCount(userId);
    this.state.pendingCount = count;
    this._notify();
    return count;
  }

  /**
   * Check whether backend API is truly reachable
   */
  async isBackendReachable() {
    try {
      const res = await apiGet('/health');
      return res?.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Trigger a synchronization run
   */
  async triggerSync(userId = null) {
    // Concurrency guard: avoid overlapping runs
    if (this.isSyncing) return { success: false, reason: 'Sync already in progress' };

    this.isSyncing = true;
    this.state.isSyncing = true;
    this.state.syncError = null;
    this._notify();

    try {
      // 1. Get pending batch
      const batch = await this.syncRepo.getPendingBatch(this.batchSize);
      if (batch.length === 0) {
        await this.refreshPendingCount(userId);
        return { success: true, processedCount: 0 };
      }

      // 2. Real connectivity check
      const reachable = await this.isBackendReachable();
      if (!reachable) {
        this.state.isOnline = false;
        this.state.syncError = 'Backend service is currently unreachable';
        return { success: false, reason: 'Backend unreachable' };
      }

      this.state.isOnline = true;

      // 3. Mark batch in-flight
      const operationIds = batch.map((op) => op.operationId);
      await this.syncRepo.markInFlight(operationIds);

      // 4. Send to backend synchronization endpoint
      const payload = {
        operations: batch.map((op) => ({
          operationId: op.operationId,
          entityType: op.entityType,
          entityId: op.entityId,
          operation: op.operation,
          payload: op.payload,
          createdAt: op.createdAt,
        })),
      };

      const res = await apiPost('/sync/batch', payload);
      const data = res?.data || res || {};

      const acknowledged = data.acknowledgedOperationIds || [];
      const rejected = data.rejectedOperations || [];

      // 5. Process acknowledgments
      if (acknowledged.length > 0) {
        await this.syncRepo.acknowledge(acknowledged);

        // Also mark corresponding learningEvents as synced
        const eventOps = batch.filter(
          (op) => op.entityType === 'learningEvent' && acknowledged.includes(op.operationId)
        );
        if (eventOps.length > 0) {
          await this.eventRepo.markEventsSynced(eventOps.map((op) => op.entityId));
        }
      }

      // 6. Process rejected or failed items
      for (const rej of rejected) {
        const isPermanent = ['VALIDATION_ERROR', 'FORBIDDEN', 'INVALID_OPERATION'].includes(
          rej.code
        );
        await this.syncRepo.recordFailure(rej.operationId, rej.reason || 'Rejected by server', isPermanent);
      }

      // 7. Update state
      this.state.lastSyncTime = new Date().toISOString();
      await this.refreshPendingCount(userId);

      return {
        success: true,
        acknowledgedCount: acknowledged.length,
        rejectedCount: rejected.length,
      };
    } catch (err) {
      console.warn('[SyncEngine] Synchronization batch error:', err.message);
      this.state.syncError = err.message;
      return { success: false, error: err.message };
    } finally {
      this.isSyncing = false;
      this.state.isSyncing = false;
      this._notify();
    }
  }
}

export const syncEngine = new SyncEngine();
export default syncEngine;
