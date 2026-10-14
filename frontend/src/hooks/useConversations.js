import { useState, useEffect, useCallback } from 'react';

const CONVERSATIONS_KEY = 'edunix_conversations';
const ACTIVE_CONV_KEY = 'edunix_active_conv_id';

const generateId = () =>
  `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

const generateTitle = (text) => {
  if (!text) return 'New Chat';
  const clean = text.replace(/[\n\r]+/g, ' ').trim();
  return clean.length > 36 ? `${clean.substring(0, 36)}...` : clean;
};

export const useConversations = () => {
  const [conversations, setConversations] = useState(() => {
    try {
      const saved = localStorage.getItem(CONVERSATIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved conversations, resetting.', e);
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

  // Sync conversations to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
    } catch (e) {
      console.error('Failed to save conversations to localStorage', e);
    }
  }, [conversations]);

  // Sync active conversation ID to localStorage
  useEffect(() => {
    try {
      if (activeId) {
        localStorage.setItem(ACTIVE_CONV_KEY, activeId);
      } else {
        localStorage.removeItem(ACTIVE_CONV_KEY);
      }
    } catch (e) {
      console.error('Failed to save active conversation ID', e);
    }
  }, [activeId]);

  // Ensure activeId is valid
  useEffect(() => {
    if (activeId && !conversations.some((c) => c.id === activeId)) {
      setActiveId(conversations[0]?.id || null);
    }
  }, [conversations, activeId]);

  /**
   * Start a brand new conversation
   */
  const createConversation = useCallback(() => {
    const newConv = {
      id: generateId(),
      title: 'New Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };

    setConversations((prev) => [newConv, ...prev]);
    setActiveId(newConv.id);
    return newConv;
  }, []);

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
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, title: newTitle.trim(), updatedAt: new Date().toISOString() }
          : c
      )
    );
  }, []);

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
    },
    [activeId]
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
            title: message.role === 'user' ? generateTitle(message.content) : 'New Chat',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: [message],
          };
          setActiveId(freshConv.id);
          return [freshConv, ...convList];
        }

        return convList.map((conv) => {
          if (conv.id !== targetId) return conv;

          // If conversation has default title and this is the first user message, update title
          const isFirstUserMessage =
            conv.messages.length === 0 && message.role === 'user';
          const title =
            isFirstUserMessage && conv.title === 'New Chat'
              ? generateTitle(message.content)
              : conv.title;

          return {
            ...conv,
            title,
            updatedAt: new Date().toISOString(),
            messages: [...conv.messages, message],
          };
        });
      });
    },
    [activeId]
  );

  /**
   * Update a specific message (e.g. for retry/editing)
   */
  const updateMessage = useCallback(
    (messageId, updates) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== activeId) return conv;
          return {
            ...conv,
            updatedAt: new Date().toISOString(),
            messages: conv.messages.map((m) =>
              m.id === messageId ? { ...m, ...updates } : m
            ),
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
