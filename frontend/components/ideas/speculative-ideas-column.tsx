'use client';

import React, { useState } from 'react';
import { SpeculativeIdea } from '@/types/meeting';
import { useWorkspace } from '@/lib/context/workspace-context';
import { Sparkles, Clock, Compass, Quote, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SpeculativeIdeasColumnProps {
  ideas: SpeculativeIdea[];
}

export function SpeculativeIdeasColumn({ ideas }: SpeculativeIdeasColumnProps) {
  const { openInspector } = useWorkspace();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-full bg-app-surface border border-dashed border-app-border rounded-2xl overflow-hidden shadow-xs">
      {/* Sticky Column Header */}
      <div className="sticky top-0 z-10 px-5 py-4 border-b border-app-border bg-app-surface/95 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(169,149,255,0.6)]" />
          <h2 className="text-lg sm:text-[19px] font-semibold text-app-primary">
            Speculative Ideas
          </h2>
          <span className="text-xs sm:text-[12.5px] font-mono px-2.5 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400 font-bold">
            {ideas.length}
          </span>
        </div>
      </div>

      {/* Ideas List */}
      <div className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto min-h-0">
        {ideas.length === 0 ? (
          <div className="py-16 text-center text-sm text-app-secondary px-6 border border-dashed border-app-border rounded-2xl bg-app-surface/60">
            <Compass className="w-9 h-9 text-app-secondary/40 mx-auto mb-3" />
            <p className="font-semibold text-app-primary text-base">No speculative ideas logged</p>
            <p className="text-sm text-app-secondary mt-1.5 max-w-xs mx-auto leading-relaxed">
              Exploratory concepts and suggestions discussed during the meeting will be cataloged here without binding commitment.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {ideas.map((idea, idx) => {
              const isExpanded = expandedId === idea.id;

              return (
                <motion.div
                  key={idea.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.2) }}
                  whileHover={{ y: -2 }}
                  className="relative p-5 sm:p-6 rounded-2xl border border-dashed border-violet-500/35 bg-app-surface hover:border-violet-500/70 hover:bg-violet-500/5 transition-all duration-200 shadow-xs space-y-3.5"
                >
                  {/* Category & Timestamp */}
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="text-xs sm:text-[12.5px] font-mono font-medium uppercase tracking-wider px-2.5 py-1 rounded-md border border-violet-500/30 text-violet-400 bg-violet-500/10">
                      {idea.category || 'Exploratory Brainstorm'}
                    </span>

                    <div className="flex items-center gap-2 shrink-0">
                      {idea.timestamp && (
                        <span className="flex items-center gap-1.5 text-xs sm:text-[12.5px] font-mono text-app-secondary">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{idea.timestamp}</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleExpand(idea.id)}
                        className="p-1 rounded-lg text-app-secondary hover:text-app-primary hover:bg-app-elevated transition-colors"
                        title={isExpanded ? 'Collapse card' : 'Expand full details'}
                        aria-label={isExpanded ? 'Collapse card' : 'Expand full details'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-violet-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Idea Title & Description */}
                  <div className="space-y-1.5">
                    <h3
                      onClick={() => toggleExpand(idea.id)}
                      className="text-base sm:text-[17px] font-semibold text-app-primary leading-snug cursor-pointer hover:text-violet-300 transition-colors"
                    >
                      {idea.title}
                    </h3>
                    {idea.description && (
                      <p
                        className={cn(
                          'text-sm sm:text-[14.5px] text-app-secondary leading-relaxed transition-all',
                          !isExpanded && 'line-clamp-2 sm:line-clamp-3'
                        )}
                      >
                        {idea.description}
                      </p>
                    )}
                  </div>

                  {/* Supporting Evidence Drawer Trigger */}
                  {idea.source_quote && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          openInspector(
                            {
                              id: idea.id,
                              meeting_id: idea.meeting_id,
                              title: idea.title,
                              description: idea.description,
                              assignee_id: null,
                              due_date: null,
                              confidence: 0.7,
                              source_quote: idea.source_quote,
                              evidence_chunk_index: idea.evidence_chunk_index,
                              trello_status: 'not_synced',
                            },
                            idea.evidence_chunk_index
                          )
                        }
                        className="w-full text-left p-2.5 rounded-xl border border-violet-500/25 bg-violet-500/5 hover:border-violet-500/45 hover:bg-violet-500/10 transition-colors group/evidence flex items-start justify-between gap-3"
                        title="View context in full transcript drawer"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <Quote className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                          <p
                            className={cn(
                              'text-sm italic text-violet-400/90 leading-relaxed',
                              !isExpanded && 'line-clamp-2'
                            )}
                          >
                            &ldquo;{idea.source_quote}&rdquo;
                          </p>
                        </div>
                        <span className="text-sm font-medium text-violet-400 shrink-0 group-hover/evidence:underline whitespace-nowrap pt-0.5">
                          View Evidence ↗
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Display-only Badge Footer */}
                  <div className="pt-3 border-t border-app-border/40 flex items-center justify-between text-xs sm:text-[12.5px] font-mono text-app-secondary">
                    <div className="flex items-center gap-1.5 text-violet-400 font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Non-Binding Brainstorm</span>
                    </div>
                    <span className="text-app-secondary/70">
                      Never published to Trello
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
