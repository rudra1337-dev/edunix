import { useState, useRef, useEffect } from 'react';
import './ChatComposer.css';

export const ChatComposer = ({
  onSendMessage,
  onStopGenerating,
  isGenerating,
  isListening,
  onStartSpeech,
  onStopSpeech,
  isSpeechSupported,
  speechError,
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea as content grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || isGenerating) return;

    const messageText = input.trim();
    setInput('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    onSendMessage(messageText);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      onStopSpeech();
    } else {
      onStartSpeech((transcript) => {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      });
    }
  };

  return (
    <div className="chat-composer-container">
      {speechError && (
        <div className="speech-error-toast" role="alert">
          <span>🎙️ {speechError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="chat-composer-form">
        <div className="composer-input-wrapper">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            disabled={isGenerating}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? 'Listening to your microphone... speak now'
                : 'Message Edunix AI... (Shift+Enter for newline)'
            }
            className={`composer-textarea ${
              isListening ? 'composer-textarea--listening' : ''
            }`}
          />

          <div className="composer-actions">
            {/* Speech-to-Text Microphone Button */}
            <button
              type="button"
              onClick={handleMicClick}
              disabled={!isSpeechSupported || isGenerating}
              className={`composer-btn composer-btn--mic ${
                isListening ? 'composer-btn--listening' : ''
              }`}
              title={
                !isSpeechSupported
                  ? 'Speech-to-text is not supported by this browser'
                  : isListening
                  ? 'Stop listening'
                  : 'Speak message (Speech-to-Text)'
              }
              aria-label={isListening ? 'Stop recording voice' : 'Record voice'}
            >
              🎙️
            </button>

            {/* Stop Generating Button or Send Button */}
            {isGenerating ? (
              <button
                type="button"
                onClick={onStopGenerating}
                className="composer-btn composer-btn--stop"
                title="Stop generation"
                aria-label="Stop generation"
              >
                ■
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="composer-btn composer-btn--send"
                title="Send message"
                aria-label="Send message"
              >
                ↑
              </button>
            )}
          </div>
        </div>
      </form>

      <div className="composer-disclaimer">
        <span>Edunix AI may produce inaccurate responses. Verify critical system commands.</span>
      </div>
    </div>
  );
};

export default ChatComposer;
