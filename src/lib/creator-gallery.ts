import type { SupabaseClient } from '@supabase/supabase-js';

export type CreatorGalleryRow = {
  id: string;
  profile_id: string;
  storage_path: string;
  prompt: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
};

export async function saveCreatorGalleryImage(
  supabase: SupabaseClient,
  profileId: string,
  file: File,
  prompt: string,
  width: number,
  height: number
): Promise<string> {
  const id = crypto.randomUUID();
  const ext =
    file.type.includes('jpeg') || file.type.includes('jpg')
      ? 'jpg'
      : file.type.includes('webp')
        ? 'webp'
        : 'png';
  const storagePath = `image-gen-gallery/${profileId}/${id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('creator-content')
    .upload(storagePath, file, { cacheControl: '3600', upsert: true });

  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from('creator_image_gen_gallery').insert({
    id,
    profile_id: profileId,
    storage_path: storagePath,
    prompt: prompt || null,
    width,
    height,
  });

  if (insertError) {
    await supabase.storage.from('creator-content').remove([storagePath]);
    throw insertError;
  }

  return id;
}

export async function deleteCreatorGalleryImage(
  supabase: SupabaseClient,
  profileId: string,
  row: Pick<CreatorGalleryRow, 'id' | 'storage_path'>
): Promise<void> {
  await supabase.storage.from('creator-content').remove([row.storage_path]);
  const { error } = await supabase
    .from('creator_image_gen_gallery')
    .delete()
    .eq('id', row.id)
    .eq('profile_id', profileId);
  if (error) throw error;
}
