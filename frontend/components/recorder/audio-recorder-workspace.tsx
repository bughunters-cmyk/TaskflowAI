'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { useWorkspace } from '@/lib/context/workspace-context';
import { ziroApi } from '@/lib/api/client';
import { downloadWavFile } from '@/lib/audio/wav-encoder';
import { AiProcessingDeck } from '@/components/recorder/ai-processing-deck';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mic,
  Pause,
  Play,
  Square,
  Trash2,
  Upload,
  Download,
  AlertCircle,
  Loader2,
  Volume2,
  Sparkles,
  RefreshCw,
  Radio,
  ChevronRight,
  Check,
} from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function AudioRecorderWorkspace() {
  const router = useRouter();
  const { addMeeting, isDemoMode, addToast } = useWorkspace();
  const recorder = useAudioRecorder();

  const [activeTab, setActiveTab] = useState<'mic' | 'upload'>('mic');
  const [processingStage, setProcessingStage] = useState<number>(0);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [justSwitchedDevice, setJustSwitchedDevice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadedFileRef = useRef<File | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Sync audio player time
  const handleAudioTimeUpdate = () => {
    if (audioPlayerRef.current) {
      setPlaybackTime(audioPlayerRef.current.currentTime);
    }
  };

  const handleAudioEnded = () => {
    setIsPlayingAudio(false);
    setPlaybackTime(0);
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current) return;
    if (isPlayingAudio) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleDownloadWav = () => {
    if (recorder.wavBlob) {
      downloadWavFile(recorder.wavBlob, recorder.wavFilename);
      addToast({
        title: 'WAV Exported',
        message: `Saved ${recorder.wavFilename} (16-bit linear PCM).`,
        type: 'success',
      });
    }
  };

  const handleDeviceChange = (deviceId: string) => {
    recorder.setSelectedDeviceId(deviceId);
    setJustSwitchedDevice(true);
    const matchedDevice = recorder.devices.find((d) => d.deviceId === deviceId);
    if (matchedDevice) {
      addToast({
        title: 'Microphone Updated',
        message: `Active input: ${matchedDevice.label}`,
        type: 'info',
      });
    }
    setTimeout(() => {
      setJustSwitchedDevice(false);
    }, 1500);
  };

  const handleUploadAndAnalyze = async () => {
    const targetBlob = recorder.wavBlob || uploadedFileRef.current;
    const targetFilename = recorder.wavFilename || uploadedFileRef.current?.name || 'meeting_recording.wav';

    if (!targetBlob) {
      addToast({
        title: 'No Audio File Found',
        message: 'Please select an audio file or record audio before analyzing.',
        type: 'error',
      });
      return;
    }

    recorder.setStatus('processing');
    setProcessingStage(0);
    setProcessingError(null);

    // Staged progress cadence across the 5 steps
    const stageTimer = setInterval(() => {
      setProcessingStage((prev) => {
        if (prev < 3) return prev + 1;
        return prev;
      });
    }, 600);

    try {
      const analyzedMeeting = await ziroApi.analyzeAudio(
        targetBlob,
        targetFilename,
        undefined,
        isDemoMode
      );

      clearInterval(stageTimer);
      setProcessingStage(4); // Step 5: Review ready
      recorder.setStatus('success');

      // Add to global state
      addMeeting(analyzedMeeting);

      if (analyzedMeeting.reused) {
        addToast({
          title: 'Duplicate Audio Detected',
          message: 'An identical recording was previously analyzed. Loaded existing intelligence session.',
          type: 'info',
        });
      } else {
        addToast({
          title: 'Analysis Complete',
          message: `Extracted ${analyzedMeeting.confirmed_tasks.length} confirmed actions & ${analyzedMeeting.clarifications_needed.length} clarifications.`,
          type: 'success',
        });
      }

      // Navigate to meetings review board
      setTimeout(() => {
        router.push(`/meetings?id=${analyzedMeeting.id}`);
      }, 1000);
    } catch (err: any) {
      clearInterval(stageTimer);
      recorder.setStatus('error');
      setProcessingError(err.message || 'Error communicating with analysis service.');
      addToast({
        title: 'Analysis Failed',
        message: err.message || 'Failed to process audio recording.',
        type: 'error',
      });
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleSelectedFile = async (file: File) => {
    const validExtensions = ['.wav', '.mp3', '.m4a', '.webm', '.ogg', '.flac'];
    const nameLower = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => nameLower.endsWith(ext));

    if (!isValid) {
      addToast({
        title: 'Unsupported Format',
        message: 'Please upload an audio file: WAV, MP3, M4A, WebM, OGG, or FLAC.',
        type: 'error',
      });
      return;
    }

    uploadedFileRef.current = file;

    try {
      await recorder.loadAudioFile(file);
      addToast({
        title: 'Audio File Loaded',
        message: `Loaded ${file.name} (${Math.round(file.size / 1024)} KB).`,
        type: 'info',
      });
    } catch {
      recorder.setStatus('recorded');
    }
  };

  // If in processing, success, or processing-error state, show dedicated AI Processing Deck!
  if (
    recorder.status === 'processing' ||
    recorder.status === 'uploading' ||
    recorder.status === 'success' ||
    (recorder.status === 'error' && Boolean(processingError))
  ) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-8 sm:py-10 flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
        <motion.div
          key="processing-deck"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25 }}
          className="w-full flex justify-center"
        >
          <AiProcessingDeck
            currentStage={processingStage}
            status={recorder.status === 'error' ? 'error' : recorder.status === 'success' ? 'success' : 'processing'}
            errorMessage={processingError}
            onRetry={handleUploadAndAnalyze}
            onCancel={recorder.discardRecording}
            audioFilename={recorder.wavFilename}
            fileSizeKb={recorder.wavBlob ? Math.round(recorder.wavBlob.size / 1024) : undefined}
          />
        </motion.div>
      </div>
    );
  }

  // Precomputed idle waveform bars (gentle subtle wave pattern)
  const idleBars = [
    6, 8, 12, 16, 20, 24, 28, 22, 16, 12, 18, 26, 32, 28, 20, 14,
    14, 20, 28, 32, 26, 18, 12, 16, 22, 28, 24, 20, 16, 12, 8, 6,
  ];

  return (
    <motion.div
      key="recording-workspace"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="max-w-4xl mx-auto px-4 py-4 sm:px-6 sm:py-6 flex flex-col items-center justify-center min-h-[calc(100vh-90px)]"
    >
      {/* Workspace Header with Refined Spacing */}
      <div className="text-center space-y-1.5 mb-4 sm:mb-5 select-none">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-app-border bg-app-elevated/50 text-[11px] font-mono text-app-secondary">
          <span
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-300',
              recorder.status === 'recording'
                ? 'bg-red-500 animate-record-pulse'
                : recorder.status === 'paused'
                ? 'bg-amber-500'
                : recorder.status === 'recorded'
                ? 'bg-app-accent shadow-xs'
                : 'bg-app-accent'
            )}
          />
          <span className="uppercase tracking-wider">
            {recorder.status === 'recording'
              ? 'Live Microphone Input'
              : recorder.status === 'paused'
              ? 'Recording Paused'
              : recorder.status === 'recorded'
              ? 'Audio Captured & Validated'
              : 'Standby • Ready to Capture'}
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-app-primary">
          Meeting Audio Capture
        </h1>
        <p className="text-xs sm:text-sm text-app-secondary max-w-md mx-auto">
          Capture high-fidelity audio directly in your browser. Encoded into 16-bit linear PCM WAV for verified AI speech intelligence.
        </p>

        {/* Tab switcher: Live Microphone vs Upload Audio */}
        {recorder.status === 'idle' && (
          <div className="pt-1.5 flex items-center justify-center">
            <div className="inline-flex p-1 rounded-xl border border-app-border bg-app-surface shadow-xs">
              <button
                onClick={() => setActiveTab('mic')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'mic'
                    ? 'bg-app-elevated text-app-primary shadow-2xs font-semibold'
                    : 'text-app-secondary hover:text-app-primary'
                )}
              >
                <Mic className="w-3.5 h-3.5 text-app-accent" />
                <span>Microphone Capture</span>
              </button>

              <button
                onClick={() => setActiveTab('upload')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'upload'
                    ? 'bg-app-elevated text-app-primary shadow-2xs font-semibold'
                    : 'text-app-secondary hover:text-app-primary'
                )}
              >
                <Upload className="w-3.5 h-3.5 text-app-secondary" />
                <span>Upload Audio File</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Tactical Recording Deck */}
      <div className="w-full rounded-2xl border border-app-border bg-app-surface shadow-xl p-4 sm:p-7 flex flex-col items-center gap-5 sm:gap-6 relative">
        {/* TOP CONTROLS: Audio Input Selector & Calibration Metadata */}
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-app-border pb-3.5 text-xs">
          {/* Left: Input Device Selector */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className={cn(
                'w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-300',
                justSwitchedDevice
                  ? 'border-app-accent bg-app-accent-subtle text-app-accent shadow-[0_0_10px_rgba(190,255,83,0.35)]'
                  : 'border-app-border bg-app-elevated/70 text-app-secondary'
              )}
              title="Active audio capture input"
            >
              <Mic className="w-3.5 h-3.5" />
            </div>

            <span className="text-app-secondary font-mono text-[11px] whitespace-nowrap hidden sm:inline">
              Input Device:
            </span>

            {/* Radix UI Styled Accessible Select Component */}
            <div className="min-w-0 flex-1 max-w-[220px] xs:max-w-[260px] sm:max-w-[300px]">
              <Select
                value={recorder.selectedDeviceId || (recorder.devices[0]?.deviceId ?? 'default')}
                onValueChange={handleDeviceChange}
                disabled={recorder.status === 'recording' || recorder.status === 'paused'}
              >
                <SelectTrigger
                  className={cn(
                    'w-full transition-all duration-300',
                    justSwitchedDevice && 'border-app-accent ring-1 ring-app-accent shadow-[0_0_10px_rgba(190,255,83,0.25)]'
                  )}
                  aria-label="Select audio input microphone"
                >
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent
                  align="start"
                  className="w-[var(--radix-select-trigger-width)] min-w-[220px] max-w-[360px]"
                >
                  {recorder.devices.length === 0 ? (
                    <SelectItem value="default">Default Microphone</SelectItem>
                  ) : (
                    recorder.devices.map((d) => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>
                        <span className="truncate block" title={d.label}>
                          {d.label}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Rescan / Request permission quick action when idle */}
            {recorder.status === 'idle' && (
              <button
                type="button"
                onClick={async () => {
                  const granted = await recorder.requestMicrophonePermission();
                  if (granted) {
                    addToast({
                      title: 'Microphones Refreshed',
                      message: 'Audio input hardware detected and calibrated.',
                      type: 'success',
                    });
                  } else {
                    addToast({
                      title: 'Microphone Check',
                      message: 'Could not access audio permissions.',
                      type: 'info',
                    });
                  }
                }}
                className="p-1.5 rounded-lg border border-app-border bg-app-elevated/50 text-app-secondary hover:text-app-primary hover:bg-app-elevated transition-colors shrink-0"
                title="Refresh devices or request permissions"
                aria-label="Refresh audio devices"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}

            {justSwitchedDevice && (
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono text-app-accent animate-fade-in">
                <Check className="w-3 h-3" />
                Active
              </span>
            )}
          </div>

          {/* Right: PCM Calibration Metadata */}
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-app-border bg-app-elevated/40 font-mono text-[11px] text-app-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-app-accent/80" />
              <span>16-bit Linear PCM • 16 kHz Mono</span>
            </div>
          </div>
        </div>

        {/* UPLOAD VIEW (if active tab is upload and idle) */}
        {activeTab === 'upload' && recorder.status === 'idle' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'w-full h-44 sm:h-48 border-2 border-dashed rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200',
              isDragOver
                ? 'border-app-accent bg-app-accent-subtle/30 scale-[1.01]'
                : 'border-app-border hover:border-app-accent/50 bg-app-elevated/20'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.mp3,.m4a,.webm,.ogg,.flac"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleSelectedFile(e.target.files[0]);
                }
              }}
            />
            <div className="w-11 h-11 rounded-full border border-app-border bg-app-surface flex items-center justify-center mb-2.5 text-app-accent shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-app-primary">
              Drag and drop meeting audio recording
            </p>
            <p className="text-xs text-app-secondary mt-1">
              Supports WAV, MP3, M4A, WebM, OGG, or FLAC up to 100 MB
            </p>
            <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-mono text-app-accent">
              <span>Browse files</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        ) : (
          /* LIVE AMPLITUDE WAVEFORM VISUALIZATION (Real Web Audio API + Idle State) */
          <div className="w-full h-32 sm:h-36 bg-app-elevated/40 rounded-xl border border-app-border p-3.5 sm:p-4 flex flex-col justify-between relative overflow-hidden">
            {/* Header info */}
            <div className="flex items-center justify-between text-[11px] font-mono text-app-secondary z-10">
              <span className="flex items-center gap-1.5">
                <Radio
                  className={cn(
                    'w-3 h-3',
                    recorder.status === 'recording' ? 'text-red-500 animate-pulse' : 'text-app-secondary'
                  )}
                />
                Web Audio Spectrum
              </span>
              <span className="tabular-nums">
                {recorder.status === 'recording'
                  ? 'Real-Time Dynamic dBFS'
                  : recorder.status === 'paused'
                  ? 'Spectrum Frozen'
                  : recorder.status === 'recorded'
                  ? 'Playback Analyzed'
                  : 'Zero dBFS Baseline'}
              </span>
            </div>

            {/* Subtle Idle State Overlay Message */}
            {(recorder.status === 'idle' || recorder.status === 'requesting') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20 px-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-app-border/80 bg-app-surface/90 backdrop-blur-xs text-xs font-mono text-app-secondary shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-app-accent/80 animate-pulse" />
                  <span>Waiting for microphone input</span>
                </div>
              </div>
            )}

            {/* Neon-lime waveform bars with subtle gradients */}
            <div className="flex items-center justify-center gap-1 sm:gap-1.5 h-16 sm:h-20 w-full px-2 sm:px-4 z-10">
              {recorder.status === 'recording' || recorder.status === 'paused' || recorder.status === 'recorded'
                ? recorder.audioLevels.map((level, idx) => {
                    const isRecording = recorder.status === 'recording';
                    const isPaused = recorder.status === 'paused';

                    return (
                      <div
                        key={idx}
                        style={{
                          height: `${level}px`,
                          transition: isRecording ? 'height 75ms ease' : 'height 250ms ease',
                        }}
                        className={cn(
                          'w-1.5 sm:w-2 rounded-full transition-colors',
                          isRecording
                            ? 'bg-gradient-to-t from-app-accent/70 to-app-accent shadow-[0_0_8px_rgba(190,255,83,0.35)]'
                            : isPaused
                            ? 'bg-amber-500/70'
                            : 'bg-app-accent/40'
                        )}
                      />
                    );
                  })
                : idleBars.map((idleH, idx) => (
                    <div
                      key={idx}
                      style={{
                        height: `${idleH}px`,
                      }}
                      className="w-1.5 sm:w-2 rounded-full bg-[#BEFF53]/20 light:bg-app-accent/20 transition-all duration-300"
                    />
                  ))}
            </div>

            {/* Frequency Axis Marker */}
            <div className="flex items-center justify-between text-[9px] font-mono text-app-secondary/60 border-t border-app-border/40 pt-1 z-10">
              <span>60 Hz</span>
              <span>500 Hz</span>
              <span>2.4 kHz</span>
              <span>8 kHz</span>
            </div>
          </div>
        )}

        {/* Central Tactical Timer Display with Compact Typography */}
        <div className="text-center space-y-0.5">
          <div className="text-3xl sm:text-4xl md:text-5xl font-mono font-bold tracking-tight text-app-primary tabular-nums">
            {formatDuration(recorder.duration)}
          </div>
          <p className="text-[10px] sm:text-[11px] font-mono text-app-secondary uppercase tracking-widest">
            {recorder.status === 'recording'
              ? 'Duration Elapsed • Live'
              : recorder.status === 'recorded'
              ? 'Total Captured Duration'
              : 'Recording Timer'}
          </p>
        </div>

        {/* PRIMARY RECORDING CONTROLS */}
        <div className="flex flex-col items-center gap-3">
          {/* IDLE / REQUESTING STATE */}
          {(recorder.status === 'idle' || recorder.status === 'requesting') && (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={recorder.startRecording}
                disabled={recorder.status === 'requesting'}
                className={cn(
                  'group relative flex items-center justify-center w-18 h-18 sm:w-20 sm:h-20 rounded-full border-2 transition-all duration-300 active:scale-95',
                  'border-app-accent bg-app-accent/10 hover:bg-app-accent text-app-accent hover:text-black',
                  'shadow-[0_0_16px_rgba(190,255,83,0.2)] hover:shadow-[0_0_32px_rgba(190,255,83,0.5)]',
                  'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-app-accent focus-visible:ring-offset-app-surface',
                  'animate-mic-breathe'
                )}
                aria-label="Start recording meeting"
              >
                {recorder.status === 'requesting' ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <Mic className="w-8 h-8 group-hover:scale-110 transition-transform" />
                )}
              </button>
              <span className="text-[11px] font-mono text-app-secondary">
                Click microphone to begin
              </span>
            </div>
          )}

          {/* LIVE RECORDING / PAUSED STATE */}
          {(recorder.status === 'recording' || recorder.status === 'paused') && (
            <div className="flex items-center gap-4 sm:gap-5">
              {/* Pause / Resume Button */}
              {recorder.status === 'recording' ? (
                <button
                  onClick={recorder.pauseRecording}
                  className="flex items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-full border border-app-border bg-app-elevated text-app-primary hover:bg-app-surface hover:border-app-border/80 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-app-accent transition-colors active:scale-95 shadow-xs"
                  title="Pause Recording"
                  aria-label="Pause Recording"
                >
                  <Pause className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={recorder.resumeRecording}
                  className="flex items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-full border border-app-accent bg-app-accent/15 text-app-accent hover:bg-app-accent hover:text-black focus:outline-hidden focus-visible:ring-2 focus-visible:ring-app-accent transition-colors active:scale-95 shadow-xs"
                  title="Resume Recording"
                  aria-label="Resume Recording"
                >
                  <Play className="w-5 h-5 ml-0.5" />
                </button>
              )}

              {/* Stop Recording Button */}
              <button
                onClick={recorder.stopRecording}
                className="flex items-center justify-center w-18 h-18 sm:w-20 sm:h-20 rounded-full border-2 border-red-500 bg-red-500 text-white hover:bg-red-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 focus-visible:ring-offset-app-surface transition-all active:scale-95 shadow-lg shadow-red-500/25"
                title="Stop & Finalize Recording"
                aria-label="Stop & Finalize Recording"
              >
                <Square className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            </div>
          )}

          {/* RECORDED / PREVIEW STATE */}
          {recorder.status === 'recorded' && (
            <div className="w-full flex flex-col items-center gap-4 sm:gap-5">
              {/* Hidden Audio Player for Preview */}
              {recorder.audioUrl && (
                <audio
                  ref={audioPlayerRef}
                  src={recorder.audioUrl}
                  onTimeUpdate={handleAudioTimeUpdate}
                  onEnded={handleAudioEnded}
                  className="hidden"
                />
              )}

              {/* Custom Audio Scrub Bar */}
              <div className="w-full max-w-md p-3 rounded-xl border border-app-border bg-app-elevated/40 flex items-center gap-3">
                <button
                  onClick={togglePlayback}
                  className="w-9 h-9 rounded-full bg-app-surface border border-app-border text-app-primary hover:text-app-accent focus:outline-hidden focus-visible:ring-1 focus-visible:ring-app-accent flex items-center justify-center shrink-0 transition-colors"
                  aria-label={isPlayingAudio ? 'Pause playback' : 'Play audio'}
                >
                  {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px] font-mono text-app-secondary mb-1">
                    <span>Preview Audio</span>
                    <span>
                      {formatDuration(playbackTime)} / {formatDuration(recorder.duration)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-app-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-app-accent transition-all duration-100"
                      style={{
                        width: `${recorder.duration > 0 ? (playbackTime / recorder.duration) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <Volume2 className="w-4 h-4 text-app-secondary shrink-0" />
              </div>

              {/* Actions Grid */}
              <div className="flex items-center gap-3 flex-wrap justify-center">
                {/* Discard & Re-record */}
                <button
                  onClick={recorder.discardRecording}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-app-border bg-app-surface text-app-secondary hover:text-red-500 hover:border-red-500/40 text-xs font-medium transition-colors focus:outline-hidden focus-visible:ring-1 focus-visible:ring-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Discard</span>
                </button>

                {/* Standalone WAV Download */}
                <button
                  onClick={handleDownloadWav}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-app-border bg-app-surface text-app-primary hover:bg-app-elevated text-xs font-medium transition-colors focus:outline-hidden focus-visible:ring-1 focus-visible:ring-app-accent"
                  title="Download valid 16-bit linear PCM WAV container"
                >
                  <Download className="w-3.5 h-3.5 text-app-accent" />
                  <span>Export WAV</span>
                </button>

                {/* Prominent Analyze Meeting Button */}
                <button
                  onClick={handleUploadAndAnalyze}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-app-accent text-black font-semibold text-xs hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-app-accent focus-visible:ring-offset-app-surface transition-all shadow-md active:scale-95 shadow-[0_0_16px_rgba(190,255,83,0.3)]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze Meeting</span>
                </button>
              </div>
            </div>
          )}

          {/* PERMISSION / RECORDER ERROR STATE */}
          {recorder.status === 'error' && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-500 space-y-2 text-center max-w-md">
              <div className="flex items-center justify-center gap-1.5 font-semibold">
                <AlertCircle className="w-4 h-4" />
                <span>Microphone Permission or Capture Issue</span>
              </div>
              <p className="text-[11px] leading-relaxed text-red-400">
                {recorder.errorMessage || 'Failed to capture or record audio.'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={recorder.discardRecording}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 bg-app-surface text-app-primary hover:bg-app-elevated transition-colors text-xs font-medium"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Setup</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trust & Provenance Footer Note */}
      <div className="mt-4 sm:mt-5 text-center text-[11px] font-mono text-app-secondary flex items-center justify-center gap-2">
        <span>RIFF WAVE 16-bit PCM • Client-side Container Encoding</span>
        <span>•</span>
        <span>Auditable Decision Provenance</span>
      </div>
    </motion.div>
  );
}
