'use client';

import { useRef, useState, useCallback } from 'react';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, RefreshCw, Save, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { requestGeneratedImageFromApi } from '@/lib/image-gen-client';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useImageGenCreditCost } from '@/lib/hooks/use-image-gen-credit-cost';

// ── Option data ──────────────────────────────────────────────

const GENDER_OPTIONS = ['Woman', 'Man', 'Non-binary'] as const;

const AGE_OPTIONS = [
  { label: '18-21', prompt: '20 year old' },
  { label: '22-25', prompt: '24 year old' },
  { label: '26-30', prompt: '28 year old' },
  { label: '31-35', prompt: '33 year old' },
  { label: '36-40', prompt: '38 year old' },
  { label: '41-50', prompt: '45 year old' },
  { label: '51-60', prompt: '55 year old' },
] as const;

const ETHNICITY_OPTIONS = [
  'Caucasian', 'Black', 'East Asian', 'South Asian',
  'Hispanic', 'Middle Eastern', 'Southeast Asian', 'Mixed',
] as const;

const BODY_OPTIONS = ['Slim', 'Athletic', 'Average', 'Curvy', 'Muscular', 'Plus-size'] as const;

const HEIGHT_OPTIONS = ['Short', 'Average height', 'Tall'] as const;

const SKIN_TONE_OPTIONS = ['Fair', 'Light', 'Medium', 'Olive', 'Tan', 'Brown', 'Dark'] as const;

const HAIR_COLOR_OPTIONS = [
  'Black', 'Dark brown', 'Brown', 'Light brown', 'Blonde',
  'Platinum blonde', 'Red', 'Auburn', 'Gray', 'White',
] as const;

const HAIR_LENGTH_OPTIONS = ['Bald', 'Short', 'Medium length', 'Long'] as const;

const HAIR_STYLE_OPTIONS = [
  'Straight', 'Wavy', 'Curly', 'Coily', 'Braided',
  'Ponytail', 'Messy', 'Slicked back',
] as const;

const EYE_COLOR_OPTIONS = ['Brown', 'Blue', 'Green', 'Hazel', 'Gray', 'Amber'] as const;

const BREAST_SIZE_OPTIONS = ['A cup', 'B cup', 'C cup', 'D cup', 'DD cup', 'E+ cup', 'extra large'] as const;

const BUTT_SIZE_OPTIONS = ['Small', 'Medium', 'Large', 'Extra large'] as const;

const FACIAL_FEATURE_OPTIONS = [
  'Freckles', 'Glasses', 'Beard', 'Stubble', 'Mustache',
  'Dimples', 'Sharp jawline', 'High cheekbones',
] as const;

// ── Types ────────────────────────────────────────────────────

interface PersonaState {
  gender: string;
  age: string;
  ethnicity: string;
  body: string;
  height: string;
  skinTone: string;
  hairColor: string;
  hairLength: string;
  hairStyle: string;
  eyeColor: string;
  breastSize: string;
  buttSize: string;
  facialFeatures: string[];
}

const DEFAULT_PERSONA: PersonaState = {
  gender: 'Woman',
  age: '22-25',
  ethnicity: 'Caucasian',
  body: 'Athletic',
  height: 'Average height',
  skinTone: 'Medium',
  hairColor: 'Brown',
  hairLength: 'Long',
  hairStyle: 'Wavy',
  eyeColor: 'Brown',
  breastSize: 'C cup',
  buttSize: 'Medium',
  facialFeatures: [],
};

type Phase = 'build' | 'generating' | 'preview';

// ── Prompt builder ───────────────────────────────────────────

function buildPrompt(p: PersonaState): string {
  const agePrompt = AGE_OPTIONS.find((a) => a.label === p.age)?.prompt ?? `${p.age}`;
  const features = p.facialFeatures.length > 0 ? p.facialFeatures.join(', ') + ', ' : '';

  const hairDesc =
    p.hairLength === 'Bald'
      ? 'bald'
      : `${p.hairLength.toLowerCase()} ${p.hairStyle.toLowerCase()} ${p.hairColor.toLowerCase()} hair`;

  const figureDesc =
    p.gender === 'Woman'
      ? `${p.breastSize.toLowerCase()} breasts, ${p.buttSize.toLowerCase()} butt`
      : '';

  return [
    `${agePrompt} ${p.ethnicity.toLowerCase()} ${p.gender.toLowerCase()}`,
    `${p.body.toLowerCase()} ${p.height.toLowerCase()} build`,
    figureDesc,
    `${p.skinTone.toLowerCase()} skin tone`,
    hairDesc,
    `${p.eyeColor.toLowerCase()} eyes`,
    features,
    'full body portrait photograph showing front view and side view, plain white studio backdrop, photorealistic, sharp focus, high detail, professional studio lighting, 85mm lens',
  ]
    .filter(Boolean)
    .join(', ');
}

