import { useState, useEffect, useRef, useCallback } from 'react';

export const useSpeechToText = () => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const isSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore already stopped
      }
      setIsListening(false);
    }
  }, []);

  const startListening = useCallback(
    (onTranscriptReceived) => {
      if (!isSupported) {
        setError('Speech recognition is not supported in this browser.');
        return;
      }

      setError(null);

      // Stop previous instance if running
      if (recognitionRef.current) {
        stopListening();
      }

      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript && onTranscriptReceived) {
          onTranscriptReceived(transcript.trim());
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setError('Microphone permission denied. Please allow microphone access.');
        } else if (event.error === 'no-speech') {
          setError('No speech detected. Please try speaking again.');
        } else if (event.error !== 'aborted') {
          setError(`Speech recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;

      try {
        recognition.start();
      } catch (err) {
        setIsListening(false);
        setError(`Failed to start microphone: ${err.message}`);
      }
    },
    [isSupported, stopListening]
  );

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    error,
    startListening,
    stopListening,
  };
};

export default useSpeechToText;
