import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle, X } from 'lucide-react';

export default function VoiceInputButton({ onTranscript, disabled = false }) {
  const [isListening, setIsListening] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [language, setLanguage] = useState('en-IN'); // en-IN, hi-IN, ur-IN
  const [errorNotice, setErrorNotice] = useState('');
  const recognitionRef = useRef(null);
  const userStoppedRef = useRef(false);

  const supportedLanguages = [
    { code: 'en-IN', label: 'English (India)' },
    { code: 'hi-IN', label: 'हिन्दी (Hindi)' },
    { code: 'ur-IN', label: 'اردو (Urdu)' },
  ];

  // Helper to initialize or re-initialize recognition instance
  const initRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorNotice('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsListening(true);
        setIsInitializing(false);
        setErrorNotice('');
      };

      recognition.onresult = (event) => {
        let transcriptChunk = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            transcriptChunk += event.results[i][0].transcript;
          }
        }
        if (transcriptChunk.trim()) {
          onTranscript(transcriptChunk.trim());
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error event:', event.error);
        setIsListening(false);
        setIsInitializing(false);

        switch (event.error) {
          case 'not-allowed':
          case 'service-not-allowed':
            setErrorNotice('Microphone access blocked. Please allow microphone permissions in your browser URL bar.');
            break;
          case 'no-speech':
            setErrorNotice('No speech detected. Please speak clearly into your microphone.');
            break;
          case 'network':
            setErrorNotice('Network error. Speech recognition requires an active internet connection.');
            break;
          case 'audio-capture':
            setErrorNotice('No microphone found or it is being used by another application.');
            break;
          case 'aborted':
            // Ignored if user intentionally clicked stop
            if (!userStoppedRef.current) {
              setErrorNotice('Speech listening was interrupted.');
            }
            break;
          default:
            setErrorNotice(`Voice input error: ${event.error}`);
            break;
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setIsInitializing(false);
      };

      return recognition;
    } catch (err) {
      console.error('Failed to construct SpeechRecognition:', err);
      setErrorNotice('Unable to initialize speech recognition.');
      return null;
    }
  };

  useEffect(() => {
    recognitionRef.current = initRecognition();

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, [language]);

  const toggleListening = async () => {
    setErrorNotice('');
    userStoppedRef.current = false;

    // If currently listening, stop immediately
    if (isListening) {
      userStoppedRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      setIsListening(false);
      return;
    }

    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorNotice('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    setIsInitializing(true);

    // Explicitly request microphone access via getUserMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Release tracks immediately so SpeechRecognition can take over the mic hardware
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        setIsInitializing(false);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorNotice('Microphone access blocked. Click the lock/tune icon in your address bar to allow mic permissions.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setErrorNotice('No microphone detected. Please connect an audio input device.');
        } else {
          setErrorNotice(`Microphone permission error: ${err.message || 'Access denied'}`);
        }
        return;
      }
    }

    // Re-create or refresh recognition instance with current language
    const recognition = initRecognition();
    recognitionRef.current = recognition;

    if (recognition) {
      try {
        recognition.lang = language;
        recognition.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        setIsInitializing(false);
        setIsListening(false);
        setErrorNotice('Could not start microphone listening. Please try again.');
      }
    }
  };

  return (
    <div className="relative flex flex-col items-start gap-1">
      <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-white/10 shadow-inner">
        {/* Language Selector Dropdown */}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={isListening || isInitializing || disabled}
          className="bg-transparent text-xs text-slate-300 font-medium px-2 py-1 outline-none cursor-pointer hover:text-white rounded-lg transition-colors disabled:opacity-50"
          title="Select Voice Language (English, Hindi, Urdu)"
        >
          {supportedLanguages.map((l) => (
            <option key={l.code} value={l.code} className="bg-slate-900 text-slate-200">
              {l.label}
            </option>
          ))}
        </select>

        {/* Mic Toggle Button */}
        <button
          type="button"
          onClick={toggleListening}
          disabled={disabled || isInitializing}
          className={`relative px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
            isListening
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 ring-2 ring-rose-400/50'
              : isInitializing
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'hover:bg-white/10 text-slate-300 hover:text-cyan-400'
          }`}
          title={isListening ? 'Click to stop listening' : `Click to speak in ${language}`}
        >
          {isListening ? (
            <>
              {/* Equalizer animation bars */}
              <div className="flex items-center gap-0.5 h-3.5">
                <span className="w-0.5 bg-white rounded-full animate-[bounce_0.8s_infinite_100ms] h-3"></span>
                <span className="w-0.5 bg-white rounded-full animate-[bounce_0.8s_infinite_250ms] h-3.5"></span>
                <span className="w-0.5 bg-white rounded-full animate-[bounce_0.8s_infinite_400ms] h-2"></span>
                <span className="w-0.5 bg-white rounded-full animate-[bounce_0.8s_infinite_200ms] h-3"></span>
              </div>
              <span className="text-[11px] font-semibold tracking-wide">Listening...</span>
            </>
          ) : isInitializing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[11px]">Connecting...</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span className="text-[11px]">Voice</span>
            </>
          )}
        </button>
      </div>

      {/* Clear error alert banner if an issue occurred */}
      {errorNotice && (
        <div className="absolute top-full left-0 mt-1 z-30 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-950/90 border border-rose-500/40 text-rose-200 text-xs shadow-xl backdrop-blur-md max-w-sm">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span className="text-[11px] leading-tight flex-1">{errorNotice}</span>
          <button
            type="button"
            onClick={() => setErrorNotice('')}
            className="p-0.5 hover:bg-rose-900/50 rounded text-rose-300 hover:text-white"
            title="Dismiss error"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
