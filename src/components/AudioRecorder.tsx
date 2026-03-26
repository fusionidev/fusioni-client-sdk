import React, { useState, useRef, useCallback, useEffect } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  disabled?: boolean;
  className?: string;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete,
  disabled = false,
  className = ''
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check microphone support
  useEffect(() => {
    const checkSupport = () => {
      const isSupported = !!(
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function' &&
        window.isSecureContext
      );
      setIsSupported(isSupported);
    };

    checkSupport();
  }, []);

  const startTimer = useCallback(() => {
    setRecordingDuration(0);
    timerRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        throw new Error('MediaDevices API is not supported in this browser');
      }

      if (!window.isSecureContext) {
        throw new Error('Microphone access requires a secure context (HTTPS or localhost)');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType || 'audio/webm' 
        });
        onRecordingComplete(audioBlob, recordingDuration);
        
        // Clean up
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
      startTimer();
    } catch (err) {
      console.error('Error starting recording:', err);
      
      let errorMessage = 'Unable to access microphone. ';
      
      if (err instanceof Error) {
        if (err.message.includes('secure context')) {
          errorMessage += 'Please access this page over HTTPS or localhost.';
        } else if (err.message.includes('not supported')) {
          errorMessage += 'Your browser does not support microphone access.';
        } else if (err.name === 'NotAllowedError') {
          errorMessage += 'Microphone permission was denied. Please allow microphone access and try again.';
        } else if (err.name === 'NotFoundError') {
          errorMessage += 'No microphone found. Please connect a microphone and try again.';
        } else {
          errorMessage += 'Please check your microphone permissions and try again.';
        }
      }
      
      setError(errorMessage);
    }
  }, [onRecordingComplete, recordingDuration, startTimer]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
    }
  }, [isRecording, stopTimer]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [stopTimer]);

  if (!isSupported) {
    return null;
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`fusioni-audio-recorder ${className}`}>
      <button
        onClick={toggleRecording}
        disabled={disabled}
        className={`fusioni-btn fusioni-btn-icon ${
          isRecording ? 'fusioni-btn-recording' : ''
        }`}
        title={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? (
          <div className="fusioni-recording-indicator">
            <div className="fusioni-recording-dot" />
          </div>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="12"
              y1="19"
              x2="12"
              y2="23"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="8"
              y1="23"
              x2="16"
              y2="23"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      
      {isRecording && (
        <div className="fusioni-recording-timer">
          {formatDuration(recordingDuration)}
        </div>
      )}
      
      {error && (
        <div className="fusioni-audio-error">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
    </div>
  );
};
