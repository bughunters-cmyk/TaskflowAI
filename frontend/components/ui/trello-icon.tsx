import React from 'react';

export function TrelloIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="24" height="24" rx="4" fill="currentColor" fillOpacity="0.12" />
      <rect x="4" y="4" width="6.5" height="13" rx="1.5" fill="currentColor" />
      <rect x="13.5" y="4" width="6.5" height="8.5" rx="1.5" fill="currentColor" />
    </svg>
  );
}
