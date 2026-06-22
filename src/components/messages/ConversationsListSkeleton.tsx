import React from 'react';

export function ConversationsListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-[11px] animate-pulse">
          <div className="w-12 h-12 rounded-full bg-secondary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-2">
              <div className="h-3.5 w-28 bg-secondary rounded" />
              <div className="h-3 w-8 bg-secondary rounded" />
            </div>
            <div className="h-3 w-44 bg-secondary rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
