import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

interface VoiceProcessorProps {
  onVoiceCommand: (command: string, confidence: number) => void;
  onAudioData: (audioData: Float32Array) => void;
  isActive: boolean;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  grammars: unknown; // SpeechGrammarList not widely supported
  start(): void;
  stop(): void;
  abort(): void;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

export default function VoiceProcessor({ onVoiceCommand, onAudioData, isActive }: VoiceProcessorProps) {
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const [audioMetrics, setAudioMetrics] = useState({
    volume: 0,
    frequency: 0,
    lastUpdate: new Date()
  });
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Voice command processing
  const processVoiceCommand = useCallback((transcript: string, _confidence: number) => {
    const command = transcript.toLowerCase().trim();

    // Basic command processing
    if (command.includes('start') || command.includes('begin')) {
      console.log('Start command detected');
    } else if (command.includes('stop') || command.includes('end')) {
      console.log('Stop command detected');
    } else if (command.includes('wallet') || command.includes('transaction')) {
      console.log('Wallet command detected');
    }
  }, []);

  // Initialize voice recognition
  const initializeVoiceRecognition = useCallback(() => {
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          processVoiceCommand(transcript, confidence);
          onVoiceCommand(transcript, confidence);
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (isActive) {
        // Restart recognition if still active
        setTimeout(() => recognition.start(), 100);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isActive, onVoiceCommand, processVoiceCommand]);

  // Initialize audio analysis
  const initializeAudioAnalysis = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      microphone.connect(analyser);

      analyserRef.current = analyser;
      audioContextRef.current = audioContext;
      microphoneRef.current = microphone;

      setError(null);
    } catch (error) {
      console.error('Failed to initialize audio analysis:', error);
      setError('Failed to access microphone. Please check permissions.');
    }
  }, []);

  // Start audio level monitoring
  const startAudioLevelMonitoring = useCallback(() => {
    const updateAudioLevel = () => {
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const normalizedLevel = average / 255;

        setAudioLevel(normalizedLevel);

        // Update audio metrics
        setAudioMetrics(prev => ({
          ...prev,
          volume: normalizedLevel,
          frequency: dataArray[Math.floor(dataArray.length / 2)],
          lastUpdate: new Date()
        }));
      }

      if (isActive) {
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      }
    };

    updateAudioLevel();
  }, [isActive]);

  // Stop voice recognition
  const stopVoiceRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setTranscript('');
  }, []);

  // Stop audio analysis
  const stopAudioAnalysis = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    analyserRef.current = null;
    microphoneRef.current = null;
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    if (isActive) {
      initializeVoiceRecognition();
      initializeAudioAnalysis();
      startAudioLevelMonitoring();
    } else {
      stopVoiceRecognition();
      stopAudioAnalysis();
    }

    return () => {
      stopVoiceRecognition();
      stopAudioAnalysis();
    };
  }, [isActive, initializeAudioAnalysis, initializeVoiceRecognition, stopAudioAnalysis, stopVoiceRecognition, startAudioLevelMonitoring]);


  const toggleVoiceRecognition = () => {
    if (isListening) {
      stopVoiceRecognition();
    } else {
      initializeVoiceRecognition();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 m-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Voice Processing</h3>
        <div className="flex items-center gap-2">
          {isRecording ? <Volume2 className="text-green-500" size={20} /> : <VolumeX className="text-gray-400" size={20} />}
          <button
            onClick={toggleVoiceRecognition}
            className={`p-2 rounded-full transition-colors ${
              isListening 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        </div>
      </div>

      {/* Audio Level Indicator */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-gray-600">Audio Level:</span>
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-100"
              style={{ width: `${audioLevel * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Status:</span>
          <span className={`text-sm font-medium ${isListening ? 'text-green-600' : 'text-gray-400'}`}>
            {isListening ? 'Listening...' : 'Inactive'}
          </span>
        </div>
        
        {lastCommand && (
          <div className="text-sm">
            <span className="text-gray-600">Last Command:</span>
            <span className="ml-2 text-blue-600 font-medium">{lastCommand}</span>
          </div>
        )}
        
        {error && (
          <div className="text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
