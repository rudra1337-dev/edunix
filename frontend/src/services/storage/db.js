import { openDB } from 'idb';

export const DB_NAME = 'edunix_offline_db';
export const DB_VERSION = 1;

export const STORES = {
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  LEARNER_PROFILES: 'learnerProfiles',
  LEARNER_MEMORIES: 'learnerMemories',
  LEARNING_PLANS: 'learningPlans',
  LEARNING_EVENTS: 'learningEvents',
  SYNC_QUEUE: 'syncQueue',
};

let dbPromise = null;

/**
 * Get or initialize the IndexedDB connection singleton
 */
export const getDB = () => {
  if (dbPromise) return dbPromise;

  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // 1. Conversations store
      if (!db.objectStoreNames.contains(STORES.CONVERSATIONS)) {
        const convStore = db.createObjectStore(STORES.CONVERSATIONS, { keyPath: 'id' });
        convStore.createIndex('by-user', 'userId');
        convStore.createIndex('by-updated', 'updatedAt');
      }

      // 2. Messages store
      if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
        const msgStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
        msgStore.createIndex('by-conversation', 'conversationId');
        msgStore.createIndex('by-user', 'userId');
        msgStore.createIndex('by-created', 'createdAt');
      }

      // 3. Learner Profiles store (keyed by userId)
      if (!db.objectStoreNames.contains(STORES.LEARNER_PROFILES)) {
        db.createObjectStore(STORES.LEARNER_PROFILES, { keyPath: 'userId' });
      }

      // 4. Learner Memories store
      if (!db.objectStoreNames.contains(STORES.LEARNER_MEMORIES)) {
        const memStore = db.createObjectStore(STORES.LEARNER_MEMORIES, { keyPath: 'id' });
        memStore.createIndex('by-user', 'userId');
        memStore.createIndex('by-type', 'type');
        memStore.createIndex('by-user-type', ['userId', 'type']);
        memStore.createIndex('by-user-status', ['userId', 'status']);
      }

      // 5. Learning Plans store
      if (!db.objectStoreNames.contains(STORES.LEARNING_PLANS)) {
        const planStore = db.createObjectStore(STORES.LEARNING_PLANS, { keyPath: 'id' });
        planStore.createIndex('by-user', 'userId');
        planStore.createIndex('by-status', 'status');
      }

      // 6. Learning Events store (append-only log)
      if (!db.objectStoreNames.contains(STORES.LEARNING_EVENTS)) {
        const eventStore = db.createObjectStore(STORES.LEARNING_EVENTS, { keyPath: 'eventId' });
        eventStore.createIndex('by-user', 'userId');
        eventStore.createIndex('by-plan', 'learningPlanId');
        eventStore.createIndex('by-occurred', 'occurredAt');
        eventStore.createIndex('by-sync', 'syncStatus');
      }

      // 7. Synchronization Queue store
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'operationId' });
        syncStore.createIndex('by-user', 'userId');
        syncStore.createIndex('by-status', 'status');
        syncStore.createIndex('by-created', 'createdAt');
      }
    },
    blocked() {
      console.warn('[IndexedDB] Database upgrade blocked by another open tab.');
    },
    blocking() {
      console.warn('[IndexedDB] Closing old connection to unblock newer database version.');
      if (dbPromise) {
        dbPromise.then((db) => db.close());
        dbPromise = null;
      }
    },
    terminated() {
      console.error('[IndexedDB] Database connection unexpectedly terminated.');
      dbPromise = null;
    },
  });

  return dbPromise;
};

/**
 * Helper to execute a read transaction
 */
export const withRead = async (storeName, callback) => {
  const db = await getDB();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  return callback(store);
};

/**
 * Helper to execute a write transaction
 */
export const withWrite = async (storeName, callback) => {
  const db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const result = await callback(store);
  await tx.done;
  return result;
};

/**
 * Helper to clear all stores (useful for tests or full reset)
 */
export const clearAllStores = async () => {
  const db = await getDB();
  for (const storeName of Object.values(STORES)) {
    const tx = db.transaction(storeName, 'readwrite');
    await tx.objectStore(storeName).clear();
    await tx.done;
  }
};
