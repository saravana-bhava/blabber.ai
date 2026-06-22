'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Camera, Upload, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { PersonaBuilderModal } from './PersonaBuilderModal';
import {
  AdminCard,
  AdminSectionTitle,
  AdminPill,
  AdminGhostButton,
} from '@/components/admin/admin-ui';

type Props = {
  profileId: string;
  sourcePath: string | null;
  onSourcePathChange: (path: string | null) => void;
};

export function CreatorImageGenReferencePanel({ profileId, sourcePath, onSourcePathChange }: Props) {
  const supabase = createClient();
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showPersonaBuilder, setShowPersonaBuilder] = useState(false);

  useEffect(() => {
    if (!sourcePath) {
      setPublicUrl(null);
      return;
    }
    const { data } = supabase.storage.from('creator-content').getPublicUrl(sourcePath);
    setPublicUrl(data.publicUrl);
  }, [sourcePath, supabase]);

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Image must be 15MB or smaller.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.error('Use JPG, PNG, WEBP, or GIF.');
      return;
    }
    void upload(file);
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const prevPath = sourcePath;
      const ext = file.name.split('.').pop() || (file.type.split('/')[1] ?? 'jpg');
      const fileName = `${profileId}-${Date.now()}.${ext}`;
      const filePath = `image-gen-reference/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('creator-content')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const { error: updateError } = await supabase
        .from('creators')
        .update({ image_gen_source_path: filePath })
        .eq('profile_id', profileId);

      if (updateError) throw new Error(updateError.message);

      if (prevPath && prevPath !== filePath) {
        await supabase.storage.from('creator-content').remove([prevPath]);
      }

      onSourcePathChange(filePath);
      toast.success('Reference photo saved.');
    } catch (error) {
      console.error('Image gen reference upload:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload reference photo');
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    if (!sourcePath) return;
    try {
      const { error: storageError } = await supabase.storage.from('creator-content').remove([sourcePath]);
      if (storageError) throw storageError;

      const { error: updateError } = await supabase
        .from('creators')
        .update({ image_gen_source_path: null })
        .eq('profile_id', profileId);

      if (updateError) throw updateError;

      onSourcePathChange(null);
      setPublicUrl(null);
      toast.success('Reference photo removed.');
    } catch (error) {
      console.error('Error deleting image gen reference:', error);
      toast.error('Failed to remove reference photo');
    }
  };

  const uploaderControls = (
    <div className="flex flex-wrap gap-2">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        capture="user"
        className="hidden"
        id="image-gen-ref-camera-studio"
        disabled={uploading}
        onChange={onFile}
      />
      <AdminGhostButton
        type="button"
        size="sm"
        disabled={uploading}
        className="h-9 gap-1.5 text-[13px]"
        onClick={() => document.getElementById('image-gen-ref-camera-studio')?.click()}
      >
        <Camera className="h-3.5 w-3.5" />
        Take or choose
      </AdminGhostButton>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        id="image-gen-ref-files-studio"
        disabled={uploading}
        onChange={onFile}
      />
      <AdminGhostButton
        type="button"
        size="sm"
        disabled={uploading}
        className="h-9 gap-1.5 text-[13px]"
        onClick={() => document.getElementById('image-gen-ref-files-studio')?.click()}
      >
        <Upload className="h-3.5 w-3.5" />
        Upload file
      </AdminGhostButton>
      <AdminGhostButton
        type="button"
        size="sm"
        className="h-9 gap-1.5 text-[13px]"
        onClick={() => setShowPersonaBuilder(true)}
      >
        <Wand2 className="h-3.5 w-3.5" />
        Make your persona
      </AdminGhostButton>
    </div>
  );

  const personaModal = (
    <PersonaBuilderModal
      open={showPersonaBuilder}
      onOpenChange={setShowPersonaBuilder}
      profileId={profileId}
      onSourceImageSaved={(newPath) => onSourcePathChange(newPath)}
    />
  );

  const settingsLink = (
    <Link
      href="/creator-settings"
      className="font-semibold text-[var(--brand-pink)] underline-offset-2 hover:underline"
    >
      Creator settings → Image generation
    </Link>
  );

  if (!sourcePath) {
    return (
      <>
        <AdminCard className="relative overflow-hidden" padding="lg">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{ background: 'var(--brand-grad-soft)' }}
          />
          <div className="relative">
            <div className="mb-3">
              <AdminPill variant="staff">Step 1</AdminPill>
            </div>
            <AdminSectionTitle
              title="Upload a source image first"
              description="AI image generation needs a reference photo of you (or your character). Add one here to unlock generating images, saving to your gallery, and starting posts from this studio."
            />
            <div className="space-y-2">
              {uploaderControls}
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WEBP, or GIF, up to 15MB. Or generate an AI persona.
              </p>
              {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
            </div>
            <p className="mt-4 text-[12.5px] text-muted-foreground">
              You can also manage this under {settingsLink}.
            </p>
          </div>
        </AdminCard>
        {personaModal}
      </>
    );
  }

  return (
    <>
      <details className="group admin-card text-sm open:ring-1 open:ring-[var(--brand-violet)]/30">
        <summary className="cursor-pointer list-none px-5 py-4 text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-foreground">Reference photo</span>
            <span className="text-xs opacity-80">used as the source for AI generations</span>
            <span className="text-xs text-muted-foreground group-open:hidden">· tap to manage</span>
          </span>
        </summary>
        <div className="space-y-3 border-t border-border px-5 pb-5 pt-3">
          <p className="text-xs text-muted-foreground">
            Same controls as {settingsLink}.
          </p>
          {publicUrl ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-border bg-secondary ring-2 ring-[var(--brand-grad-soft)]">
                <Image src={publicUrl} alt="Reference for image generation" fill className="object-cover" sizes="80px" />
              </div>
              <AdminGhostButton
                type="button"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => setShowPersonaBuilder(true)}
              >
                <Wand2 className="h-3.5 w-3.5" />
                Remake persona
              </AdminGhostButton>
              <Button type="button" variant="destructive" size="sm" className="h-9 rounded-full" onClick={() => void remove()} disabled={uploading}>
                Remove photo
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {uploaderControls}
              {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
            </div>
          )}
        </div>
      </details>
      {personaModal}
    </>
  );
}
