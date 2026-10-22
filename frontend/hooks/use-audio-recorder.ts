'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { transcodeBlobToWav, generateWavFilename } from '@/lib/audio/wav-encoder';

export type RecorderStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'paused'
  | 'recorded'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error';

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export function useAudioRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [duration, setDuration] = useState<number>(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [wavBlob, setWavBlob] = useState<Blob | null>(null);
  const [wavFilename, setWavFilename] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'permission' | 'device' | 'transcode' | 'general' | null>(null);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(32).fill(4));

  // Internal refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  // Enumerate input devices
  const refreshDevices = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => {
          let label = d.label ? d.label.trim() : '';
          const deviceId = d.deviceId || (i === 0 ? 'default' : `mic-${i + 1}`);
          if (!label) {
            label = deviceId === 'default' ? 'Default Microphone' : `Audio Input ${i + 1}`;
          }
          return {
            deviceId,
            label,
          };
        });

      if (audioInputs.length === 0) {
        setDevices([{ deviceId: 'default', label: 'Default Microphone' }]);
        setSelectedDeviceId((prev) => prev || 'default');
      } else {
        setDevices(audioInputs);
        setSelectedDeviceId((prev) => {
          if (prev && audioInputs.some((d) => d.deviceId === prev)) {
            return prev;
          }
          return audioInputs[0].deviceId;
        });
      }
    } catch (e) {
      console.warn('Failed to enumerate audio devices:', e);
      setDevices([{ deviceId: 'default', label: 'Default Microphone' }]);
      setSelectedDeviceId((prev) => prev || 'default');
    }
  }, []);

  const requestMicrophonePermission = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      await refreshDevices();
      return true;
    } catch (e) {
      console.warn('Microphone permission request failed:', e);
      return false;
    }
  }, [refreshDevices]);

  useEffect(() => {
    refreshDevices();
    if (typeof window !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      const handleDeviceChange = () => {
        refreshDevices();
      };
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, [refreshDevices]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  const cleanupResources = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    mediaRecorderRef.current = null;
  };

  // Real-time audio spectrum visualization loop with 32 frequency bins
  const startVisualizer = (stream: MediaStream) => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // Yields 32 bins
      analyser.smoothingTimeConstant = 0.82;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const renderFrame = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Map byte data (0..255) to visually balanced bar heights (4..60)
        const levels = Array.from(dataArray).map((val) => {
          const normalized = val / 255;
          return Math.max(4, Math.round(normalized * 60));
        });

        setAudioLevels(levels);
        animationFrameRef.current = requestAnimationFrame(renderFrame);
      };

      renderFrame();
    } catch (e) {
      console.warn('Audio visualization initialization failed:', e);
    }
  };

  const startRecording = async () => {
    setErrorMessage(null);
    setErrorType(null);
    setStatus('requesting');

    try {
      cleanupResources();

      const constraints: MediaStreamConstraints = {
        audio:
          selectedDeviceId && selectedDeviceId !== 'default'
            ? { deviceId: { exact: selectedDeviceId } }
            : true,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (streamErr: unknown) {
        if (selectedDeviceId && selectedDeviceId !== 'default') {
          console.warn('Exact device constraint failed; retrying with default microphone:', streamErr);
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          throw streamErr;
        }
      }
      mediaStreamRef.current = stream;

      // Determine supported MIME type
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        const rawBlob = new Blob(recordedChunksRef.current, { type: mimeType });
        const generatedName = generateWavFilename();
        setWavFilename(generatedName);

        // Convert to valid 16-bit PCM WAV container
        try {
          const wav = await transcodeBlobToWav(rawBlob);
          setWavBlob(wav);
          const previewUrl = URL.createObjectURL(wav);
          setAudioUrl(previewUrl);
        } catch (e) {
          console.error('WAV transcoding error:', e);
          const fallbackUrl = URL.createObjectURL(rawBlob);
          setWavBlob(rawBlob);
          setAudioUrl(fallbackUrl);
        }

        // Release microphone tracks
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        // Reset visualizer levels to calm baseline
        setAudioLevels(new Array(32).fill(4));
        setStatus('recorded');
      };

      recorder.start(250); // Slice every 250ms
      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;
      setDuration(0);

      // Start duration timer
      timerIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);
      }, 100);

      startVisualizer(stream);
      setStatus('recording');
      await refreshDevices();
    } catch (err: unknown) {
      console.error('Permission / recorder initialization error:', err);
      let message = 'Microphone access denied or unavailable.';
      let type: 'permission' | 'device' | 'general' = 'general';

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'Microphone permission was denied. Please allow microphone access in your browser settings to record meetings.';
          type = 'permission';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = 'No compatible audio input device detected. Please connect a microphone.';
          type = 'device';
        } else {
          message = err.message;
        }
      }

      setErrorMessage(message);
      setErrorType(type);
      setStatus('error');
      cleanupResources();
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      pausedTimeRef.current = Date.now();
      setStatus('paused');
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      const pauseDuration = Date.now() - pausedTimeRef.current;
      startTimeRef.current += pauseDuration;

      timerIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);
      }, 100);

      if (mediaStreamRef.current) {
        startVisualizer(mediaStreamRef.current);
      }
      setStatus('recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const discardRecording = () => {
    cleanupResources();
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setWavBlob(null);
    setWavFilename('');
    setDuration(0);
    setAudioLevels(new Array(32).fill(4));
    setErrorMessage(null);
    setErrorType(null);
    setStatus('idle');
  };

  /**
   * Directly load an uploaded audio file (WAV, MP3, M4A, WebM, etc.)
   */
  const loadAudioFile = async (file: File) => {
    cleanupResources();
    setErrorMessage(null);
    setErrorType(null);
    setStatus('requesting');

    try {
      setWavFilename(file.name);
      const objectUrl = URL.createObjectURL(file);

      // Attempt to transcode to PCM WAV if not already clean WAV
      let finalBlob: Blob = file;
      try {
        finalBlob = await transcodeBlobToWav(file);
      } catch {
        finalBlob = file;
      }

      setWavBlob(finalBlob);
      setAudioUrl(objectUrl);

      // Measure duration via Audio element
      const tempAudio = new Audio(objectUrl);
      tempAudio.addEventListener('loadedmetadata', () => {
        setDuration(tempAudio.duration || 45);
        setStatus('recorded');
      });
      tempAudio.addEventListener('error', () => {
        // Still proceed with estimated duration
        setDuration(Math.max(15, Math.round(file.size / 32000)));
        setStatus('recorded');
      });
    } catch (e: any) {
      console.error('File load error:', e);
      setErrorMessage(e.message || 'Failed to load audio file.');
      setErrorType('transcode');
      setStatus('error');
    }
  };

  return {
    status,
    setStatus,
    duration,
    audioUrl,
    wavBlob,
    wavFilename,
    errorMessage,
    errorType,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    audioLevels,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    discardRecording,
    loadAudioFile,
    refreshDevices,
    requestMicrophonePermission,
  };
}
