"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiUpload } from "@/lib/api";

type Props = {
  onDone?: (result: { status: string; tasksCount: number; message: string }) => void;
};

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function LiveRecorder({ onDone }: Props) {
  const { session, currentFirm } = useAuth();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      stopTracks();
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startLevelMeter = (stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        setLevel(Math.min(1, sum / data.length / 80));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // meter is optional
    }
  };

  const startRecording = async () => {
    setError("");
    chunksRef.current = [];
    setSeconds(0);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      startLevelMeter(stream);

      const mime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : MediaRecorder.isTypeSupported("audio/mp4")
              ? "audio/mp4"
              : "";

      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopTracks();
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        await audioCtxRef.current?.close().catch(() => {});
        audioCtxRef.current = null;

        const blobType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        chunksRef.current = [];

        if (blob.size < 1000) {
          setError("Recording too short. Try again.");
          setProcessing(false);
          return;
        }

        await uploadRecording(blob, blobType);
      };

      recorder.start(250);
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err: any) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Microphone permission denied. Allow mic access in the browser.");
      } else if (name === "NotFoundError") {
        setError("No microphone found.");
      } else {
        setError(err?.message || "Could not start recording.");
      }
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    setLevel(0);

    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      setProcessing(true);
      rec.stop();
    }
  };

  const uploadRecording = async (blob: Blob, mimeType: string) => {
    const token = session?.access_token;
    const firmId = currentFirm?.id;
    if (!token || !firmId) {
      setError("Not signed in or no firm selected.");
      setProcessing(false);
      return;
    }

    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const file = new File(
      [blob],
      `live-recording-${Date.now()}.${ext}`,
      { type: mimeType }
    );

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiUpload(
        `/api/process-audio?firm_id=${firmId}&title=${encodeURIComponent(
          `Live recording ${new Date().toLocaleString()}`
        )}`,
        fd,
        token
      );

      const count = res.tasks?.length || 0;
      const message =
        res.status === "duplicate"
          ? "Duplicate audio detected."
          : `Extracted ${count} task${count === 1 ? "" : "s"}.`;

      onDone?.({ status: res.status, tasksCount: count, message });
    } catch (err: any) {
      setError(err.message || "Upload failed");
      onDone?.({ status: "error", tasksCount: 0, message: err.message || "Upload failed" });
    } finally {
      setProcessing(false);
      setSeconds(0);
    }
  };

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Record control */}
        {!recording && !processing ? (
          <button
            type="button"
            onClick={startRecording}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-500 px-4 text-[13px] font-medium text-white shadow-sm shadow-emerald-500/20 transition hover:bg-emerald-600"
          >
            <Mic className="h-4 w-4" />
            Start live recording
          </button>
        ) : recording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-[13px] font-medium text-white transition hover:bg-red-700"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop · {formatTime(seconds)}
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-700 px-4 text-[13px] font-medium text-slate-300"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing…
          </button>
        )}

        {/* Level meter */}
        {(recording || processing) && (
          <div className="flex items-center gap-2 min-w-[120px]">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width] duration-75"
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </div>
            {recording && (
              <span className="flex items-center gap-1.5 text-[12px] text-red-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                REC
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 text-[12px] text-red-400">{error}</p>
      )}

      {!recording && !processing && (
        <p className="mt-2 text-[12px] text-slate-500">
          Uses your microphone. When you stop, the audio is transcribed and tasks are extracted.
        </p>
      )}
    </div>
  );
}
