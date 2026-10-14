import { useState, useEffect, useCallback, useRef } from 'react';
import conversationRepository from '../services/storage/conversationRepository';
import syncQueueRepository from '../services/storage/syncQueueRepository';

const CONVERSATIONS_KEY = 'edunix_conversations';
const ACTIVE_CONV_KEY = 'edunix_active_conv_id';

const generateId = () =>
  `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

const generateTitle = (text) => {
  if (!text) return 'New Chat';
  const clean = text.replace(/[\n\r]+/g, ' ').trim();
  return clean.length > 36 ? `${clean.substring(0, 36)}...` : clean;
};

export const useConversations = (userId = 'local-user') => {
  const [conversations, setConversations] = useState(() => {
    try {
      const saved = localStorage.getItem(CONVERSATIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse cached conversations', e);
    }
    return [];
  });

  const [activeId, setActiveId] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_CONV_KEY) || null;
    } catch {
      return null;
    }
  });

  const isLoadedFromIDB = useRef(false);

  // Initialize and load from IndexedDB on startup
  useEffect(() => {
    let isCancelled = false;

    const loadFromIndexedDB = async () => {
      try {
        // 1. Migrate any pre-existing localStorage conversations to IndexedDB
        await conversationRepository.migrateFromLocalStorage(userId);

        // 2. Load all conversations from IndexedDB
        const idbConvs = await conversationRepository.getConversations(userId);
        if (isCancelled) return;

        if (Array.isArray(idbConvs) && idbConvs.length > 0) {
          // Load messages for each conversation
          const populated = await Promise.all(
            idbConvs.map(async (c) => {
              const messages = await conversationRepository.getMessages(c.id);
              return {
                ...c,
                messages: messages || [],
              };
            })
          );

          if (!isCancelled) {
            setConversations(populated);
            if (!activeId || !populated.some((c) => c.id === activeId)) {
              setActiveId(populated[0]?.id || null);
            }
          }
        }
      } catch (err) {
        console.warn('[useConversations] IndexedDB load error, using memory/local state:', err);
      } finally {
        isLoadedFromIDB.current = true;
      }
    };

    loadFromIndexedDB();

    return () => {
      isCancelled = true;
    };
  }, [userId]);

  // Sync to localStorage as backup
  useEffect(() => {
    try {
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
      if (activeId) {
        localStorage.setItem(ACTIVE_CONV_KEY, activeId);
      } else {
        localStorage.removeItem(ACTIVE_CONV_KEY);
      }
    } catch (e) {
      console.error('Failed to sync to localStorage', e);
    }
  }, [conversations, activeId]);

  // Ensure activeId is valid
  useEffect(() => {
    if (activeId && conversations.length > 0 && !conversations.some((c) => c.id === activeId)) {
      setActiveId(conversations[0]?.id || null);
    }
  }, [conversations, activeId]);

  /**
   * Start a brand new conversation
   */
  const createConversation = useCallback(() => {
    const newConv = {
      id: generateId(),
      userId,
      title: 'New Chat',
      summary: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      syncStatus: 'pending',
    };

    setConversations((prev) => [newConv, ...prev]);
    setActiveId(newConv.id);

    // Persist to IndexedDB & enqueue sync
    conversationRepository.saveConversation(newConv).catch(console.error);
    syncQueueRepository.enqueue({
      userId,
      entityType: 'conversation',
      entityId: newConv.id,
      operation: 'upsert',
      payload: newConv,
    }).catch(console.error);

    return newConv;
  }, [userId]);

  /**
   * Select a conversation by ID
   */
  const selectConversation = useCallback((id) => {
    setActiveId(id);
  }, []);

  /**
   * Rename an existing conversation
   */
  const renameConversation = useCallback((id, newTitle) => {
    if (!newTitle || !newTitle.trim()) return;
    const cleanTitle = newTitle.trim();

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = {
          ...c,
          title: cleanTitle,
          updatedAt: new Date().toISOString(),
        };

        // Persist to IndexedDB & syncQueue
        conversationRepository.saveConversation(updated).catch(console.error);
        syncQueueRepository.enqueue({
          userId,
          entityType: 'conversation',
          entityId: id,
          operation: 'upsert',
          payload: { id, title: cleanTitle, updatedAt: updated.updatedAt },
        }).catch(console.error);

        return updated;
      })
    );
  }, [userId]);

  /**
   * Delete a conversation
   */
  const deleteConversation = useCallback(
    (id) => {
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.id !== id);
        if (activeId === id) {
          setActiveId(filtered[0]?.id || null);
        }
        return filtered;
      });

      // Persist deletion to IndexedDB & queue sync deletion
      conversationRepository.deleteConversation(id).catch(console.error);
      syncQueueRepository.enqueue({
        userId,
        entityType: 'conversation',
        entityId: id,
        operation: 'delete',
        payload: { id },
      }).catch(console.error);
    },
    [activeId, userId]
  );

  /**
   * Add a message to the currently active conversation
   */
  const addMessage = useCallback(
    (message) => {
      setConversations((prev) => {
        let targetId = activeId;
        let convList = [...prev];

        // If no active conversation exists, create one immediately
        if (!targetId || !convList.some((c) => c.id === targetId)) {
          const freshConv = {
            id: generateId(),
            userId,
            title: message.role === 'user' ? generateTitle(message.content) : 'New Chat',
            summary: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: [message],
            syncStatus: 'pending',
          };
          setActiveId(freshConv.id);

          conversationRepository.saveConversation(freshConv).catch(console.error);
          conversationRepository.saveMessage({
            ...message,
            conversationId: freshConv.id,
            userId,
          }).catch(console.error);

          syncQueueRepository.enqueue({
            userId,
            entityType: 'conversation',
            entityId: freshConv.id,
            operation: 'upsert',
            payload: freshConv,
          }).catch(console.error);

          return [freshConv, ...convList];
        }

        return convList.map((conv) => {
          if (conv.id !== targetId) return conv;

          const isFirstUserMessage =
            conv.messages.length === 0 && message.role === 'user';
          const title =
            isFirstUserMessage && conv.title === 'New Chat'
              ? generateTitle(message.content)
              : conv.title;

          const updatedConv = {
            ...conv,
            title,
            updatedAt: new Date().toISOString(),
            lastMessageAt: new Date().toISOString(),
            messages: [...conv.messages, message],
          };

          // Save message and updated conversation to IndexedDB
          conversationRepository.saveMessage({
            ...message,
            conversationId: conv.id,
            userId,
            sequence: conv.messages.length,
          }).catch(console.error);

          conversationRepository.saveConversation(updatedConv).catch(console.error);

          // Enqueue sync for message
          syncQueueRepository.enqueue({
            userId,
            entityType: 'message',
            entityId: message.id,
            operation: 'upsert',
            payload: {
              ...message,
              conversationId: conv.id,
              sequence: conv.messages.length,
            },
          }).catch(console.error);

          return updatedConv;
        });
      });
    },
    [activeId, userId]
  );

  /**
   * Update a specific message
   */
  const updateMessage = useCallback(
    (messageId, updates) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== activeId) return conv;
          const updatedMessages = conv.messages.map((m) => {
            if (m.id !== messageId) return m;
            const updated = { ...m, ...updates };
            conversationRepository.saveMessage(updated).catch(console.error);
            return updated;
          });
          return {
            ...conv,
            updatedAt: new Date().toISOString(),
            messages: updatedMessages,
          };
        })
      );
    },
    [activeId]
  );

  const activeConversation =
    conversations.find((c) => c.id === activeId) || null;

  return {
    conversations,
    activeId,
    activeConversation,
    createConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    addMessage,
    updateMessage,
  };
};

export default useConversations;
