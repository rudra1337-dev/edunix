import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import useConversations from '../../hooks/useConversations';
import useSpeechToText from '../../hooks/useSpeechToText';
import useTextToSpeech from '../../hooks/useTextToSpeech';
import chatEngineManager from '../../services/ai/ChatEngineManager';
import memoryService from '../../services/memory/memoryService';
import syncEngine from '../../services/sync/syncEngine';

import Sidebar from '../../components/Chat/Sidebar';
import ChatHeader from '../../components/Chat/ChatHeader';
import MessageList from '../../components/Chat/MessageList';
import ChatComposer from '../../components/Chat/ChatComposer';

import './ChatView.css';

export const ChatView = () => {
  const { user } = useAuth();
  const userId = user?.id || 'local-user';

  const {
    conversations,
    activeId,
    activeConversation,
    createConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    addMessage,
  } = useConversations(userId);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiMode, setAiMode] = useState(() => chatEngineManager.getMode());
  const [engineStatus, setEngineStatus] = useState(null);
  const [syncState, setSyncState] = useState(syncEngine.state);
  const [isGenerating, setIsGenerating] = useState(false);
  const [requestError, setRequestError] = useState(null);

  // Speech-to-Text hook
  const {
    isSupported: isSpeechSupported,
    isListening,
    error: speechError,
    startListening,
    stopListening,
  } = useSpeechToText();

  // Text-to-Speech hook
  const {
    isSpeaking,
    speakingMessageId,
    speak,
    stop: stopSpeaking,
  } = useTextToSpeech();

  // Check backend engine availability status
  const fetchStatus = useCallback(async () => {
    const status = await chatEngineManager.checkStatus();
    setEngineStatus(status);
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Initialize syncEngine and listen for sync state changes
  useEffect(() => {
    syncEngine.initialize();
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState({ ...state });
    });
    return () => unsubscribe();
  }, []);

  // Stop speech if conversation changes
  useEffect(() => {
    stopSpeaking();
    setRequestError(null);
  }, [activeId, stopSpeaking]);

  const handleModeChange = (newMode) => {
    chatEngineManager.setMode(newMode);
    setAiMode(newMode);
    fetchStatus();
  };

  const handleSendMessage = async (text) => {
    if (!text.trim() || isGenerating) return;

    setRequestError(null);

    const userMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    // Add user message to active conversation
    addMessage(userMessage);

    // Prepare message payload
    const existingMessages = activeConversation?.messages || [];
    const payloadMessages = [...existingMessages, userMessage];

    setIsGenerating(true);

    try {
      const assistantMessage = await chatEngineManager.sendMessage(payloadMessages, {
        conversationId: activeId,
        userId,
      });

      addMessage(assistantMessage);

      // Change-driven memory processing (non-blocking)
      try {
        const candidates = memoryService.extractCandidates(text, assistantMessage.content);
        for (const cand of candidates) {
          await memoryService.processCandidateMemory(userId, cand);
        }
        await memoryService.evaluateConversationSummary(activeId, [
          ...payloadMessages,
          assistantMessage,
        ]);
        // Trigger background synchronization
        syncEngine.triggerSync(userId).catch(console.error);
      } catch (memErr) {
        console.warn('[ChatView] Memory processing note:', memErr.message);
      }
    } catch (err) {
      console.error('Chat generation error:', err);
      setRequestError(
        err.message || 'An error occurred while generating the response.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetry = async () => {
    if (isGenerating) return;
    const existingMessages = activeConversation?.messages || [];
    if (existingMessages.length === 0) return;

    setRequestError(null);
    setIsGenerating(true);

    try {
      const assistantMessage = await chatEngineManager.sendMessage(
        existingMessages,
        { conversationId: activeId, userId }
      );
      addMessage(assistantMessage);
    } catch (err) {
      console.error('Chat generation retry error:', err);
      setRequestError(
        err.message || 'An error occurred while generating the response.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStopGenerating = () => {
    chatEngineManager.cancelActiveRequest();
    setIsGenerating(false);
  };

  const messages = activeConversation?.messages || [];

  return (
    <div className="chat-layout">
      {/* ChatGPT-style Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={createConversation}
        onSelectChat={selectConversation}
        onRenameChat={renameConversation}
        onDeleteChat={deleteConversation}
      />

      {/* Main Chat Viewport */}
      <div className="chat-main">
        <ChatHeader
          title={activeConversation?.title}
          mode={aiMode}
          onModeChange={handleModeChange}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          status={engineStatus}
          isGenerating={isGenerating}
          syncState={syncState}
          onTriggerSync={() => syncEngine.triggerSync(userId)}
        />

        <MessageList
          messages={messages}
          isGenerating={isGenerating}
          error={requestError}
          onRetry={handleRetry}
          onSelectPrompt={(prompt) => handleSendMessage(prompt)}
          onSpeak={speak}
          onStopSpeak={stopSpeaking}
          speakingMessageId={speakingMessageId}
          isSpeaking={isSpeaking}
        />

        <ChatComposer
          onSendMessage={handleSendMessage}
          onStopGenerating={handleStopGenerating}
          isGenerating={isGenerating}
          isListening={isListening}
          onStartSpeech={startListening}
          onStopSpeech={stopListening}
          isSpeechSupported={isSpeechSupported}
          speechError={speechError}
        />
      </div>
    </div>
  );
};

export default ChatView;
