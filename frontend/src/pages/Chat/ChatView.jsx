import { useState, useEffect, useCallback } from 'react';
import useConversations from '../../hooks/useConversations';
import useSpeechToText from '../../hooks/useSpeechToText';
import useTextToSpeech from '../../hooks/useTextToSpeech';
import chatEngineManager from '../../services/ai/ChatEngineManager';

import Sidebar from '../../components/Chat/Sidebar';
import ChatHeader from '../../components/Chat/ChatHeader';
import MessageList from '../../components/Chat/MessageList';
import ChatComposer from '../../components/Chat/ChatComposer';

import './ChatView.css';

export const ChatView = () => {
  const {
    conversations,
    activeId,
    activeConversation,
    createConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    addMessage,
  } = useConversations();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiMode, setAiMode] = useState(() => chatEngineManager.getMode());
  const [engineStatus, setEngineStatus] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const [lastUserPrompt, setLastUserPrompt] = useState('');

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
    setLastUserPrompt(text);

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
      });

      addMessage(assistantMessage);
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
        { conversationId: activeId }
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
