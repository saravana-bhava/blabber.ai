'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/contexts/user-context';
import { CartesiaClient } from "@cartesia/cartesia-js";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Mic, Upload, StopCircle, Phone, Camera, Sparkles, Wand2, Settings, Crown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageShell } from '@/components/layout/page-header';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PersonalityCalibrationUI } from '@/components/creator-settings/PersonalityCalibrationUI';
import { PostOnboardingSharePopup, wasPostOnboardingShareShown, markPostOnboardingShareShown } from '@/components/onboarding/PostOnboardingSharePopup';
import { CallModal } from '@/components/call/CallModal';
import { PersonaBuilderModal } from '@/components/creator/PersonaBuilderModal';
import { cloneElevenVoiceFromStoragePath } from '@/lib/clone-eleven-voice-request';
import { uploadCreatorVoiceSample } from '@/lib/voice-sample-upload';
import { AiCallHourlyEarningsHint } from '@/components/creator/AiCallHourlyEarningsHint';
import {
  AdminCard,
  AdminSectionTitle,
  AdminPill,
  AdminGradButton,
  AdminGhostButton,
  AdminLoadingSpinner,
  adminInputClass,
  adminSelectTriggerClass,
  adminTabTriggerClass,
  adminTabListClass,
} from '@/components/admin/admin-ui';

// Initialize Cartesia client with API key
const cartesiaApiKey = process.env.NEXT_PUBLIC_CARTESIA_API_KEY;
if (!cartesiaApiKey) {
  console.error('Cartesia API key is not set in environment variables');
}

const cartesiaClient = new CartesiaClient({ 
  apiKey: cartesiaApiKey || ''
});

const VOICE_SAMPLE_MAX_SECONDS = 30;

const VOICE_SAMPLE_SCRIPT = `Hey there, thanks so much for stopping by — it honestly means a lot that you're here. I love getting to chat with the people who actually take the time to listen, message, and hang out with me. Whether you're catching up after a long day or just looking for someone to talk to, I'm always around. So tell me a little about yourself — what's been on your mind lately? I'd genuinely love to hear it.`;

interface Creator {
  profile_id: string;
  subscription_tier_enabled: boolean;
  subscription_price_cents: number | null;
  subscription_interval: 'month' | 'year' | null;
  ai_call_enabled: boolean;
  ai_dms_enabled: boolean;
  personality_prompt: string | null;
  voice_sample_path: string | null;
  image_gen_source_path: string | null;
  cartesia_voice_id: string | null;
  eleven_voice_id: string | null;
  ai_call_multi: number | null;
  ai_call_image_primary_path: string | null;
  ai_call_image_secondary_path: string | null;
  agency_profile_id?: string | null;
  agency_split_pct_override?: number | null;
  solana_address?: string | null;
  ethereum_address?: string | null;
  polygon_address?: string | null;
  bitcoin_address?: string | null;
  bank_account_number?: string | null;
  bank_routing_number?: string | null;
}

async function deleteElevenLabsVoice(voiceId: string) {
  const response = await fetch('/api/voice-ai/delete-voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voiceId }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error('Failed to delete ElevenLabs voice: ' + err);
  }
  return await response.json();
}

function CreatorSettingsContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, profile: currentUserProfile, isLoading, creator } = useUser();

  const [showPostOnboardingShare, setShowPostOnboardingShare] = useState(false);
  const [showTestCallModal, setShowTestCallModal] = useState(false);
  const [showPersonaBuilder, setShowPersonaBuilder] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageGenPublicUrl, setImageGenPublicUrl] = useState<string | null>(null);
  const [isUploadingImageGen, setIsUploadingImageGen] = useState(false);
  const [aiCallPrimaryUrl, setAiCallPrimaryUrl] = useState<string | null>(null);
  const [aiCallSecondaryUrl, setAiCallSecondaryUrl] = useState<string | null>(null);
  const [isUploadingCallPhoto, setIsUploadingCallPhoto] = useState<'primary' | 'secondary' | null>(null);

  // New settings state
  const [editedSettings, setEditedSettings] = useState<Creator | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [creatorSettings, setCreatorSettings] = useState<Creator | null>(null);
  const [agencyDefaultSplitPct, setAgencyDefaultSplitPct] = useState<number | null>(null);

  useEffect(() => {
    const fromOnboarding = searchParams.get('onboarding_complete') === '1';
    const forceShow = searchParams.get('show_post_onboarding_share') === '1';
    if (forceShow || (fromOnboarding && !wasPostOnboardingShareShown())) {
      setShowPostOnboardingShare(true);
    } else if (fromOnboarding && typeof window !== 'undefined') {
      // Share popup was already dismissed previously — strip the param so
      // downstream onboarding flows (e.g. the creator tour) can proceed.
      const url = new URL(window.location.href);
      url.searchParams.delete('onboarding_complete');
      router.replace(url.pathname + (url.search || ''));
    }
  }, [searchParams, router]);

  useEffect(() => {
    let mounted = true;
    const fetchCreatorData = async () => {
      if (!mounted) return;
      setLoading(true);

      try {
        if (currentUserProfile && mounted) {
          const { data: creator, error } = await supabase
            .from('creators')
            .select('*')
            .eq('profile_id', currentUserProfile.id)
            .single();

          if (error || !creator) {
            console.error("Error fetching creator data:", error);
            toast.error("Failed to load creator settings.");
            return;
          }

          if (creator.veriff_verification_status !== 'completed') {
            router.push('/become-a-creator');
            return;
          }

          if (creator && mounted) {
            setEditedSettings(creator);
          }
        }
      } catch (e) {
        console.error("Unexpected error fetching data:", e);
        if (mounted) toast.error("An unexpected error occurred while loading data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchCreatorData();
    return () => { mounted = false; };
  }, [currentUserProfile, supabase, router]);

  useEffect(() => {
    if (editedSettings?.voice_sample_path) {
      const { data: { publicUrl } } = supabase.storage
        .from('creator-content')
        .getPublicUrl(editedSettings.voice_sample_path, { download: false });
      setAudioUrl(publicUrl);
    } else {
      setAudioUrl(null);
    }
  }, [editedSettings?.voice_sample_path, supabase.storage]);

  useEffect(() => {
    if (editedSettings?.image_gen_source_path) {
      const { data: { publicUrl } } = supabase.storage
        .from('creator-content')
        .getPublicUrl(editedSettings.image_gen_source_path, { download: false });
      setImageGenPublicUrl(publicUrl);
    } else {
      setImageGenPublicUrl(null);
    }
  }, [editedSettings?.image_gen_source_path, supabase.storage]);

  useEffect(() => {
    const bucket = supabase.storage.from('creator-content');
    if (editedSettings?.ai_call_image_primary_path) {
      setAiCallPrimaryUrl(bucket.getPublicUrl(editedSettings.ai_call_image_primary_path, { download: false }).data.publicUrl);
    } else {
      setAiCallPrimaryUrl(null);
    }
    if (editedSettings?.ai_call_image_secondary_path) {
      setAiCallSecondaryUrl(bucket.getPublicUrl(editedSettings.ai_call_image_secondary_path, { download: false }).data.publicUrl);
    } else {
      setAiCallSecondaryUrl(null);
    }
  }, [
    editedSettings?.ai_call_image_primary_path,
    editedSettings?.ai_call_image_secondary_path,
    supabase.storage,
  ]);

  useEffect(() => {
    if (!editedSettings?.agency_profile_id) {
      setAgencyDefaultSplitPct(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('agencies')
        .select('default_split_pct')
        .eq('profile_id', editedSettings.agency_profile_id!)
        .maybeSingle();
      if (!cancelled) {
        setAgencyDefaultSplitPct(
          data?.default_split_pct != null ? Number(data.default_split_pct) : null
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editedSettings?.agency_profile_id, supabase]);

  const effectiveAgencySplitPct =
    editedSettings?.agency_profile_id != null
      ? (editedSettings.agency_split_pct_override ?? agencyDefaultSplitPct ?? null)
      : null;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 2
        } 
      });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: 'audio/webm;codecs=opus'
        });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= VOICE_SAMPLE_MAX_SECONDS) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please check your microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('File size must be less than 10MB');
        return;
      }
      setAudioBlob(file);
    }
  };

  const uploadAudio = async () => {
    if (!audioBlob || !session?.user) {
      toast.error('No audio data or user session available');
      return;
    }

    setIsUploading(true);
    try {

      const filePath = await uploadCreatorVoiceSample(
        supabase,
        session.user.id,
        audioBlob
      );

      // Update creator record with the new voice sample path
      const { error: updateError } = await supabase
        .from('creators')
        .update({ voice_sample_path: filePath })
        .eq('profile_id', session.user.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw new Error(`Failed to update creator record: ${updateError.message}`);
      }

      const voiceId = await cloneElevenVoiceFromStoragePath(filePath);
      const { error: elevenUpdateError } = await supabase
        .from('creators')
        .update({ eleven_voice_id: voiceId })
        .eq('profile_id', session.user.id);
      if (elevenUpdateError) {
        console.error('Error updating ElevenLabs voice ID:', elevenUpdateError);
        throw new Error(
          `Voice cloned but failed to save voice id: ${elevenUpdateError.message}`
        );
      }
      setEditedSettings(prev =>
        prev ? { ...prev, voice_sample_path: filePath, eleven_voice_id: voiceId } : null
      );

      setAudioBlob(null);
      toast.success('Voice sample uploaded successfully');
    } catch (error) {
      console.error('Error uploading audio:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload voice sample');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteVoiceSample = async () => {
    if (!editedSettings?.voice_sample_path || !session?.user) return;

    try {
      // Get the creator record to get the ElevenLabs voice ID
      const { data: creator, error: fetchError } = await supabase
        .from('creators')
        .select('eleven_voice_id')
        .eq('profile_id', session.user.id)
        .single();

      if (fetchError) throw fetchError;

      // Delete from ElevenLabs if we have a voice ID
      if (creator?.eleven_voice_id) {
        try {
          await deleteElevenLabsVoice(creator.eleven_voice_id);
        } catch (elevenError) {
          console.error('Error deleting voice from ElevenLabs:', elevenError);
          // Continue with local deletion even if ElevenLabs deletion fails
        }
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('creator-content')
        .remove([editedSettings.voice_sample_path]);

      if (storageError) throw storageError;

      // Update creator record
      const { error: updateError } = await supabase
        .from('creators')
        .update({ 
          voice_sample_path: null,
          eleven_voice_id: null 
        })
        .eq('profile_id', session.user.id);

      if (updateError) throw updateError;

      setEditedSettings(prev => prev ? { ...prev, voice_sample_path: null, eleven_voice_id: null } : null);
      setAudioUrl(null);
      toast.success('Voice sample deleted successfully');
    } catch (error) {
      console.error('Error deleting voice sample:', error);
      toast.error('Failed to delete voice sample');
    }
  };

  const handleImageGenReferenceFile = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    void uploadImageGenReference(file);
  };

  const uploadImageGenReference = async (file: File) => {
    if (!session?.user) {
      toast.error('You must be signed in.');
      return;
    }
    setIsUploadingImageGen(true);
    try {
      const prevPath = editedSettings?.image_gen_source_path;
      const ext = file.name.split('.').pop() || (file.type.split('/')[1] ?? 'jpg');
      const fileName = `${session.user.id}-${Date.now()}.${ext}`;
      const filePath = `image-gen-reference/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('creator-content')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const { error: updateError } = await supabase
        .from('creators')
        .update({ image_gen_source_path: filePath })
        .eq('profile_id', session.user.id);

      if (updateError) throw new Error(updateError.message);

      if (prevPath && prevPath !== filePath) {
        await supabase.storage.from('creator-content').remove([prevPath]);
      }

      setEditedSettings(prev => (prev ? { ...prev, image_gen_source_path: filePath } : null));
      toast.success('Reference photo saved for image generation.');
    } catch (error) {
      console.error('Image gen reference upload:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload reference photo');
    } finally {
      setIsUploadingImageGen(false);
    }
  };

  const handleDeleteImageGenReference = async () => {
    if (!editedSettings?.image_gen_source_path || !session?.user) return;
    try {
      const { error: storageError } = await supabase.storage
        .from('creator-content')
        .remove([editedSettings.image_gen_source_path]);
      if (storageError) throw storageError;

      const { error: updateError } = await supabase
        .from('creators')
        .update({ image_gen_source_path: null })
        .eq('profile_id', session.user.id);
      if (updateError) throw updateError;

      setEditedSettings(prev => (prev ? { ...prev, image_gen_source_path: null } : null));
      setImageGenPublicUrl(null);
      toast.success('Reference photo removed.');
    } catch (error) {
      console.error('Error deleting image gen reference:', error);
      toast.error('Failed to remove reference photo');
    }
  };

  const uploadAiCallModalPhoto = async (file: File, slot: 'primary' | 'secondary') => {
    if (!session?.user || !editedSettings) {
      toast.error('You must be signed in.');
      return;
    }
    setIsUploadingCallPhoto(slot);
    try {
      const prevKey =
        slot === 'primary'
          ? editedSettings.ai_call_image_primary_path
          : editedSettings.ai_call_image_secondary_path;
      const ext = file.name.split('.').pop() || (file.type.split('/')[1] ?? 'jpg');
      const filePath = `ai-call-modal/${session.user.id}/${slot}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('creator-content')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const patch =
        slot === 'primary'
          ? { ai_call_image_primary_path: filePath }
          : { ai_call_image_secondary_path: filePath };

      const { error: updateError } = await supabase.from('creators').update(patch).eq('profile_id', session.user.id);

      if (updateError) throw new Error(updateError.message);

      if (prevKey && prevKey !== filePath) {
        await supabase.storage.from('creator-content').remove([prevKey]);
      }

      setEditedSettings((prev) => (prev ? { ...prev, ...patch } : null));
      toast.success(slot === 'primary' ? 'Photo 1 saved.' : 'Photo 2 saved.');
    } catch (error) {
      console.error('AI call photo upload:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload photo');
    } finally {
      setIsUploadingCallPhoto(null);
    }
  };

  const handleAiCallPhotoFile = (slot: 'primary' | 'secondary', event: React.ChangeEvent<HTMLInputElement>) => {
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
    void uploadAiCallModalPhoto(file, slot);
  };

  const deleteAiCallModalPhoto = async (slot: 'primary' | 'secondary') => {
    if (!session?.user || !editedSettings) return;
    const path =
      slot === 'primary'
        ? editedSettings.ai_call_image_primary_path
        : editedSettings.ai_call_image_secondary_path;
    if (!path) return;
    try {
      const { error: storageError } = await supabase.storage.from('creator-content').remove([path]);
      if (storageError) throw storageError;

      const patch =
        slot === 'primary'
          ? { ai_call_image_primary_path: null }
          : { ai_call_image_secondary_path: null };

      const { error: updateError } = await supabase.from('creators').update(patch).eq('profile_id', session.user.id);
      if (updateError) throw updateError;

      setEditedSettings((prev) => (prev ? { ...prev, ...patch } : null));
      toast.success('Photo removed.');
    } catch (error) {
      console.error('Delete call photo:', error);
      toast.error('Failed to remove photo');
    }
  };

  // Settings change handler
  const handleSettingsChange = (key: keyof Creator, value: any) => {
    if (!editedSettings) return;
    setEditedSettings(prev => prev ? { ...prev, [key]: value } : null);
    setIsDirty(true);
  };

  // Load creator settings
  const loadCreatorSettings = async () => {
    if (!currentUserProfile?.id) return;
    try {
      const { data: settings, error } = await supabase
        .from('creators')
        .select('*')
        .eq('profile_id', currentUserProfile.id)
        .single();
      if (error) throw error;
      setCreatorSettings(settings);
      setEditedSettings(JSON.parse(JSON.stringify(settings)));
      setIsDirty(false);
    } catch (error) {
      console.error('Error loading creator settings:', error);
      toast.error('Failed to load creator settings');
    }
  };

  // Save settings
  const handleSaveSettings = async () => {
    if (!editedSettings || !session?.user || !currentUserProfile) {
      toast.error('Cannot save: User or profile data is missing.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('creators')
        .update(editedSettings)
        .eq('profile_id', currentUserProfile.id);
      if (error) {
        console.error('Error updating creator settings:', error);
        toast.error(`Failed to save settings: ${error.message}`);
      } else {
        toast.success('Settings saved successfully!');
        setIsDirty(false);
        loadCreatorSettings();
        // Optionally: router.push(`/u/${currentUserProfile.username}`);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <PageShell title="Creator settings">
        <AdminLoadingSpinner className="min-h-[320px]" />
      </PageShell>
    );
  }

  if (!session || !currentUserProfile) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen space-y-4 p-4">
        <p className="text-muted-foreground text-sm">Could not load your session. You might need to log in again.</p>
        <AdminGradButton onClick={() => router.push('/')}>Go to login</AdminGradButton>
      </div>
    );
  }

  return (
    <>
      <PageShell
        title="Creator settings"
        subtitle={
          currentUserProfile.username
            ? `@${currentUserProfile.username} · profile & monetization`
            : 'Profile & monetization'
        }
        rightActions={
          isDirty ? (
            <AdminPill variant="gold" className="hidden sm:inline-flex">
              Unsaved changes
            </AdminPill>
          ) : (
            <AdminPill variant="staff" className="hidden sm:inline-flex">
              <Crown className="h-3.5 w-3.5" />
              Creator
            </AdminPill>
          )
        }
      >
        <div className="max-w-[820px] mx-auto w-full min-w-0 px-5 md:px-6 py-5 pb-16 overflow-x-hidden">
          {editedSettings && (
            <Tabs defaultValue="general" className="min-w-0 space-y-6">
              <TabsList className={adminTabListClass}>
                <TabsTrigger value="general" className={adminTabTriggerClass}>
                  <Settings className="h-4 w-4" />
                  General
                </TabsTrigger>
                <TabsTrigger value="ai" className={adminTabTriggerClass} data-creator-tour="ai-tab-trigger">
                  <Sparkles className="h-4 w-4" />
                  AI
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-6 mt-0">
              <AdminCard data-creator-tour="subscription-card">
                <AdminSectionTitle
                  title="Subscription settings"
                  description="Configure your subscription tier"
                />
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="subscription-enabled" className="text-sm font-semibold">Enable Subscription Tier</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow users to subscribe to your content
                      </p>
                    </div>
                    <Switch
                      id="subscription-enabled"
                      checked={editedSettings.subscription_tier_enabled}
                      onCheckedChange={(checked) => handleSettingsChange('subscription_tier_enabled', checked)}
                    />
                  </div>

                  {editedSettings.subscription_tier_enabled && (
                    <>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="subscription-price" className="text-sm font-semibold">Price</Label>
                          <Input
                            id="subscription-price"
                            type="number"
                            min={5}
                            step={0.01}
                            value={
                              editedSettings.subscription_price_cents !== null && editedSettings.subscription_price_cents !== undefined
                                ? (editedSettings.subscription_price_cents / 100).toFixed(2)
                                : ''
                            }
                            onChange={e => {
                              const value = e.target.value;
                              // Only allow numbers and decimals
                              const numericValue = value.replace(/[^\d.]/g, '');
                              // Parse as float, then convert to cents
                              const floatVal = parseFloat(numericValue);
                              if (!isNaN(floatVal)) {
                                handleSettingsChange('subscription_price_cents', Math.round(floatVal * 100));
                              } else {
                                handleSettingsChange('subscription_price_cents', null);
                              }
                            }}
                            placeholder="$5.00 minimum"
                            className={adminInputClass}
                            inputMode="decimal"
                          />
                          <p className="text-xs text-muted-foreground">Minimum $5.00</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subscription-interval" className="text-sm font-semibold">Interval</Label>
                          <Select
                            value={editedSettings.subscription_interval || ''}
                            onValueChange={(value: 'week' | 'month' | 'year') => handleSettingsChange('subscription_interval', value)}
                          >
                            <SelectTrigger className={adminSelectTriggerClass}>
                              <SelectValue placeholder="Select interval" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="week">Weekly</SelectItem>
                              <SelectItem value="month">Monthly</SelectItem>
                              <SelectItem value="year">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </AdminCard>

              <AdminCard>
                <AdminSectionTitle
                  title="Payment addresses"
                  description="Wallet addresses for crypto payouts (all fields optional)"
                />
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="ethereum-address" className="text-sm font-semibold">Ethereum address</Label>
                      <Input
                        id="ethereum-address"
                        type="text"
                        value={editedSettings.ethereum_address || ''}
                        onChange={(e) => handleSettingsChange('ethereum_address', e.target.value || null)}
                        placeholder="0x..."
                        className={`${adminInputClass} font-mono text-sm`}
                      />
                      <p className="text-xs text-muted-foreground">USDC on Ethereum network</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="polygon-address" className="text-sm font-semibold">Polygon address</Label>
                      <Input
                        id="polygon-address"
                        type="text"
                        value={editedSettings.polygon_address || ''}
                        onChange={(e) => handleSettingsChange('polygon_address', e.target.value || null)}
                        placeholder="0x..."
                        className={`${adminInputClass} font-mono text-sm`}
                      />
                      <p className="text-xs text-muted-foreground">USDC on Polygon network</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="solana-address" className="text-sm font-semibold">Solana address</Label>
                      <Input
                        id="solana-address"
                        type="text"
                        value={editedSettings.solana_address || ''}
                        onChange={(e) => handleSettingsChange('solana_address', e.target.value || null)}
                        placeholder="Base58 address..."
                        className={`${adminInputClass} font-mono text-sm`}
                      />
                      <p className="text-xs text-muted-foreground">USDC on Solana network</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bitcoin-address" className="text-sm font-semibold">Bitcoin address</Label>
                      <Input
                        id="bitcoin-address"
                        type="text"
                        value={editedSettings.bitcoin_address || ''}
                        onChange={(e) => handleSettingsChange('bitcoin_address', e.target.value || null)}
                        placeholder="bc1... or 1... or 3..."
                        className={`${adminInputClass} font-mono text-sm`}
                      />
                      <p className="text-xs text-muted-foreground">BTC on Bitcoin network</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border space-y-4">
                    <h4 className="text-sm font-bold">Bank account (USD payouts)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="bank-account-number" className="text-sm font-semibold">Account number</Label>
                        <Input
                          id="bank-account-number"
                          type="text"
                          value={editedSettings.bank_account_number || ''}
                          onChange={(e) => handleSettingsChange('bank_account_number', e.target.value || null)}
                          placeholder="Enter account number"
                          className={adminInputClass}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bank-routing-number" className="text-sm font-semibold">Routing number</Label>
                        <Input
                          id="bank-routing-number"
                          type="text"
                          value={editedSettings.bank_routing_number || ''}
                          onChange={(e) => handleSettingsChange('bank_routing_number', e.target.value || null)}
                          placeholder="Enter routing number"
                          className={adminInputClass}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </AdminCard>

              <AdminGradButton className="w-full h-12" onClick={handleSaveSettings} disabled={!isDirty || saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save changes
                  </>
                )}
              </AdminGradButton>
              </TabsContent>

              <TabsContent value="ai" className="mt-0 min-w-0 space-y-6">
              <AdminCard className="min-w-0 overflow-x-hidden">
                <AdminSectionTitle
                  title="AI features"
                  description="Configure AI-powered calls, DMs, and personality"
                />
                <div className="min-w-0 space-y-6">
                  {editedSettings.ai_call_enabled && editedSettings.eleven_voice_id && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <Label>Test your AI call</Label>
                        <p className="text-sm text-muted-foreground">
                          Try a call with no credits used
                        </p>
                      </div>
                      <AdminGhostButton
                        type="button"
                        onClick={() => setShowTestCallModal(true)}
                        className="w-full shrink-0 gap-2 sm:w-auto h-10"
                      >
                        <Phone className="h-4 w-4" />
                        Test call
                      </AdminGhostButton>
                    </div>
                  )}
                  <div
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    data-creator-tour="ai-call-toggle"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label htmlFor="ai-calls">Enable AI Calls</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow AI-powered voice calls with your personality
                      </p>
                    </div>
                    <Switch
                      id="ai-calls"
                      className="shrink-0 self-start sm:self-center"
                      checked={editedSettings.ai_call_enabled}
                      onCheckedChange={(checked) => handleSettingsChange('ai_call_enabled', checked)}
                    />
                  </div>

                  {/* AI Call Credit Cost Multiplier Field */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label htmlFor="ai-call-multi">AI Call Credit Cost</Label>
                      <p className="text-sm text-muted-foreground break-words">
                        Credits charged per billing interval during a call (minimum 1).
                        <AiCallHourlyEarningsHint
                          aiCallMulti={editedSettings.ai_call_multi}
                          agencySplitPct={effectiveAgencySplitPct}
                        />
                      </p>
                    </div>
                    <Input
                      id="ai-call-multi"
                      type="number"
                      min={1}
                      step={1}
                      value={editedSettings.ai_call_multi ?? 1}
                      onChange={e => {
                        let value = parseInt(e.target.value, 10);
                        if (isNaN(value) || value < 1) value = 1;
                        handleSettingsChange('ai_call_multi', value);
                      }}
                      disabled={!editedSettings.ai_call_enabled}
                      className={`${adminInputClass} w-full shrink-0 sm:w-28`}
                    />
                  </div>

                  {editedSettings.ai_call_enabled && (
                    <div
                      className="space-y-4 rounded-2xl border border-border p-4"
                      style={{ background: 'var(--brand-grad-soft)' }}
                    >
                      <div>
                        <Label className="text-base">Pictures for AI calls</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Fans usually see your profile photo when they start an AI call with you. Leave this blank to keep
                          that. Or add photos here to show a different picture instead. You can add up to two—we’ll use
                          one of them when the call starts.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Photo 1</Label>
                          <div className="flex flex-col gap-2">
                            {aiCallPrimaryUrl ? (
                              <div className="relative aspect-square w-full max-w-[160px] rounded-md overflow-hidden border">
                                <Image src={aiCallPrimaryUrl} alt="Photo 1 for calls" fill className="object-cover" />
                              </div>
                            ) : (
                              <div className="aspect-square w-full max-w-[160px] rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground p-2 text-center">
                                None yet
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" variant="outline" size="sm" disabled={isUploadingCallPhoto !== null} asChild>
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    className="hidden"
                                    onChange={(e) => handleAiCallPhotoFile('primary', e)}
                                  />
                                  {isUploadingCallPhoto === 'primary' ? 'Uploading…' : 'Upload'}
                                </label>
                              </Button>
                              {editedSettings.ai_call_image_primary_path && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => void deleteAiCallModalPhoto('primary')}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Photo 2 (optional)</Label>
                          <div className="flex flex-col gap-2">
                            {aiCallSecondaryUrl ? (
                              <div className="relative aspect-square w-full max-w-[160px] rounded-md overflow-hidden border">
                                <Image src={aiCallSecondaryUrl} alt="Photo 2 for calls" fill className="object-cover" />
                              </div>
                            ) : (
                              <div className="aspect-square w-full max-w-[160px] rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground p-2 text-center">
                                None yet
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" variant="outline" size="sm" disabled={isUploadingCallPhoto !== null} asChild>
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    className="hidden"
                                    onChange={(e) => handleAiCallPhotoFile('secondary', e)}
                                  />
                                  {isUploadingCallPhoto === 'secondary' ? 'Uploading…' : 'Upload'}
                                </label>
                              </Button>
                              {editedSettings.ai_call_image_secondary_path && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => void deleteAiCallModalPhoto('secondary')}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label htmlFor="ai-dms">Enable AI DMs</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow AI-powered direct messages with your personality
                      </p>
                    </div>
                    <Switch
                      id="ai-dms"
                      className="shrink-0 self-start sm:self-center"
                      checked={editedSettings.ai_dms_enabled}
                      onCheckedChange={(checked) => handleSettingsChange('ai_dms_enabled', checked)}
                    />
                  </div>

                  {(editedSettings.ai_call_enabled || editedSettings.ai_dms_enabled) && (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-base font-semibold">Personality & boundaries</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          The options below build your personality prompt. Save at the bottom to apply.
                        </p>
                      </div>
                      <PersonalityCalibrationUI
                        value={editedSettings.personality_prompt || ''}
                        onChange={(prompt) => handleSettingsChange('personality_prompt', prompt)}
                        disabled={false}
                      />
                    </div>
                  )}
                </div>
              </AdminCard>

              <AdminCard className="min-w-0 overflow-x-hidden">
                <AdminSectionTitle
                  title="Voice sample"
                  description="Upload a voice sample for AI voice cloning"
                />
                <div className="min-w-0 space-y-6">
                  {editedSettings.voice_sample_path ? (
                    <div className="space-y-4">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
                        <audio 
                          controls 
                          src={audioUrl || undefined} 
                          className="w-full min-w-0 max-w-full sm:max-w-md"
                          preload="metadata"
                          crossOrigin="anonymous"
                        >
                          Your browser does not support the audio element.
                        </audio>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleDeleteVoiceSample}
                          className="flex shrink-0 items-center gap-2 self-start sm:self-center"
                        >
                          Delete Sample
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Voice sample uploaded successfully. This will be used for AI voice cloning.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg border bg-muted/40 p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">Read this aloud while recording</p>
                          <span className="text-xs text-muted-foreground">~30 seconds</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                          {VOICE_SAMPLE_SCRIPT}
                        </p>
                        <p className="mt-3 text-xs text-muted-foreground">
                          Reading the same script gives our AI a consistent sample to clone. Speak naturally — like you would to a fan.
                        </p>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={isRecording ? stopRecording : startRecording}
                          disabled={isUploading}
                          className="flex shrink-0 items-center gap-2"
                        >
                          {isRecording ? (
                            <>
                              <StopCircle className="h-4 w-4" />
                              Stop Recording ({VOICE_SAMPLE_MAX_SECONDS - recordingTime}s)
                            </>
                          ) : (
                            <>
                              <Mic className="h-4 w-4" />
                              Record
                            </>
                          )}
                        </Button>
                        <div className="relative">
                          <input
                            type="file"
                            accept="audio/mpeg,audio/mp3,audio/mp4,audio/wav,audio/x-m4a,audio/*"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="audio-upload"
                            disabled={isUploading}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById('audio-upload')?.click()}
                            disabled={isUploading}
                            className="flex items-center gap-2"
                          >
                            <Upload className="h-4 w-4" />
                            Upload
                          </Button>
                        </div>
                        {audioBlob && (
                          <Button
                            type="button"
                            onClick={uploadAudio}
                            disabled={isUploading}
                            className="flex items-center gap-2"
                          >
                            {isUploading ? 'Uploading...' : 'Submit Voice Sample'}
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Record or upload a voice sample (max {VOICE_SAMPLE_MAX_SECONDS} seconds) to enable AI voice cloning for calls and messages.
                      </p>
                    </div>
                  )}
                </div>
              </AdminCard>

              {creator?.can_img_gen && (
              <AdminCard className="min-w-0 overflow-x-hidden">
                <AdminSectionTitle
                  title="Image generation"
                  description="Reference photo used when generating post images"
                />
                <div className="min-w-0 space-y-6">
                  {editedSettings.image_gen_source_path ? (
                    <div className="space-y-4">
                      <div className="relative w-full max-w-xs aspect-square rounded-lg overflow-hidden border bg-muted">
                        {imageGenPublicUrl ? (
                          <Image
                            src={imageGenPublicUrl}
                            alt="Reference for image generation"
                            fill
                            className="object-cover"
                            sizes="256px"
                          />
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          onClick={() => setShowPersonaBuilder(true)}
                        >
                          <Wand2 className="h-4 w-4" />
                          Remake persona
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleDeleteImageGenReference}
                          disabled={isUploadingImageGen}
                        >
                          Remove photo
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                            This image is used by our AI image generation when you tap generate in the new post composer.
                          </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          capture="user"
                          className="hidden"
                          id="image-gen-camera-settings"
                          disabled={isUploadingImageGen}
                          onChange={handleImageGenReferenceFile}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isUploadingImageGen}
                          className="gap-2"
                          onClick={() => document.getElementById('image-gen-camera-settings')?.click()}
                        >
                          <Camera className="h-4 w-4" />
                          Take or choose photo
                        </Button>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          id="image-gen-upload-settings"
                          disabled={isUploadingImageGen}
                          onChange={handleImageGenReferenceFile}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isUploadingImageGen}
                          className="gap-2"
                          onClick={() => document.getElementById('image-gen-upload-settings')?.click()}
                        >
                          <Upload className="h-4 w-4" />
                          Upload from files
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          onClick={() => setShowPersonaBuilder(true)}
                        >
                          <Wand2 className="h-4 w-4" />
                          Make your persona
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        JPG, PNG, WEBP, or GIF, up to 15MB. Or generate an AI persona.
                      </p>
                      {isUploadingImageGen && (
                        <p className="text-sm text-muted-foreground">Uploading…</p>
                      )}
                    </div>
                  )}
                </div>
              </AdminCard>
              )}

              <AdminGradButton className="w-full h-12" onClick={handleSaveSettings} disabled={!isDirty || saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save changes
                  </>
                )}
              </AdminGradButton>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </PageShell>
      {editedSettings && currentUserProfile && (
        <CallModal
          isOpen={showTestCallModal}
          onClose={() => setShowTestCallModal(false)}
          personalityPrompt={editedSettings.personality_prompt}
          elevenVoiceId={editedSettings.eleven_voice_id}
          creatorId={currentUserProfile.id}
          testMode
        />
      )}
      {currentUserProfile && creator?.can_img_gen && (
        <PersonaBuilderModal
          open={showPersonaBuilder}
          onOpenChange={setShowPersonaBuilder}
          profileId={currentUserProfile.id}
          onSourceImageSaved={(newPath) => {
            setEditedSettings((prev) => (prev ? { ...prev, image_gen_source_path: newPath } : null));
          }}
        />
      )}
      {currentUserProfile?.username && (
        <PostOnboardingSharePopup
          open={showPostOnboardingShare}
          onOpenChange={(o) => {
            setShowPostOnboardingShare(o);
            if (!o) {
              markPostOnboardingShareShown();
              const url = new URL(window.location.href);
              url.searchParams.delete('onboarding_complete');
              url.searchParams.delete('show_post_onboarding_share');
              router.replace(url.pathname + (url.search || ''));
            }
          }}
          shareLink={
            typeof window !== 'undefined'
              ? `${window.location.origin}/u/${currentUserProfile.username}`
              : `/u/${currentUserProfile.username}`
          }
          suggestedAmount={50}
        />
      )}
    </>
  );
}

export default function CreatorSettingsPage() {
  return (
    <Suspense
      fallback={
        <PageShell title="Creator settings">
          <AdminLoadingSpinner className="min-h-[320px]" />
        </PageShell>
      }
    >
      <CreatorSettingsContent />
    </Suspense>
  );
}