// ── Pill selector ────────────────────────────────────────────

function PillGroup({
  options,
  value,
  onChange,
  multi = false,
  multiValue,
  onMultiChange,
}: {
  options: readonly string[];
  value?: string;
  onChange?: (v: string) => void;
  multi?: boolean;
  multiValue?: string[];
  onMultiChange?: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const selected = multi
          ? (multiValue ?? []).includes(opt)
          : value === opt;
        return (
          <button
            key={opt}
            type="button"
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              selected
                ? 'border-pink-500 bg-pink-500/15 text-pink-600 dark:text-pink-400'
                : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'
            )}
            onClick={() => {
              if (multi && onMultiChange && multiValue) {
                onMultiChange(
                  selected
                    ? multiValue.filter((v) => v !== opt)
                    : [...multiValue, opt]
                );
              } else {
                onChange?.(opt);
              }
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

export type PersonaBuilderModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  onSourceImageSaved: (newPath: string) => void;
};

export function PersonaBuilderModal({
  open,
  onOpenChange,
  profileId,
  onSourceImageSaved,
}: PersonaBuilderModalProps) {
  const supabase = createClient();
  const [persona, setPersona] = useState<PersonaState>({ ...DEFAULT_PERSONA });
  const [phase, setPhase] = useState<Phase>('build');
  const [preview, setPreview] = useState<{
    previewUrl: string;
    file: File;
    prompt: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const creditCost = useImageGenCreditCost(open);

  const set = useCallback(
    <K extends keyof PersonaState>(key: K, val: PersonaState[K]) =>
      setPersona((prev) => ({ ...prev, [key]: val })),
    []
  );

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      abortRef.current?.abort();
      abortRef.current = null;
    } else {
      setPhase('build');
      setPreview(null);
      setIsSaving(false);
    }
    onOpenChange(next);
  };

  const generate = async () => {
    const prompt = buildPrompt(persona);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPhase('generating');

    try {
      const out = await requestGeneratedImageFromApi(prompt, ac.signal, {
        skipSourceImage: true,
      });
      setPreview({ previewUrl: out.previewUrl, file: out.file, prompt });
      setPhase('preview');
      toast.success('Persona image generated');
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        setPhase('build');
        return;
      }
      toast.error(e instanceof Error ? e.message : 'Image generation failed');
      setPhase('build');
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
    }
  };

  const saveAsSourceImage = async () => {
    if (!preview) return;
    setIsSaving(true);
    try {
      const ext = 'png';
      const fileName = `${profileId}-${Date.now()}.${ext}`;
      const filePath = `image-gen-reference/${fileName}`;

      const arrayBuf = await preview.file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('creator-content')
        .upload(filePath, arrayBuf, {
          cacheControl: '3600',
          upsert: true,
          contentType: preview.file.type || 'image/png',
        });
      if (uploadError) throw new Error(uploadError.message);

      const { error: updateError } = await supabase
        .from('creators')
        .update({ image_gen_source_path: filePath })
        .eq('profile_id', profileId);
      if (updateError) throw new Error(updateError.message);

      onSourceImageSaved(filePath);
      toast.success('Persona saved as your source image');
      handleOpenChange(false);
    } catch (err) {
      console.error('Error saving persona as source image:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const title =
    phase === 'preview'
      ? 'Preview your persona'
      : phase === 'generating'
        ? 'Generating persona...'
        : 'Make your persona';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="!flex max-h-[min(88vh,88dvh)] w-full !flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 space-y-1.5 px-6 pt-6 pr-14 text-left">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-3">
          {phase === 'build' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Customize your AI persona. These settings are combined into a prompt to generate your source image.{' '}
                <span className="font-medium text-foreground">Each generation uses {creditCost} credits.</span>
              </p>

              <Section label="Gender">
                <PillGroup options={GENDER_OPTIONS} value={persona.gender} onChange={(v) => set('gender', v)} />
              </Section>

              <Section label="Age range">
                <PillGroup
                  options={AGE_OPTIONS.map((a) => a.label)}
                  value={persona.age}
                  onChange={(v) => set('age', v)}
                />
              </Section>

              <Section label="Ethnicity">
                <PillGroup options={ETHNICITY_OPTIONS} value={persona.ethnicity} onChange={(v) => set('ethnicity', v)} />
              </Section>

              <Section label="Body type">
                <PillGroup options={BODY_OPTIONS} value={persona.body} onChange={(v) => set('body', v)} />
              </Section>

              {persona.gender === 'Woman' && (
                <>
                  <Section label="Breast size">
                    <PillGroup options={BREAST_SIZE_OPTIONS} value={persona.breastSize} onChange={(v) => set('breastSize', v)} />
                  </Section>

                  <Section label="Butt size">
                    <PillGroup options={BUTT_SIZE_OPTIONS} value={persona.buttSize} onChange={(v) => set('buttSize', v)} />
                  </Section>
                </>
              )}

              <Section label="Height">
                <PillGroup options={HEIGHT_OPTIONS} value={persona.height} onChange={(v) => set('height', v)} />
              </Section>

              <Section label="Skin tone">
                <PillGroup options={SKIN_TONE_OPTIONS} value={persona.skinTone} onChange={(v) => set('skinTone', v)} />
              </Section>

              <Section label="Hair color">
                <PillGroup options={HAIR_COLOR_OPTIONS} value={persona.hairColor} onChange={(v) => set('hairColor', v)} />
              </Section>

              <Section label="Hair length">
                <PillGroup options={HAIR_LENGTH_OPTIONS} value={persona.hairLength} onChange={(v) => set('hairLength', v)} />
              </Section>

              {persona.hairLength !== 'Bald' && (
                <Section label="Hair style">
                  <PillGroup options={HAIR_STYLE_OPTIONS} value={persona.hairStyle} onChange={(v) => set('hairStyle', v)} />
                </Section>
              )}

              <Section label="Eye color">
                <PillGroup options={EYE_COLOR_OPTIONS} value={persona.eyeColor} onChange={(v) => set('eyeColor', v)} />
              </Section>

              <Section label="Extras (optional)">
                <PillGroup
                  options={FACIAL_FEATURE_OPTIONS}
                  multi
                  multiValue={persona.facialFeatures}
                  onMultiChange={(v) => set('facialFeatures', v)}
                />
              </Section>

              <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Prompt preview</p>
                <p className="text-xs text-muted-foreground break-words">{buildPrompt(persona)}</p>
              </div>
            </div>
          )}

          {phase === 'generating' && (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-lg border bg-muted/40 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-pink-500" />
              <span className="text-sm text-muted-foreground">Creating your persona...</span>
              <span className="text-xs text-muted-foreground">This may take a minute</span>
            </div>
          )}

          {phase === 'preview' && preview && (
            <div className="space-y-3">
              <div className="relative mx-auto h-[min(48vh,400px)] w-full max-w-md overflow-hidden rounded-lg border bg-muted">
                <NextImage
                  src={preview.previewUrl}
                  alt="Generated persona"
                  fill
                  className="object-contain"
                  sizes="(max-width: 512px) 90vw, 448px"
                  unoptimized
                />
              </div>
              <p className="max-h-20 overflow-y-auto text-xs whitespace-pre-wrap break-words text-muted-foreground">
                {preview.prompt}
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t bg-background px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          {phase === 'build' && (
            <DialogFooter className="flex flex-row items-center justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-pink-500 hover:bg-pink-600 gap-2"
                onClick={() => void generate()}
              >
                Generate Preview
              </Button>
            </DialogFooter>
          )}

          {phase === 'generating' && (
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  abortRef.current?.abort();
                  abortRef.current = null;
                  setPhase('build');
                }}
              >
                Cancel
              </Button>
            </DialogFooter>
          )}

          {phase === 'preview' && (
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setPhase('build');
                    setPreview(null);
                  }}
                  disabled={isSaving}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void generate()}
                  disabled={isSaving}
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </Button>
              </div>
              <Button
                type="button"
                className="bg-pink-500 hover:bg-pink-600 gap-2 w-full sm:w-auto"
                onClick={() => void saveAsSourceImage()}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save as Source Image
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
