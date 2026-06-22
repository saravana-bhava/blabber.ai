'use client';

import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/contexts/user-context';

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, CreditCard, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { PageShell } from '@/components/layout/page-header';
import {
  AdminCard,
  AdminSectionTitle,
  AdminPill,
  AdminGradButton,
  AdminGhostButton,
  AdminLoadingSpinner,
  AdminStatusPill,
  adminInputClass,
  adminTextareaClass,
} from '@/components/admin/admin-ui';

interface Profile {
  id: string;
  updated_at?: string;
  full_name?: string | null;
  username?: string | null;
  credits?: number | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  website?: string | null;
  location?: string | null;
}

export default function ProfileSettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { session, profile: currentUserProfile, isLoading } = useUser();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');

  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(true);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; last4: string; brand: string | null; exp_month: number | null; exp_year: number | null; is_default: boolean }>>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      if (!mounted) return;
      setLoading(true);

      try {
        if (currentUserProfile && mounted) {
          setFullName(currentUserProfile.full_name || '');
          setUsername(currentUserProfile.username || '');
          setBio(currentUserProfile.bio || '');
          setLocation(currentUserProfile.location || '');
          setWebsite(currentUserProfile.website || '');
          setAvatarPreview(currentUserProfile.avatar_url || null);
          setBannerPreview(currentUserProfile.banner_url || null);
          setIsUsernameAvailable(true);
          setUsernameError(null);
        }
      } catch (e) {
        console.error("Unexpected error fetching data:", e);
        if (mounted) toast.error("An unexpected error occurred while loading data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => { mounted = false; };
  }, [currentUserProfile]);

  useEffect(() => {
    if (!currentUserProfile || username === currentUserProfile.username) {
      setIsUsernameAvailable(true);
      setUsernameError(null);
      setIsCheckingUsername(false);
      return;
    }

    if (username.length < 3) {
      setIsUsernameAvailable(false);
      setUsernameError("Username must be at least 3 characters.");
      setIsCheckingUsername(false);
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setIsUsernameAvailable(false);
      setUsernameError("Username can only contain letters, numbers, and underscores.");
      setIsCheckingUsername(false);
      return;
    }

    setIsCheckingUsername(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (error) {
        console.error("Error checking username:", error);
        setUsernameError("Error checking username. Please try again.");
        setIsUsernameAvailable(false);
      } else if (data) {
        setUsernameError("Username is already taken.");
        setIsUsernameAvailable(false);
      } else {
        setUsernameError(null);
        setIsUsernameAvailable(true);
      }
      setIsCheckingUsername(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [username, supabase, currentUserProfile]);

  useEffect(() => {
    if (!session?.user?.id) return;
    setPaymentMethodsLoading(true);
    supabase
      .from('user_payment_methods')
      .select('id, last4, brand, exp_month, exp_year, is_default')
      .eq('user_id', session.user.id)
      .order('is_default', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setPaymentMethods(data as any);
        setPaymentMethodsLoading(false);
      });
  }, [session?.user?.id, supabase]);

  const setDefaultPaymentMethod = async (id: string) => {
    if (!session?.user?.id) return;
    await supabase.from('user_payment_methods').update({ is_default: false }).eq('user_id', session.user.id);
    const { error } = await supabase.from('user_payment_methods').update({ is_default: true }).eq('id', id).eq('user_id', session.user.id);
    if (!error) {
      setPaymentMethods(prev => prev.map(p => ({ ...p, is_default: p.id === id })));
      toast.success('Default payment method updated');
    } else toast.error('Failed to update');
  };

  const removePaymentMethod = async (id: string) => {
    if (!session?.user?.id) return;
    const { error } = await supabase.from('user_payment_methods').delete().eq('id', id).eq('user_id', session.user.id);
    if (!error) {
      setPaymentMethods(prev => prev.filter(p => p.id !== id));
      toast.success('Payment method removed');
    } else toast.error('Failed to remove');
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'avatar') {
          setAvatarPreview(reader.result as string);
          setAvatarFile(file);
        }
        if (type === 'banner') {
          setBannerPreview(reader.result as string);
          setBannerFile(file);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadFile = async (file: File, bucket: string, userId: string, oldFilePath?: string | null): Promise<string | null> => {
    if (oldFilePath) {
      try {
        const { error: deleteError } = await supabase.storage.from(bucket).remove([oldFilePath]);
        if (deleteError) {
          console.warn(`Could not delete old ${bucket} file: ${oldFilePath}`, deleteError.message);
        }
      } catch (e) {
        console.warn(`Exception deleting old ${bucket} file: ${oldFilePath}`, e);
      }
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error(`Error uploading ${bucket} image:`, uploadError);
      toast.error(`Failed to upload ${bucket} image.`);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      toast.error(`Failed to get public URL for ${bucket} image.`);
      return null;
    }
    return publicUrlData.publicUrl;
  };

  const getPathFromUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    try {
      const parsedUrl = new URL(url);
      const pathParts = parsedUrl.pathname.split('/public/');
      if (pathParts.length > 1) {
        return pathParts[1];
      }
      return null;
    } catch (e) {
      console.error("Error parsing URL for old file path:", e);
      return null;
    }
  };

  const handleSaveProfile = async () => {
    if (!session?.user || !currentUserProfile) {
      toast.error("Cannot save: User or profile data is missing.");
      return;
    }

    if (username !== currentUserProfile.username) {
      if (username.length < 3) {
        toast.error("Username must be at least 3 characters.");
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        toast.error("Username can only contain letters, numbers, and underscores.");
        return;
      }
      setIsCheckingUsername(true);
      const { data, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', session.user.id)
        .maybeSingle();
      setIsCheckingUsername(false);
      if (checkError) {
        toast.error("Error validating username. Please try again.");
        return;
      }
      if (data) {
        toast.error("This username is already taken. Please choose another.");
        setIsUsernameAvailable(false);
        setUsernameError("Username is already taken.");
        return;
      }
    }

    setSaving(true);

    let newAvatarUrl = currentUserProfile?.avatar_url;
    if (avatarFile && session.user) {
      const oldAvatarPath = getPathFromUrl(currentUserProfile?.avatar_url);
      const uploadedAvatarUrl = await uploadFile(avatarFile, 'avatars', session.user.id, oldAvatarPath);
      if (uploadedAvatarUrl) {
        newAvatarUrl = uploadedAvatarUrl;
      } else {
        setSaving(false);
        return;
      }
    }

    let newBannerUrl = currentUserProfile?.banner_url;
    if (bannerFile && session.user) {
      const oldBannerPath = getPathFromUrl(currentUserProfile?.banner_url);
      const uploadedBannerUrl = await uploadFile(bannerFile, 'banners', session.user.id, oldBannerPath);
      if (uploadedBannerUrl) {
        newBannerUrl = uploadedBannerUrl;
      } else {
        setSaving(false);
        return;
      }
    }

    const updates: Partial<Profile> = {
      full_name: fullName,
      username: username,
      bio: bio,
      location: location,
      website: website,
      avatar_url: newAvatarUrl,
      banner_url: newBannerUrl,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id);

    if (error) {
      console.error("Error updating profile:", error);
      toast.error(`Failed to save profile: ${error.message}`);
    } else {
      toast.success("Profile saved successfully!");
      router.push(`/u/${username || currentUserProfile.username}`);
    }
    setSaving(false);
  };

  if (loading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <AdminLoadingSpinner className="min-h-[200px]" />
        <p className="text-sm text-muted-foreground">Loading profile settings…</p>
      </div>
    );
  }

  if (!session || !currentUserProfile) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4">
        <AdminCard className="max-w-md w-full text-center">
          <p className="text-sm text-muted-foreground mb-4">Could not load your session. You might need to log in again.</p>
          <AdminGradButton onClick={() => router.push('/')}>Go to login</AdminGradButton>
        </AdminCard>
      </div>
    );
  }

  return (
    <PageShell
      title="Edit profile"
      subtitle={currentUserProfile.username ? `@${currentUserProfile.username}` : 'Profile & appearance'}
      rightActions={
        <AdminPill variant="staff" className="hidden sm:inline-flex">
          Profile
        </AdminPill>
      }
      scrollClassName="pb-0"
    >
      <div className="max-w-[720px] mx-auto w-full min-w-0">
        <div
          className="group relative h-[180px] cursor-pointer overflow-hidden"
          onClick={() => bannerInputRef.current?.click()}
        >
          {bannerPreview ? (
            <Image src={bannerPreview} alt="Banner preview" fill className="object-cover" priority />
          ) : (
            <div
              className="w-full h-full [background:var(--brand-grad)]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(135deg, oklch(0.5 0.08 320 / 0.10) 0 2px, transparent 2px 11px), linear-gradient(135deg, var(--brand-violet), var(--brand-pink))',
              }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={36} className="text-white" />
          </div>
          <input type="file" accept="image/*" ref={bannerInputRef} onChange={(e: ChangeEvent<HTMLInputElement>) => handleImageChange(e, 'banner')} className="hidden" />
        </div>

        <div className="px-5 md:px-6 -mt-11 relative z-[1] mb-5">
          <div className="group relative cursor-pointer w-fit" onClick={() => avatarInputRef.current?.click()}>
            <div className="rounded-full border-4 border-background">
              <Avatar className="w-[92px] h-[92px] bg-muted">
                <AvatarImage src={avatarPreview || undefined} alt={currentUserProfile.full_name || currentUserProfile.username || 'User avatar'} />
                <AvatarFallback className="text-2xl font-display">
                  {(currentUserProfile.full_name || currentUserProfile.username || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 rounded-full transition-opacity">
              <Camera size={24} className="text-white" />
            </div>
            <input type="file" accept="image/*" ref={avatarInputRef} onChange={(e: ChangeEvent<HTMLInputElement>) => handleImageChange(e, 'avatar')} className="hidden" />
          </div>
        </div>

        <div className="px-5 md:px-6 space-y-5 pb-5">
          <AdminCard>
            <AdminSectionTitle
              title="Profile details"
              description="How you appear to fans across Blabber"
            />
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-semibold">Full name</Label>
                <Input id="fullName" className={adminInputClass} value={fullName} onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} placeholder="Your full name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold">Username</Label>
                <Input id="username" className={adminInputClass} value={username} onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)} placeholder="Your unique username" />
                {isCheckingUsername && <p className="text-xs text-muted-foreground">Checking username…</p>}
                {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
                {!isCheckingUsername && usernameError === null && username !== currentUserProfile?.username && username.length >= 3 && (
                  <p className="text-xs text-[var(--brand-gold)]">Username is available</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio" className="text-sm font-semibold">Bio</Label>
                <Textarea id="bio" className={adminTextareaClass} value={bio} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)} placeholder="Tell us about yourself…" maxLength={1000} />
                <p className="text-xs text-muted-foreground text-right tabular-nums">{bio.length}/1000</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-sm font-semibold">Location</Label>
                  <Input id="location" className={adminInputClass} value={location} onChange={(e: ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)} placeholder="Where are you based?" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website" className="text-sm font-semibold">Website</Label>
                  <Input id="website" type="url" className={adminInputClass} value={website} onChange={(e: ChangeEvent<HTMLInputElement>) => setWebsite(e.target.value)} placeholder="https://your-website.com" />
                </div>
              </div>
            </div>
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle
              title="Payment methods"
              description="Saved cards are used for subscription renewals and one-click checkout"
            />
            {paymentMethodsLoading ? (
              <AdminLoadingSpinner className="min-h-[80px]" />
            ) : paymentMethods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved payment methods. Add one when you make a purchase and choose to save your card.
              </p>
            ) : (
              <ul className="space-y-2">
                {paymentMethods.map((pm) => (
                  <li key={pm.id} className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-secondary/40 p-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <CreditCard className="h-4 w-4 text-[var(--brand-violet)] shrink-0" />
                      <span className="font-mono text-sm tabular-nums">•••• {pm.last4}</span>
                      <span className="text-sm text-muted-foreground capitalize">{pm.brand || 'Card'}</span>
                      {pm.exp_month != null && pm.exp_year != null && (
                        <span className="text-sm text-muted-foreground tabular-nums">{String(pm.exp_month).padStart(2, '0')}/{pm.exp_year}</span>
                      )}
                      {pm.is_default && <AdminStatusPill variant="gold">Default</AdminStatusPill>}
                    </div>
                    <div className="flex items-center gap-1">
                      {!pm.is_default && (
                        <AdminGhostButton size="sm" className="h-8 w-8 p-0" onClick={() => setDefaultPaymentMethod(pm.id)} title="Set as default">
                          <Star className="w-4 h-4" />
                        </AdminGhostButton>
                      )}
                      <AdminGhostButton size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => removePaymentMethod(pm.id)} title="Remove">
                        <Trash2 className="w-4 h-4" />
                      </AdminGhostButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminGradButton
            onClick={handleSaveProfile}
            disabled={saving || loading || isLoading || isCheckingUsername || !isUsernameAvailable}
            className="w-full"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </AdminGradButton>
        </div>
      </div>
    </PageShell>
  );
}
