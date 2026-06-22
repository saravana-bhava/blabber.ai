'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ShortsModalFeed } from './ShortsModalFeed';
import { useUser } from '@/lib/contexts/user-context';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShortsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPostId?: string; // Optional: to start from a specific post
}

export function ShortsModal({ isOpen, onClose, initialPostId }: ShortsModalProps) {
  const { session, profile, isLoading } = useUser();
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startX = useRef(0);

  const triggerFeedRefresh = () => {
    setFeedRefreshKey(prevKey => prevKey + 1);
  };

  // Reset feed when modal opens
  useEffect(() => {
    if (isOpen) {
      setFeedRefreshKey(prevKey => prevKey + 1);
      setDragOffset(0);
      setIsDragging(false);
    }
  }, [isOpen]);

  // Touch event handlers for swipe-to-dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - startY.current;
    const deltaX = currentX - startX.current;
    
    // Only allow horizontal swipes (right to left or left to right)
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault();
      const offset = Math.max(0, deltaX);
      setDragOffset(offset);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    // If dragged more than 80px to the right, close the modal
    if (dragOffset > 80) {
      onClose();
    } else {
      // Reset position
      setDragOffset(0);
    }
  };

  // Mouse event handlers for desktop drag
  const handleMouseDown = (e: React.MouseEvent) => {
    startY.current = e.clientY;
    startX.current = e.clientX;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX.current;
    const deltaY = e.clientY - startY.current;
    
    // Only allow horizontal drags
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      const offset = Math.max(0, deltaX);
      setDragOffset(offset);
    }
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    // If dragged more than 80px to the right, close the modal
    if (dragOffset > 80) {
      onClose();
    } else {
      // Reset position
      setDragOffset(0);
    }
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('shorts-modal-open');
    } else {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('shorts-modal-open');
    }
    
    return () => {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('shorts-modal-open');
    };
  }, [isOpen]);

  // Calculate opacity and scale for visual feedback
  const dragProgress = Math.min(dragOffset / 200, 1);
  const opacity = 1 - (dragProgress * 0.3);
  const scale = 1 - (dragProgress * 0.05);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        ref={modalRef}
        className="shorts-modal-content shorts-modal-no-overlay max-w-none w-screen p-0 bg-background overflow-hidden fixed top-0 left-1/2 -translate-x-1/2 translate-y-0 z-50 !rounded-none !border-0 !border-b-0 !p-0 !shadow-none"
        style={{
          transform: `translateX(${dragOffset}px) scale(${scale})`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          opacity: opacity,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        hideCloseButton={true}
      >
        <style>{`
          .shorts-modal-content *:focus,
          .shorts-modal-content *:active,
          .shorts-modal-content *:focus-visible {
            outline: none !important;
            box-shadow: none !important;
            border: none !important;
          }
          body.shorts-modal-open [data-slot="dialog-overlay"] {
            background: transparent !important;
          }
          .shorts-modal-content {
            height: 100dvh;
            max-height: 100dvh;
          }
          @media (max-width: 767px) {
            .shorts-modal-content {
              height: calc(100dvh - 4rem);
              max-height: calc(100dvh - 4rem);
            }
          }
        `}</style>
        <DialogTitle className="sr-only">Shorts Feed</DialogTitle>
        <DialogDescription className="sr-only">
          Vertical feed of short videos. Scroll or swipe to browse.
        </DialogDescription>
        
        {/* Back Arrow */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 'env(safe-area-inset-top, 0px)',
            left: 'env(safe-area-inset-left, 0px)',
            zIndex: 60,
            pointerEvents: 'auto',
          }}
          className="h-8 w-8 bg-transparent hover:bg-black/80 text-foreground border-none shadow-none rounded-full transition-all duration-200 hover:text-foreground/80 hover:scale-110 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0 data-[state=open]:outline-none data-[state=open]:ring-0"
          tabIndex={-1}
        >
          <ArrowLeft size={24} />
        </Button>

        {/* Main Content */}
        <div className="w-full h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-white">Loading...</div>
            </div>
          ) : session && profile ? (
            <div className="w-full h-full">
              <ShortsModalFeed 
                key={`shorts-modal-feed-${feedRefreshKey}-${initialPostId ?? 'all'}`}
                onPostDelete={triggerFeedRefresh}
                initialPostId={initialPostId}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-white">Please sign in to view shorts</div>
            </div>
          )}
        </div>

        {/* Drag indicator overlay */}
        {dragOffset > 0 && (
          <div 
            className="absolute inset-0 bg-black/20 pointer-events-none"
            style={{
              opacity: Math.min(dragOffset / 200, 0.5),
            }}
          />
        )}

        {/* Swipe hint */}
        {/* {dragOffset === 0 && isOpen && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white/60 text-sm pointer-events-none">
            Swipe right to close
          </div>
        )} */}
      </DialogContent>
    </Dialog>
  );
} 