'use client';

import { useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { requestGeneratedImageFromApi } from '@/lib/image-gen-client';
import { createClient } from '@/lib/supabase/client';
import { saveCreatorGalleryImage } from '@/lib/creator-gallery';
import { useImageGenCreditCost } from '@/lib/hooks/use-image-gen-credit-cost';

type Phase = 'prompt' | 'generating' | 'preview';

const brandPrimaryBtn =
  'h-10 rounded-full px-5 text-sm font-semibold text-[var(--brand-on-accent)] [background:var(--brand-grad)] [box-shadow:var(--brand-ring-money)] hover:brightness-110';

const brandCancelBtn = 'h-10 rounded-full px-5';

const brandOutlineBtn =
  'h-10 rounded-full px-5 gap-1.5 hover:border-[var(--brand-pink)]/40 hover:bg-[var(--brand-grad-soft)] hover:text-[var(--brand-pink)]';

export type CreatorImageGenDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  hasReferencePhoto: boolean;
  onSavedToGallery?: () => void;
  /** Called with gallery row id; parent should navigate e.g. /new-post?galleryImage=… */
  onNavigateToNewPost: (galleryImageId: string) => void;
};

export function CreatorImageGenDialog({
  open,
  onOpenChange,
  profileId,
  hasReferencePhoto,
  onSavedToGallery,
  onNavigateToNewPost,
}: CreatorImageGenDialogProps) {
  const supabase = createClient();
  const [imageGenPrompt, setImageGenPrompt] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [phase, setPhase] = useState<Phase>('prompt');
  const [preview, setPreview] = useState<{
    previewUrl: string;
    file: File;
    width: number;
    height: number;
    prompt: string;
  } | null>(null);
  const [savedGalleryId, setSavedGalleryId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const generationInFlightRef = useRef(false);
  const wasOpenRef = useRef(false);
  const creditCost = useImageGenCreditCost(open);

  // Only reset when the dialog transitions closed → open. Re-running on every `open===true`
  // pass can fight Strict Mode / parent re-renders; resetting mid-flight aborts the client fetch
  // and the API route can drop the Comfy upload (EPIPE).
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (!justOpened) return;

    abortRef.current?.abort();
    abortRef.current = null;
    generationInFlightRef.current = false;
    setPhase('prompt');
    setPreview(null);
    setSavedGalleryId(null);
    setImageGenPrompt('');
    setIsEnhancing(false);
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      abortRef.current?.abort();
      abortRef.current = null;
    }
    onOpenChange(next);
  };

  const enhancePrompt = async () => {
    const draft = imageGenPrompt.trim();
    if (!draft) {
      toast.error('Type a prompt first, then enhance.');
      return;
    }
    setIsEnhancing(true);
    try {
      const res = await fetch('/api/voice-ai/enhance-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not enhance prompt');
      }
      let text = typeof data.enhanced === 'string' ? data.enhanced.trim() : '';
      if (text.startsWith('"') && text.endsWith('"')) {
        text = text.slice(1, -1).trim();
      }
      if (!text) throw new Error('AI returned an empty prompt');
      setImageGenPrompt(text);
      toast.success('Prompt enhanced');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Enhancement failed');
    } finally {
      setIsEnhancing(false);
    }
  };

  const runGeneration = async (prompt: string) => {
    if (!hasReferencePhoto) {
      toast.error(
        'Add a reference photo — expand "Reference photo" on this page or use Creator settings → Image generation.'
      );
      return;
    }
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.error('Enter an image prompt.');
      return;
    }
    if (generationInFlightRef.current) {
      return;
    }
    generationInFlightRef.current = true;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPhase('generating');
    setSavedGalleryId(null);
    try {
      const out = await requestGeneratedImageFromApi(trimmed, ac.signal);
      setPreview({ ...out, prompt: trimmed });
      setPhase('preview');
      toast.success('Image generated');
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        setPhase('prompt');
        return;
      }
      toast.error(e instanceof Error ? e.message : 'Image generation failed');
      setPhase('prompt');
    } finally {
      generationInFlightRef.current = false;
      if (abortRef.current === ac) abortRef.current = null;
    }
  };

  const confirmGenerate = () => {
    void runGeneration(imageGenPrompt);
  };

  const cancelGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase('prompt');
  };

  const backToPrompt = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase('prompt');
    setPreview(null);
    setSavedGalleryId(null);
  };

  const retryGeneration = () => {
    const p = preview?.prompt ?? imageGenPrompt.trim();
    if (!p) return;
    void runGeneration(p);
  };

  const saveToGallery = async () => {
    if (!preview) return;
    if (savedGalleryId) {
      toast.info('This image is already in your gallery');
      return;
    }
    setIsSaving(true);
    try {
      const id = await saveCreatorGalleryImage(
        supabase,
        profileId,
        preview.file,
        preview.prompt,
        preview.width,
        preview.height
      );
      setSavedGalleryId(id);
      onSavedToGallery?.();
      toast.success('Saved to your gallery');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const ensureGalleryIdAndGoToPost = async () => {
    if (!preview) return;
    setIsSaving(true);
    try {
      let id = savedGalleryId;
      if (!id) {
        id = await saveCreatorGalleryImage(
          supabase,
          profileId,
          preview.file,
          preview.prompt,
          preview.width,
          preview.height
        );
        setSavedGalleryId(id);
        onSavedToGallery?.();
      }
      handleOpenChange(false);
      onNavigateToNewPost(id);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to prepare post');
    } finally {
      setIsSaving(false);
    }
  };

  const title =
    phase === 'preview' ? 'Preview' : phase === 'generating' ? 'Generating…' : 'Generate image';

  const description =
    phase === 'preview'
      ? 'Save to your gallery or start a new post with this image.'
      : phase === 'generating'
        ? 'This usually takes a moment. You can cancel anytime.'
        : `Describe the scene you want. Your saved reference photo is used as the source. Each generation costs ${creditCost} credits.`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="!flex max-h-[min(80vh,80dvh)] w-full !flex-col gap-0 overflow-hidden rounded-2xl border-border/80 p-0 sm:max-w-lg [box-shadow:var(--brand-ring-money)]">
        <div
          className="shrink-0 px-6 pt-6 pb-4 pr-14"
          style={{ background: 'var(--brand-grad-soft)' }}
        >
          <div className="flex items-start gap-3.5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--brand-on-accent)]"
              style={{
                background: 'var(--brand-grad)',
                boxShadow: 'var(--brand-ring-money)',
              }}
            >
              {phase === 'generating' ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-5 w-5" aria-hidden />
              )}
            </div>
            <DialogHeader className="space-y-1.5 p-0 text-left">
              <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {phase === 'prompt' && (
            <div className="space-y-2">
              <label htmlFor="image-gen-prompt" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Prompt
              </label>
              <Textarea
                id="image-gen-prompt"
                value={imageGenPrompt}
                onChange={(e) => setImageGenPrompt(e.target.value)}
                placeholder="e.g. Same person, professional headshot, soft studio lighting…"
                disabled={isEnhancing}
                className="min-h-[100px] max-h-[min(35vh,280px)] resize-y overflow-y-auto rounded-xl border-border bg-card [field-sizing:fixed] focus-visible:ring-[var(--brand-violet)]/30 md:max-h-[min(40vh,320px)]"
              />
            </div>
          )}

          {phase === 'generating' && (
            <div className="space-y-3">
              <div className="max-h-[min(30vh,200px)] overflow-y-auto rounded-xl border border-border/80 bg-muted/30 px-3.5 py-2.5 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                {imageGenPrompt}
              </div>
              <div
                className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-xl border border-border/80 py-8"
                style={{ background: 'var(--brand-grad-soft)' }}
              >
                <Loader2
                  className="h-10 w-10 animate-spin"
                  style={{ color: 'var(--brand-violet)' }}
                  aria-hidden
                />
                <span className="text-sm font-medium text-foreground">Generating your image…</span>
              </div>
            </div>
          )}

          {phase === 'preview' && preview && (
            <div className="space-y-3">
              <div
                className="relative mx-auto h-[min(42vh,340px)] w-full max-w-md overflow-hidden rounded-xl border border-border/80 bg-muted sm:h-[min(48vh,380px)]"
                style={{ boxShadow: 'var(--brand-ring-money)' }}
              >
                <NextImage
                  src={preview.previewUrl}
                  alt="Generated preview"
                  fill
                  className="object-contain"
                  sizes="(max-width: 512px) 90vw, 448px"
                  unoptimized
                />
              </div>
              <p className="max-h-28 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
                {preview.prompt}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-muted/20 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:justify-end">
          {phase === 'prompt' && (
            <>
              <Button
                type="button"
                variant="outline"
                className={cn(brandOutlineBtn, 'mr-auto')}
                onClick={() => void enhancePrompt()}
                disabled={isEnhancing || !imageGenPrompt.trim()}
              >
                {isEnhancing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enhancing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Enhance with AI
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className={brandCancelBtn}
                onClick={() => handleOpenChange(false)}
                disabled={isEnhancing}
              >
                Cancel
              </Button>
              <Button type="button" className={brandPrimaryBtn} onClick={confirmGenerate} disabled={isEnhancing}>
                Generate
              </Button>
            </>
          )}

          {phase === 'generating' && (
            <Button type="button" variant="outline" className={brandCancelBtn} onClick={cancelGeneration}>
              Cancel
            </Button>
          )}

          {phase === 'preview' && preview && (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={brandOutlineBtn}
                  onClick={backToPrompt}
                  disabled={isSaving}
                >
                  Back to edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={brandOutlineBtn}
                  onClick={() => void retryGeneration()}
                  disabled={isSaving}
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
                <Button
                  type="button"
                  className={cn(brandPrimaryBtn, savedGalleryId && 'opacity-70')}
                  onClick={() => void saveToGallery()}
                  disabled={isSaving || !!savedGalleryId}
                >
                  {isSaving && !savedGalleryId ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : savedGalleryId ? (
                    'Saved'
                  ) : (
                    'Save to gallery'
                  )}
                </Button>
              </div>
              <Button
                type="button"
                className={cn(brandPrimaryBtn, 'w-full sm:w-auto')}
                onClick={() => void ensureGalleryIdAndGoToPost()}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Opening…
                  </>
                ) : (
                  'New post with this image'
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
