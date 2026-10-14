import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../../context/AuthContext';
import learningPlanService from '../../services/learning/learningPlanService';
import syncEngine from '../../services/sync/syncEngine';
import './MessageList.css';

const STARTER_PROMPTS = [
  {
    icon: '🗺️',
    title: 'Generate Learning Roadmap',
    prompt: 'Create a complete structured learning roadmap for mastering Linux Systems Programming and DevOps.',
  },
  {
    icon: '🐧',
    title: 'Explain Unix Processes',
    prompt: 'Can you explain how processes, PID, and fork/exec work in Unix-like operating systems?',
  },
  {
    icon: '🔄',
    title: 'Pipes and Redirection',
    prompt: 'How do standard input, standard output, standard error, and pipes (|) interact in bash?',
  },
  {
    icon: '🔐',
    title: 'File Permissions Deep Dive',
    prompt: 'Explain Unix file permissions (chmod, chown, 755 vs 644, and octal notation) with examples.',
  },
  {
    icon: '📜',
    title: 'Bash Scripting Best Practices',
    prompt: 'What are the top best practices and safety flags (set -euo pipefail) for writing robust bash scripts?',
  },
];

function AssistantRoadmapCard({ content, userId, onOpenRoadmap, isRoadmapRequested }) {
  const [saving, setSaving] = useState(false);

  const roadmapData = useMemo(() => {
    // Only attempt roadmap parsing if explicitly requested or content is explicitly tagged as roadmap
    if (!content || !isRoadmapRequested) return null;
    const res = learningPlanService.parseAndValidateAIRoadmap(content);
    return res && res.success ? res.roadmap : null;
  }, [content, isRoadmapRequested]);

  if (!roadmapData) return null;

  const handleOpen = async () => {
    try {
      setSaving(true);
      const plan = await learningPlanService.createRoadmap({
        ...roadmapData,
        userId,
        status: 'active',
        source: 'ai_generated',
      });
      await learningPlanService.setActiveRoadmap({ userId, planId: plan.id });
      syncEngine.triggerSync(userId).catch(console.error);
      if (onOpenRoadmap) onOpenRoadmap(plan.id);
    } catch (err) {
      console.error('Failed to open roadmap from chat:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="chat-roadmap-card">
      <div className="chat-roadmap-header">
        <span className="chat-roadmap-badge">🗺️ Interactive Learning Roadmap</span>
        <span className="chat-roadmap-sections">
          {roadmapData.sections?.length || 1} Modules • {roadmapData.items?.length || 0} Topics
        </span>
      </div>
      <h4 className="chat-roadmap-title">{roadmapData.title}</h4>
      <p className="chat-roadmap-goal">{roadmapData.summary || roadmapData.goal}</p>
      <div className="chat-roadmap-actions">
        <button
          type="button"
          className="chat-roadmap-save-btn"
          onClick={handleOpen}
          disabled={saving}
        >
          {saving ? 'Opening Notion Roadmap...' : '📑 Open in Learning Journey →'}
        </button>
      </div>
    </div>
  );
}

export const MessageList = ({
  messages,
  isGenerating,
  error,
  onRetry,
  onSelectPrompt,
  onSpeak,
  onStopSpeak,
  speakingMessageId,
  isSpeaking,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || 'local-user';
  const bottomRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);

  const handleOpenRoadmap = (planId) => {
    navigate(`/learning-journey/${planId}`);
  };

  // Auto-scroll on new message or generating state change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating, error]);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="message-list-container">
      {messages.length === 0 ? (
        <div className="chat-empty-state">
          <div className="empty-state-badge">
            <span className="empty-state-icon">⚡</span>
          </div>
          <h1 className="empty-state-title">How can Edunix help you learn today?</h1>
          <p className="empty-state-subtitle">
            Ask questions about Linux, Unix systems, scripting, or DevOps. Edunix operates
            seamlessly in Online and Offline local environments.
          </p>

          <div className="starter-prompts-grid">
            {STARTER_PROMPTS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className="starter-prompt-card"
                onClick={() => onSelectPrompt(item.prompt)}
              >
                <span className="starter-card-icon">{item.icon}</span>
                <div className="starter-card-content">
                  <span className="starter-card-title">{item.title}</span>
                  <span className="starter-card-prompt">{item.prompt}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="message-thread">
          {messages.map((msg, msgIndex) => {
            const isUser = msg.role === 'user';
            const isThisSpeaking = isSpeaking && speakingMessageId === msg.id;

            // Determine if the user's prompt or assistant's response was explicitly a roadmap request
            const prevUserMsg =
              msgIndex > 0 && messages[msgIndex - 1]?.role === 'user'
                ? messages[msgIndex - 1].content
                : '';
            const isRoadmapRequested =
              /(?:create|generate|build|make|show|give\s+me)\s+(?:a\s+)?(?:learning\s+)?(?:roadmap|study\s*plan|learning\s*plan|curriculum)/i.test(
                prevUserMsg
              ) ||
              /(?:here\s+is\s+your\s+(?:learning\s+)?roadmap|structured\s+learning\s+roadmap|notion\s+roadmap)/i.test(
                msg.content
              );

            return (
              <div
                key={msg.id}
                className={`message-row ${
                  isUser ? 'message-row--user' : 'message-row--assistant'
                }`}
              >
                <div className="message-avatar">
                  {isUser ? <span>👤</span> : <span>⚡</span>}
                </div>

                <div className="message-bubble-wrapper">
                  <div className="message-sender-name">
                    {isUser ? 'You' : 'Edunix AI'}
                  </div>

                  {/* Fallback Notice Badge if response came from Ollama fallback */}
                  {msg.fallback && (
                    <div className="message-fallback-banner">
                      <span className="fallback-badge">⚡ Auto Fallback</span>
                      <span>{msg.fallbackNotice || 'Generated via Local AI (Ollama)'}</span>
                    </div>
                  )}

                  {/* ChatGPT-style Memory Updated Pill */}
                  {msg.memoryUpdated && (
                    <div className="chatgpt-memory-pill">
                      <span className="memory-pill-icon">🧠</span>
                      <span className="memory-pill-label">Memory updated</span>
                      {msg.updatedMemories?.length > 0 && (
                        <span
                          className="memory-pill-detail"
                          title={msg.updatedMemories.map((m) => `${m.key}: ${m.value}`).join(', ')}
                        >
                          &bull; {msg.updatedMemories[0].value}
                        </span>
                      )}
                    </div>
                  )}

                  {/* ChatGPT-style Roadmap Saved to Plan Pill */}
                  {msg.roadmapSaved && msg.savedRoadmap && (
                    <div className="chatgpt-roadmap-pill">
                      <span className="roadmap-pill-icon">🗺️</span>
                      <span className="roadmap-pill-label">Roadmap saved to Study Plan</span>
                      <Link
                        to={`/learning-journey/${msg.savedRoadmap.id}`}
                        className="roadmap-pill-link"
                        title="Open in Learning Journey"
                      >
                        {msg.savedRoadmap.title} &rarr;
                      </Link>
                    </div>
                  )}

                  <div className="message-content">
                    {isUser ? (
                      <p className="user-text">{msg.content}</p>
                    ) : (
                      <div className="markdown-body">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        <AssistantRoadmapCard
                          content={msg.content}
                          userId={userId}
                          onOpenRoadmap={handleOpenRoadmap}
                          isRoadmapRequested={isRoadmapRequested}
                        />
                      </div>
                    )}
                  </div>

                  {/* Assistant Message Actions */}
                  {!isUser && (
                    <div className="message-actions-toolbar">
                      {/* Copy Action */}
                      <button
                        type="button"
                        className="msg-action-btn"
                        onClick={() => handleCopy(msg.content, msg.id)}
                        title="Copy message"
                      >
                        {copiedId === msg.id ? '✓ Copied' : '📋 Copy'}
                      </button>

                      {/* Text-to-Speech Action */}
                      <button
                        type="button"
                        className={`msg-action-btn ${
                          isThisSpeaking ? 'msg-action-btn--speaking' : ''
                        }`}
                        onClick={() => {
                          if (isThisSpeaking) {
                            onStopSpeak();
                          } else {
                            onSpeak(msg.content, msg.id);
                          }
                        }}
                        title={isThisSpeaking ? 'Stop speaking' : 'Read aloud'}
                      >
                        {isThisSpeaking ? '⏹ Stop Audio' : '🔊 Listen'}
                      </button>

                      {/* Engine Tag */}
                      {msg.engine && (
                        <span className="msg-engine-tag">
                          {msg.engine === 'ollama' ? '💻 Ollama' : '🌐 Online'}
                          {msg.model ? ` (${msg.model})` : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Generating Loading State */}
          {isGenerating && (
            <div className="message-row message-row--assistant">
              <div className="message-avatar">
                <span>⚡</span>
              </div>
              <div className="message-bubble-wrapper">
                <div className="message-sender-name">Edunix AI</div>
                <div className="generating-indicator">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                  <span className="generating-text">Generating response...</span>
                </div>
              </div>
            </div>
          )}

          {/* Request Error State */}
          {error && (
            <div className="chat-error-card" role="alert">
              <div className="chat-error-header">
                <span className="chat-error-icon">⚠️</span>
                <span className="chat-error-title">Unable to generate response</span>
              </div>
              <p className="chat-error-message">{error}</p>
              <div className="chat-error-actions">
                <button
                  type="button"
                  className="chat-error-retry-btn"
                  onClick={onRetry}
                >
                  🔄 Retry Request
                </button>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};

export default MessageList;
