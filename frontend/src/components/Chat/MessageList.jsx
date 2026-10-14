import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './MessageList.css';

const STARTER_PROMPTS = [
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
  const bottomRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);

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
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isThisSpeaking = isSpeaking && speakingMessageId === msg.id;

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

                  <div className="message-content">
                    {isUser ? (
                      <p className="user-text">{msg.content}</p>
                    ) : (
                      <div className="markdown-body">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
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
