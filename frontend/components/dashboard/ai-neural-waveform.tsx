'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Radio, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface AiNeuralWaveformProps {
  className?: string;
  onStartRecording?: () => void;
}

export function AiNeuralWaveform({ className, onStartRecording }: AiNeuralWaveformProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const handleClick = () => {
    if (onStartRecording) {
      onStartRecording();
    } else {
      router.push('/recording');
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    const barCount = 48;
    const baseRadius = 58;

    const render = () => {
      // Respect device pixel ratio
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      time += isHovered ? 0.045 : 0.022;

      // Draw faint concentric background acoustic rings
      const rings = [78, 102, 126];
      rings.forEach((r, idx) => {
        const ringPulse = Math.sin(time * 1.2 + idx * 0.8) * 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r + ringPulse, 0, Math.PI * 2);
        ctx.strokeStyle = idx === 1 ? 'rgba(0, 229, 195, 0.08)' : 'rgba(190, 255, 83, 0.06)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Draw radial neural waveform bars
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2;

        // Harmonic waveform algorithm
        const wave1 = Math.sin(angle * 4 + time * 1.8);
        const wave2 = Math.cos(angle * 3 - time * 1.2);
        const wave3 = Math.sin(angle * 6 + time * 2.5);

        const amplitudeFactor = isHovered ? 1.6 : 1.0;
        const normalizedAmp = (wave1 * 0.5 + wave2 * 0.35 + wave3 * 0.25 + 1.1) / 2;
        const barHeight = Math.max(4, normalizedAmp * 26 * amplitudeFactor);

        const innerX = centerX + Math.cos(angle) * (baseRadius + 4);
        const innerY = centerY + Math.sin(angle) * (baseRadius + 4);
        const outerX = centerX + Math.cos(angle) * (baseRadius + 4 + barHeight);
        const outerY = centerY + Math.sin(angle) * (baseRadius + 4 + barHeight);

        // Gradient from lime (#BEFF53) to cyan (#00E5C3)
        const gradient = ctx.createLinearGradient(innerX, innerY, outerX, outerY);
        if (i % 2 === 0) {
          gradient.addColorStop(0, 'rgba(190, 255, 83, 0.85)');
          gradient.addColorStop(1, 'rgba(0, 229, 195, 0.45)');
        } else {
          gradient.addColorStop(0, 'rgba(0, 229, 195, 0.85)');
          gradient.addColorStop(1, 'rgba(190, 255, 83, 0.45)');
        }

        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = isHovered ? 2.5 : 2;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isHovered]);

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center p-4 select-none group',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Outer ambient glow */}
      <div
        className={cn(
          'absolute w-64 h-64 rounded-full pointer-events-none transition-all duration-700 blur-2xl',
          isHovered
            ? 'bg-gradient-to-tr from-[#BEFF53]/20 via-[#00E5C3]/20 to-transparent scale-110 opacity-80'
            : 'bg-gradient-to-tr from-[#BEFF53]/10 via-[#00E5C3]/10 to-transparent scale-100 opacity-40'
        )}
      />

      {/* Canvas container for the neural radial audio signal */}
      <div className="relative w-[280px] h-[280px] flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={280}
          height={280}
          className="absolute inset-0 pointer-events-none"
        />

        {/* Central interactive Glowing Microphone Core */}
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300',
            'border bg-[#101820] shadow-xl',
            isHovered
              ? 'border-[#BEFF53] scale-105 shadow-[0_0_32px_rgba(190,255,83,0.45)] ring-2 ring-[#BEFF53]/50'
              : 'border-[#222F3E] hover:border-[#BEFF53]/80 shadow-[0_0_20px_rgba(0,0,0,0.6)]'
          )}
          title="Click to launch TaskFlow AI Recording Deck"
          aria-label="Launch TaskFlow AI Recording Deck"
        >
          {/* Subtle inner orbital ring */}
          <div className="absolute inset-1.5 rounded-full border border-dashed border-[#BEFF53]/30 animate-orbit-spin pointer-events-none" />

          {/* Central microphone icon with reactive glow */}
          <div
            className={cn(
              'w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200',
              isHovered
                ? 'bg-gradient-to-tr from-[#BEFF53] to-[#00E5C3] text-black shadow-md'
                : 'bg-[#15202A] text-[#BEFF53] border border-[#BEFF53]/30'
            )}
          >
            <Mic className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
          </div>

          <span
            className={cn(
              'mt-1.5 text-[10px] font-mono tracking-wider uppercase transition-colors',
              isHovered ? 'text-[#BEFF53] font-semibold' : 'text-[#A8B6C7]'
            )}
          >
            {isHovered ? 'Record' : 'Standby'}
          </span>
        </button>
      </div>

      {/* Lower Status Pill */}
      <div className="mt-1 flex items-center gap-2 px-3 py-1 rounded-full border border-[#222F3E] bg-[#101820]/90 backdrop-blur-xs text-xs font-mono text-[#A8B6C7] shadow-xs">
        <span className="w-2 h-2 rounded-full bg-[#00E5C3] shadow-[0_0_8px_rgba(0,229,195,0.7)] animate-pulse" />
        <span>Neural Signal Engine • Standby</span>
      </div>
    </div>
  );
}
