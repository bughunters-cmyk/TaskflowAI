'use client';

import React from 'react';
import { useWorkspace } from '@/lib/context/workspace-context';
import { CheckCircle2, AlertCircle, Info, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ToastContainer() {
  const { toasts, removeToast } = useWorkspace();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-2',
              isSuccess
                ? 'bg-app-surface border-app-accent/40 text-app-primary'
                : isError
                ? 'bg-app-surface border-red-500/40 text-app-primary'
                : 'bg-app-surface border-app-border text-app-primary'
            )}
          >
            <div className="shrink-0 mt-0.5">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-app-accent" />}
              {isError && <AlertCircle className="w-4 h-4 text-red-500" />}
              {!isSuccess && !isError && <Info className="w-4 h-4 text-app-secondary" />}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-tight">{toast.title}</p>
              {toast.message && (
                <p className="text-[11px] text-app-secondary leading-snug mt-1">
                  {toast.message}
                </p>
              )}
              {toast.cardUrl && (
                <a
                  href={toast.cardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-app-accent hover:underline mt-1.5"
                >
                  <span>Open Trello Card</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-app-secondary hover:text-app-primary p-0.5 rounded transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
