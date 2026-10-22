'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '@/lib/context/workspace-context';
import {
  X,
  Search,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  User,
  Quote,
  Maximize2,
  Minimize2,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function TranscriptInspector() {
  const {
    currentMeeting,
    isInspectorOpen,
    closeInspector,
    activeInspectorTask,
    activeInspectorSegment,
    addToast,
  } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedQuote, setCopiedQuote] = useState(false);
  const [copiedSegmentIdx, setCopiedSegmentIdx] = useState<number | null>(null);
  const [isExpandedFull, setIsExpandedFull] = useState(false);
  const highlightedRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the matching highlighted segment when opened
  useEffect(() => {
    if (isInspectorOpen && highlightedRef.current) {
      const timer = setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isInspectorOpen, activeInspectorTask, activeInspectorSegment]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isInspectorOpen) {
        closeInspector();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInspectorOpen, closeInspector]);

  if (!currentMeeting) return null;

  const segments = currentMeeting.segments || [];
  const targetQuote = (activeInspectorTask?.source_quote || '').trim();

  const handleCopyQuote = () => {
    if (targetQuote) {
      const speakerInfo = activeInspectorTask?.speaker ? ` — ${activeInspectorTask.speaker}` : '';
      const timestampInfo = activeInspectorTask?.transcript_timestamp
        ? ` (${activeInspectorTask.transcript_timestamp})`
        : '';
      navigator.clipboard.writeText(`"${targetQuote}"${speakerInfo}${timestampInfo}`);
      setCopiedQuote(true);
      setTimeout(() => setCopiedQuote(false), 2000);
      addToast({
        title: 'Quote Copied',
        message: 'Evidence quote copied to clipboard.',
        type: 'info',
      });
    }
  };

  const handleCopySegment = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedSegmentIdx(idx);
    setTimeout(() => setCopiedSegmentIdx(null), 2000);
    addToast({
      title: 'Segment Copied',
      message: `Transcript segment ${idx} copied.`,
      type: 'info',
    });
  };

  const handleJumpToEvidence = () => {
    if (highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const filteredSegments = segments.filter((seg) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      seg.text.toLowerCase().includes(q) ||
      (seg.speaker && seg.speaker.toLowerCase().includes(q))
    );
  });

  return (
    <AnimatePresence>
      {isInspectorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Transcript Evidence Inspector"
          className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-xs flex justify-end select-none"
          onClick={closeInspector}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className={cn(
              'h-full bg-[#15191E] border-l border-[#2A3038] flex flex-col shadow-2xl transition-all duration-300',
              isExpandedFull ? 'w-full max-w-4xl' : 'w-full max-w-2xl'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-app-border bg-app-elevated/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-app-accent-subtle border border-app-accent/30 text-app-accent flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-app-accent font-semibold">
                      Transcript Inspector
                    </span>
                    {activeInspectorSegment !== null && activeInspectorSegment !== undefined && (
                      <span className="text-xs font-mono text-app-secondary">
                        Chunk #{activeInspectorSegment}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-[17px] font-semibold text-app-primary truncate">
                    {currentMeeting.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Expand / Narrow Drawer Width */}
                <button
                  type="button"
                  onClick={() => setIsExpandedFull(!isExpandedFull)}
                  className="p-2 rounded-xl border border-app-border text-app-secondary hover:text-app-primary hover:bg-app-elevated transition-colors hidden sm:inline-flex"
                  title={isExpandedFull ? 'Standard width' : 'Expand width'}
                  aria-label={isExpandedFull ? 'Standard width' : 'Expand width'}
                >
                  {isExpandedFull ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={closeInspector}
                  className="p-2 rounded-xl border border-app-border text-app-secondary hover:text-app-primary hover:bg-app-elevated transition-colors"
                  aria-label="Close Inspector"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Focused Evidence Card at top */}
            {activeInspectorTask && (
              <div className="p-4 sm:p-5 border-b border-app-border bg-app-surface/90 space-y-2.5 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-app-secondary font-medium">
                    Active Grounded Commitment
                  </span>
                  <div className="flex items-center gap-2">
                    {highlightedRef.current && (
                      <button
                        type="button"
                        onClick={handleJumpToEvidence}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-app-border bg-app-elevated text-xs font-mono text-app-secondary hover:text-app-accent hover:border-app-accent/40 transition-colors"
                        title="Jump down to segment in transcript"
                      >
                        <ArrowDown className="w-3 h-3" />
                        <span>Jump to Evidence</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCopyQuote}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-app-border bg-app-elevated text-xs font-mono text-app-secondary hover:text-app-primary hover:border-app-accent/40 transition-colors"
                    >
                      {copiedQuote ? <Check className="w-3.5 h-3.5 text-app-accent" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedQuote ? 'Copied' : 'Copy Quote'}</span>
                    </button>
                  </div>
                </div>

                <h4 className="text-sm sm:text-base font-semibold text-app-primary">
                  {activeInspectorTask.title}
                </h4>

                <div className="p-3.5 rounded-xl border border-app-accent/30 bg-app-accent-subtle/30 space-y-2">
                  <p className="italic text-app-primary text-sm sm:text-[14.5px] leading-relaxed">
                    &ldquo;{targetQuote}&rdquo;
                  </p>
                  {(activeInspectorTask.speaker || activeInspectorTask.transcript_timestamp) && (
                    <div className="flex items-center gap-2 text-xs font-mono text-app-secondary">
                      {activeInspectorTask.speaker && (
                        <span>Speaker: {activeInspectorTask.speaker}</span>
                      )}
                      {activeInspectorTask.speaker && activeInspectorTask.transcript_timestamp && <span>•</span>}
                      {activeInspectorTask.transcript_timestamp && (
                        <span>Timestamp: {activeInspectorTask.transcript_timestamp}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Search bar inside transcript */}
            <div className="px-5 py-3 border-b border-app-border bg-app-elevated/20 flex items-center gap-2.5 shrink-0">
              <Search className="w-4 h-4 text-app-secondary shrink-0" />
              <input
                type="text"
                placeholder="Search transcript phrases, keywords, or speakers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none text-sm text-app-primary placeholder:text-app-secondary/60 outline-hidden flex-1"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs font-mono text-app-secondary hover:text-app-primary px-1.5 py-0.5 rounded bg-app-elevated"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Scrollable Transcript Body */}
            <div className="flex-1 p-5 space-y-3.5 overflow-y-auto min-h-0">
              {filteredSegments.length === 0 ? (
                <div className="py-16 text-center text-sm text-app-secondary">
                  No matching transcript segments found.
                </div>
              ) : (
                filteredSegments.map((seg) => {
                  const isTargetSegment =
                    activeInspectorSegment !== null && activeInspectorSegment !== undefined
                      ? seg.chunk_index === activeInspectorSegment
                      : targetQuote &&
                        seg.text.toLowerCase().includes(targetQuote.toLowerCase().slice(0, 20));

                  return (
                    <div
                      key={seg.chunk_index}
                      ref={isTargetSegment ? highlightedRef : null}
                      className={cn(
                        'p-4 rounded-xl border transition-all duration-200 space-y-2',
                        isTargetSegment
                          ? 'border-app-accent/60 bg-app-accent-subtle/25 shadow-xs ring-1.5 ring-app-accent/40'
                          : 'border-app-border/80 bg-app-surface/60 hover:bg-app-elevated/40'
                      )}
                    >
                      <div className="flex items-center justify-between text-xs sm:text-[12.5px] font-mono text-app-secondary">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {seg.speaker && (
                            <span className="font-semibold text-app-primary truncate">
                              {seg.speaker}
                            </span>
                          )}
                          {seg.timestamp && (
                            <span className="text-app-secondary/80">
                              {seg.timestamp}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs px-2 py-0.5 rounded-md border border-app-border bg-app-surface font-mono">
                            Segment #{seg.chunk_index}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopySegment(seg.text, seg.chunk_index)}
                            className="text-app-secondary hover:text-app-primary p-1 rounded hover:bg-app-elevated"
                            title="Copy segment text"
                          >
                            {copiedSegmentIdx === seg.chunk_index ? (
                              <Check className="w-3.5 h-3.5 text-app-accent" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="text-sm sm:text-[14.5px] text-app-primary leading-relaxed font-sans select-text">
                        {isTargetSegment && targetQuote && seg.text.includes(targetQuote) ? (
                          <>
                            {seg.text.split(targetQuote)[0]}
                            <mark className="bg-[#BEFF53] text-black font-semibold rounded px-1.5 py-0.5 shadow-2xs">
                              {targetQuote}
                            </mark>
                            {seg.text.split(targetQuote)[1]}
                          </>
                        ) : (
                          seg.text
                        )}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer metadata */}
            <div className="p-4 border-t border-app-border bg-app-elevated/40 flex items-center justify-between text-xs sm:text-[12.5px] font-mono text-app-secondary shrink-0">
              <span>Auditable Grounded Transcript</span>
              <span>Press ESC to close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
