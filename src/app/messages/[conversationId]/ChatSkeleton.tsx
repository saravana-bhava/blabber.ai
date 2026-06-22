import React from 'react';

export function ChatSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
          <div
            className={`animate-pulse ${i % 2 === 0 ? 'msg-bubble-in' : 'msg-bubble-out'}`}
            style={{ height: 40, width: i % 2 === 0 ? 180 : 140, opacity: 0.5 }}
          />
        </div>
      ))}
    </div>
  );
}
