'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { PageShell } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { CreatorImageGenDialog } from '@/components/creator/CreatorImageGenDialog';
import { CreatorImageGenReferencePanel } from '@/components/creator/CreatorImageGenReferencePanel';
import type { CreatorGalleryRow } from '@/lib/creator-gallery';
import { deleteCreatorGalleryImage } from '@/lib/creator-gallery';
import { toast } from 'sonner';
import { FileImage, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AdminCard,
  AdminSectionTitle,
  AdminPill,
  AdminGradButton,
  AdminLoadingSpinner,
} from '@/components/admin/admin-ui';

export default function CreatorImageGenPage() {
  const supabase = createClient();
  const router = useRouter();
  const { profile, isLoading } = useUser();
  const [isCreator, setIsCreator] = useState(false);
  const [canImgGen, setCanImgGen] = useState(false);
  const [checkingCreator, setCheckingCreator] = useState(true);
  const [imageGenSourcePath, setImageGenSourcePath] = useState<string | null>(null);
  const [gallery, setGallery] = useState<CreatorGalleryRow[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);

  const loadGallery = useCallback(async () => {
    if (!profile?.id) return;
    setLoadingGallery(true);
    try {
      const { data, error } = await supabase
        .from('creator_image_gen_gallery')
        .select('id, profile_id, storage_path, prompt, width, height, created_at')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGallery((data as CreatorGalleryRow[]) ?? []);
    } catch (e) {
      console.error(e);
      toast.error('Could not load gallery');
      setGallery([]);
    } finally {
      setLoadingGallery(false);
    }
  }, [profile?.id, supabase]);

  useEffect(() => {
    const run = async () => {
      if (!profile?.id) {
        setCheckingCreator(true);
        return;
      }
      setCheckingCreator(true);
      const { data: creator, error } = await supabase
        .from('creators')
        .select('profile_id, image_gen_source_path, can_img_gen')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (error || !creator) {
        setIsCreator(false);
        setCanImgGen(false);
        setImageGenSourcePath(null);
      } else {
        setIsCreator(true);
        setCanImgGen(!!creator.can_img_gen);
        setImageGenSourcePath(creator.image_gen_source_path ?? null);
      }
      setCheckingCreator(false);
    };
    void run();
  }, [profile?.id, supabase]);

  useEffect(() => {
    if (profile?.id && isCreator) void loadGallery();
  }, [profile?.id, isCreator, loadGallery]);

  useEffect(() => {
    if (!isLoading && !checkingCreator && profile && (!isCreator || !canImgGen)) {
      router.replace(isCreator ? '/creator-dashboard' : '/become-a-creator');
    }
  }, [isLoading, checkingCreator, profile, isCreator, canImgGen, router]);

  const handleDelete = async (row: CreatorGalleryRow) => {
    if (!profile?.id) return;
    setDeletingId(row.id);
    try {
      await deleteCreatorGalleryImage(supabase, profile.id, row);
      setGallery((prev) => prev.filter((r) => r.id !== row.id));
      toast.success('Removed from gallery');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const publicUrlForPath = (path: string) =>
    supabase.storage.from('creator-content').getPublicUrl(path).data.publicUrl;

  const hasReferencePhoto = !!imageGenSourcePath;

  const openGalleryLightbox = useCallback(
    (clickedIndex: number) => {
      if (gallery.length === 0) return;
      const slides = gallery.map((row) => ({
        src: supabase.storage.from('creator-content').getPublicUrl(row.storage_path).data.publicUrl,
      }));
      setLightboxSlides(slides);
      setLightboxIndex(clickedIndex);
      setLightboxOpen(true);
    },
    [gallery, supabase]
  );

  if (isLoading || !profile || checkingCreator || !isCreator || !canImgGen) {
    return (
      <RequireAuth>
        <PageShell title="AI image studio">
          <AdminLoadingSpinner className="min-h-[320px]" />
        </PageShell>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <PageShell
        title="AI image studio"
        subtitle="Generate, save, and post AI images from your reference photo"
        rightActions={
          <AdminPill variant="staff" className="hidden sm:inline-flex">
            <Sparkles className="h-3.5 w-3.5" />
            Image gen
          </AdminPill>
        }
      >
        <div className="max-w-[820px] mx-auto px-5 md:px-6 py-5 pb-16 space-y-6">
          <CreatorImageGenReferencePanel
            profileId={profile.id}
            sourcePath={imageGenSourcePath}
            onSourcePathChange={setImageGenSourcePath}
          />

          <div
            className={cn(
              'space-y-6 transition-[opacity,filter] duration-200',
              !hasReferencePhoto && 'pointer-events-none select-none opacity-[0.38] grayscale-[0.35]'
            )}
            inert={!hasReferencePhoto ? true : undefined}
            aria-hidden={!hasReferencePhoto ? true : undefined}
          >
            <AdminCard>
              <AdminSectionTitle
                title="Generate images"
                description="Create new images from your reference photo, save them to your gallery, then start a post with any image."
              />
              <AdminGradButton
                type="button"
                className="h-11"
                disabled={!hasReferencePhoto}
                onClick={() => setDialogOpen(true)}
              >
                <Sparkles className="h-4 w-4" />
                New generation
              </AdminGradButton>
            </AdminCard>

            <AdminCard>
              <AdminSectionTitle
                title="Your gallery"
                description={
                  gallery.length > 0
                    ? `${gallery.length} saved image${gallery.length === 1 ? '' : 's'}`
                    : 'Saved generations appear here'
                }
              />
              {loadingGallery ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-7 w-7 animate-spin text-[var(--brand-pink)]" />
                </div>
              ) : gallery.length === 0 ? (
                <div
                  className="rounded-2xl border border-dashed border-border px-6 py-10 text-center"
                  style={{ background: 'var(--brand-grad-soft)' }}
                >
                  <FileImage className="mx-auto h-8 w-8 text-[var(--brand-pink)] mb-3" />
                  <p className="text-sm font-semibold">No saved images yet</p>
                  <p className="text-[12.5px] text-muted-foreground mt-1 max-w-md mx-auto">
                    Generate one and click &quot;Save to gallery&quot;, or use &quot;New post with this
                    image&quot; from the preview.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {gallery.map((row, index) => (
                    <div
                      key={row.id}
                      className="admin-card overflow-hidden flex flex-col"
                    >
                      <button
                        type="button"
                        className="relative aspect-square w-full cursor-zoom-in border-0 p-0 text-left bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-pink)] focus-visible:ring-offset-2"
                        onClick={() => openGalleryLightbox(index)}
                        aria-label="View image larger"
                      >
                        <NextImage
                          src={publicUrlForPath(row.storage_path)}
                          alt={row.prompt?.slice(0, 80) || 'Generated image'}
                          fill
                          className="object-cover transition-opacity hover:opacity-95"
                          sizes="(max-width: 640px) 50vw, 200px"
                        />
                      </button>
                      <div className="flex gap-1.5 p-2 border-t border-border bg-card/80">
                        <AdminGradButton
                          type="button"
                          size="sm"
                          className="flex-1 h-8 text-xs px-3"
                          onClick={() => router.push(`/new-post?galleryImage=${row.id}`)}
                        >
                          New post
                        </AdminGradButton>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-8 px-2.5 shrink-0 rounded-full"
                          disabled={deletingId === row.id}
                          onClick={() => void handleDelete(row)}
                          aria-label="Delete from gallery"
                        >
                          {deletingId === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AdminCard>
          </div>
        </div>
      </PageShell>

      {lightboxOpen && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={lightboxSlides}
          index={lightboxIndex}
          plugins={[Zoom]}
          render={{
            buttonPrev: lightboxSlides.length <= 1 ? () => null : undefined,
            buttonNext: lightboxSlides.length <= 1 ? () => null : undefined,
          }}
          animation={{
            fade: lightboxSlides.length <= 1 ? 0 : undefined,
            swipe: lightboxSlides.length <= 1 ? 0 : undefined,
          }}
          controller={{
            closeOnBackdropClick: lightboxSlides.length > 0,
          }}
        />
      )}

      <CreatorImageGenDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        profileId={profile.id}
        hasReferencePhoto={hasReferencePhoto}
        onSavedToGallery={() => void loadGallery()}
        onNavigateToNewPost={(galleryImageId) => router.push(`/new-post?galleryImage=${galleryImageId}`)}
      />
    </RequireAuth>
  );
}
