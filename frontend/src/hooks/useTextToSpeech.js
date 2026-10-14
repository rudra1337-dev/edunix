import { useState, useEffect, useCallback, useRef } from 'react';

export const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [error, setError] = useState(null);
  const utteranceRef = useRef(null);

  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stop = useCallback(() => {
    if (isSupported && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setSpeakingMessageId(null);
  }, [isSupported]);

  const speak = useCallback(
    (text, messageId) => {
      if (!isSupported) {
        setError('Text-to-speech is not supported by this browser.');
        return;
      }

      // If already speaking this message, toggle off
      if (isSpeaking && speakingMessageId === messageId) {
        stop();
        return;
      }

      // Cancel any ongoing speech
      stop();
      setError(null);

      // Clean markdown formatting characters from text for natural speech
      const plainText = text
        .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[*_#~>[\]]/g, '')
        .trim();

      if (!plainText) return;

      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select English or natural voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find((v) => v.lang.startsWith('en') && !v.localService) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setSpeakingMessageId(messageId);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
      };

      utterance.onerror = (e) => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          setError(`Speech synthesis error: ${e.error}`);
        }
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, isSpeaking, speakingMessageId, stop]
  );

  useEffect(() => {
    return () => {
      if (isSupported && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return {
    isSupported,
    isSpeaking,
    speakingMessageId,
    error,
    speak,
    stop,
  };
};

export default useTextToSpeech;
