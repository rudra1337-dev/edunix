import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import useConversations from '../../hooks/useConversations';
import useSpeechToText from '../../hooks/useSpeechToText';
import useTextToSpeech from '../../hooks/useTextToSpeech';
import chatEngineManager from '../../services/ai/ChatEngineManager';
import memoryService from '../../services/memory/memoryService';
import syncEngine from '../../services/sync/syncEngine';
import learningPlanService from '../../services/learning/learningPlanService';

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

const isSaveRoadmapIntent = (text) => {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  return (
    /(?:save|store|keep|add|remember|put)\s+(?:this\s+|the\s+)?(?:roadmap|learning\s*plan|study\s*plan|curriculum|journey)(?:\s+(?:in|to|into)\s+(?:the\s+|my\s+)?(?:memory|plan[s]?|study\s*plan|learning\s*journey))?/i.test(t) ||
    /(?:save|store|keep|remember)\s+(?:it|this)\s+(?:in|to|into)\s+(?:the\s+|my\s+)?(?:memory|plan[s]?|study\s*plan|learning\s*journey)/i.test(t) ||
    /^(?:save\s+(?:the\s+)?(?:roadmap|plan)|save\s+to\s+memory|save\s+to\s+plan|save\s+in\s+memory)$/i.test(t)
  );
};

const isPureSaveCommand = (text) => {
  if (!text) return false;
  const clean = text
    .toLowerCase()
    .replace(/[.,!?;:'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const purePhrases = [
    'save the roadmap in the memory',
    'save roadmap in the memory',
    'save roadmap in memory',
    'save this roadmap in memory',
    'save this roadmap to memory',
    'save this roadmap to my plan',
    'save this roadmap to my plans',
    'save this roadmap to study plan',
    'save roadmap to plan',
    'save roadmap to my plan',
    'save roadmap to study plan',
    'save roadmap',
    'save this roadmap',
    'save the roadmap',
    'save it in memory',
    'save it to memory',
    'save it to plan',
    'save it to my plan',
    'save to memory',
    'save to plan',
    'save in memory',
    'store roadmap in memory',
    'store this roadmap in memory',
    'remember this roadmap',
    'add this roadmap to my plan',
    'add this roadmap to my plans',
    'add roadmap to my plan',
    'save plan',
    'save this plan',
  ];
  if (purePhrases.includes(clean)) return true;
  return clean.length <= 45 && isSaveRoadmapIntent(text);
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

    // 1. Check if user issued a direct command to save a roadmap already in the chat
    if (isPureSaveCommand(text)) {
      let roadmapToSave = null;
      for (let i = existingMessages.length - 1; i >= 0; i--) {
        const m = existingMessages[i];
        if (m.role === 'assistant' && m.content) {
          if (m.savedRoadmap) {
            roadmapToSave = m.savedRoadmap;
            break;
          }
          const parsed = learningPlanService.parseAndValidateAIRoadmap(m.content, userId);
          if (parsed && parsed.success && parsed.roadmap) {
            roadmapToSave = parsed.roadmap;
            break;
          }
        }
      }

      if (roadmapToSave) {
        try {
          const savedPlan = await learningPlanService.createRoadmap({
            ...roadmapToSave,
            userId,
            status: 'active',
            source: 'chat_saved',
            conversationId: activeId,
          });

          await learningPlanService.setActiveRoadmap({ userId, planId: savedPlan.id });

          await memoryService.processCandidateMemory(userId, {
            type: 'learning_goal',
            key: 'active_roadmap',
            value: `Active study plan: ${savedPlan.title}`,
            source: 'user',
          });

          syncEngine.triggerSync(userId).catch(console.error);

          const instantMsg = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: `I've saved **${savedPlan.title}** to your Study Plan memory!\n\nYou can access your curriculum modules, track your progress, and check off topics anytime on the **[Study Plan](/study-plan)** and **[Learning Journey](/learning-journey)** pages.`,
            createdAt: new Date().toISOString(),
            roadmapSaved: true,
            savedRoadmap: {
              id: savedPlan.id,
              title: savedPlan.title,
            },
            memoryUpdated: true,
            updatedMemories: [
              {
                key: 'active_roadmap',
                value: `Active study plan: ${savedPlan.title}`,
              },
            ],
          };

          addMessage(instantMsg);
          setIsGenerating(false);
          return;
        } catch (saveErr) {
          console.error('[ChatView] Error saving roadmap to memory:', saveErr);
          // Fall through to standard generation
        }
      }
    }

    try {
      const assistantMessage = await chatEngineManager.sendMessage(payloadMessages, {
        conversationId: activeId,
        userId,
      });

      // Change-driven memory processing (non-blocking)
      let memoryUpdated = false;
      const updatedMemories = [];
      try {
        const candidates = memoryService.extractCandidates(text, assistantMessage.content);
        for (const cand of candidates) {
          const res = await memoryService.processCandidateMemory(userId, cand);
          if (res && (res.action === 'created' || res.action === 'updated' || res.action === 'superseded')) {
            memoryUpdated = true;
            if (res.memory) {
              updatedMemories.push(res.memory);
            }
          }
        }
        await memoryService.evaluateConversationSummary(activeId, [
          ...payloadMessages,
          assistantMessage,
        ]);
        // Trigger background synchronization only if memory was modified
        if (memoryUpdated) {
          syncEngine.triggerSync(userId).catch(console.error);
        }
      } catch (memErr) {
        console.warn('[ChatView] Memory processing note:', memErr.message);
      }

      // Check if user requested to save roadmap and assistant response contains a roadmap
      let savedRoadmapInfo = null;
      if (isSaveRoadmapIntent(text)) {
        const parsed = learningPlanService.parseAndValidateAIRoadmap(assistantMessage.content, userId);
        let roadmapToSave = parsed && parsed.success ? parsed.roadmap : null;

        // If not in current response, check preceding messages
        if (!roadmapToSave) {
          for (let i = existingMessages.length - 1; i >= 0; i--) {
            const m = existingMessages[i];
            if (m.role === 'assistant' && m.content) {
              if (m.savedRoadmap) {
                roadmapToSave = m.savedRoadmap;
                break;
              }
              const p = learningPlanService.parseAndValidateAIRoadmap(m.content, userId);
              if (p && p.success && p.roadmap) {
                roadmapToSave = p.roadmap;
                break;
              }
            }
          }
        }

        if (roadmapToSave) {
          try {
            const savedPlan = await learningPlanService.createRoadmap({
              ...roadmapToSave,
              userId,
              status: 'active',
              source: 'chat_saved',
              conversationId: activeId,
            });
            await learningPlanService.setActiveRoadmap({ userId, planId: savedPlan.id });
            await memoryService.processCandidateMemory(userId, {
              type: 'learning_goal',
              key: 'active_roadmap',
              value: `Active study plan: ${savedPlan.title}`,
              source: 'user',
            });
            savedRoadmapInfo = {
              id: savedPlan.id,
              title: savedPlan.title,
            };
            memoryUpdated = true;
            updatedMemories.push({
              key: 'active_roadmap',
              value: `Active study plan: ${savedPlan.title}`,
            });
            syncEngine.triggerSync(userId).catch(console.error);
          } catch (saveErr) {
            console.warn('[ChatView] Save roadmap error:', saveErr.message);
          }
        }
      }

      const finalAssistantMessage = {
        ...assistantMessage,
        memoryUpdated,
        updatedMemories,
        roadmapSaved: Boolean(savedRoadmapInfo),
        savedRoadmap: savedRoadmapInfo,
      };

      addMessage(finalAssistantMessage);
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
