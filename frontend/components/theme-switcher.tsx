'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Laptop } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn('h-8 w-24 rounded-md bg-app-elevated/40 animate-pulse', className)} />
    );
  }

  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Laptop },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Color theme selection"
      className={cn(
        'inline-flex items-center p-0.5 rounded-lg border border-app-border bg-app-elevated/60 text-app-secondary backdrop-blur-sm',
        className
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={isActive}
            aria-label={`${opt.label} theme`}
            onClick={() => setTheme(opt.value)}
            className={cn(
              'relative flex items-center justify-center h-6.5 w-7 rounded-[6px] text-xs transition-all duration-150',
              isActive
                ? 'bg-app-surface text-app-primary shadow-xs font-medium'
                : 'hover:text-app-primary hover:bg-app-surface/40'
            )}
            title={opt.label}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}

function useState<T>(initial: T) {
  return React.useState<T>(initial);
}
