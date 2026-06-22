'use client';

import { useEffect, useState, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X } from 'lucide-react';
import type { PersonalityCalibrationConfig } from './personality-calibration-types';
import {
  SLIDER_AXES,
  TONE_PRESETS,
  PRESET_SLIDERS,
  PRESET_WORLDVIEW,
  WORLDVIEW_QUESTIONS,
  SAMPLE_FAN_MESSAGES,
  ALLOWED_TOPIC_OPTIONS,
  FORBIDDEN_TOPIC_OPTIONS,
  ROMANTIC_BOUNDARIES,
} from './personality-calibration-types';
import { buildPersonalityPrompt, parsePersonalityPrompt } from './personality-prompt-builder';

const defaultConfig: PersonalityCalibrationConfig = {
  preset: undefined,
  sliders: Object.fromEntries(SLIDER_AXES.map(a => [a.id, 50])),
  worldview: {},
  approvedSamples: [],
  rejectedSamples: [],
  allowedTopics: [],
  allowedCustom: '',
  forbiddenTopics: [],
  forbiddenCustom: '',
  emotionalNeverAggressive: false,
  emotionalNotOverlySexual: false,
  emotionalAvoidSarcasm: false,
  emotionalIntensity: 50,
  romanticBoundary: 'none',
  additionalNotes: '',
};

interface PersonalityCalibrationUIProps {
  value: string | null;
  onChange: (prompt: string) => void;
  disabled?: boolean;
}

export function PersonalityCalibrationUI({ value, onChange, disabled }: PersonalityCalibrationUIProps) {
  const [config, setConfig] = useState<PersonalityCalibrationConfig>(() => ({ ...defaultConfig, sliders: { ...defaultConfig.sliders } }));
  const lastBuiltRef = useRef<string | null>(null);
  const hasUserInteractedRef = useRef(false);

  useEffect(() => {
    if (value === lastBuiltRef.current) return;
    const parsed = parsePersonalityPrompt(value);
    if (parsed) {
      lastBuiltRef.current = value;
      setConfig(prev => ({
        ...defaultConfig,
        ...parsed,
        sliders: { ...defaultConfig.sliders, ...parsed.sliders },
        worldview: { ...parsed.worldview },
        allowedTopics: parsed.allowedTopics ? [...parsed.allowedTopics] : [],
        forbiddenTopics: parsed.forbiddenTopics ? [...parsed.forbiddenTopics] : [],
        approvedSamples: parsed.approvedSamples ? [...parsed.approvedSamples] : [],
      }));
    }
  }, [value]);

  useEffect(() => {
    if (!hasUserInteractedRef.current) return;
    const built = buildPersonalityPrompt(config);
    if (built === lastBuiltRef.current) return;
    lastBuiltRef.current = built;
    onChange(built);
  }, [config, onChange]);

  const updateConfig = (updates: Partial<PersonalityCalibrationConfig>) => {
    hasUserInteractedRef.current = true;
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const setSlider = (id: string, v: number) => {
    hasUserInteractedRef.current = true;
    setConfig(prev => ({ ...prev, sliders: { ...prev.sliders, [id]: v } }));
  };

  const setWorldview = (questionId: string, choiceId: string) => {
    hasUserInteractedRef.current = true;
    setConfig(prev => ({ ...prev, worldview: { ...prev.worldview, [questionId]: choiceId } }));
  };

  const toggleAllowed = (topic: string) => {
    const current = config.allowedTopics || [];
    const next = current.includes(topic) ? current.filter(t => t !== topic) : [...current, topic];
    updateConfig({ allowedTopics: next });
  };

  const toggleForbidden = (topic: string) => {
    const current = config.forbiddenTopics || [];
    const next = current.includes(topic) ? current.filter(t => t !== topic) : [...current, topic];
    updateConfig({ forbiddenTopics: next });
  };

  const setSampleApproved = (sampleId: string, response: string, approved: boolean) => {
    const approvedList = config.approvedSamples || [];
    const rejectedList = config.rejectedSamples || [];
    const newApproved = approved ? [...approvedList.filter(r => r !== response), response] : approvedList.filter(r => r !== response);
    const newRejected = !approved ? [...rejectedList.filter(r => r !== response), response] : rejectedList.filter(r => r !== response);
    updateConfig({ approvedSamples: newApproved, rejectedSamples: newRejected });
  };

  const isSampleApproved = (response: string) => (config.approvedSamples || []).includes(response);

  return (
    <div className="min-w-0 max-w-full space-y-8 overflow-x-hidden">
      {/* Tone preset */}
      <Card className="min-w-0 overflow-x-hidden">
        <CardHeader>
          <CardTitle>Tone preset</CardTitle>
          <CardDescription>Start from a preset, then fine-tune with sliders below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TONE_PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (config.preset === p.id) {
                    updateConfig({ preset: undefined });
                    return;
                  }
                  const sliders = PRESET_SLIDERS[p.id] ? { ...config.sliders, ...PRESET_SLIDERS[p.id] } : config.sliders;
                  const worldview = PRESET_WORLDVIEW[p.id] ? { ...config.worldview, ...PRESET_WORLDVIEW[p.id] } : config.worldview;
                  updateConfig({ preset: p.id, sliders, worldview });
                }}
                className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                  config.preset === p.id
                    ? 'border-pink-500 bg-pink-500/10'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <span className="font-medium">{p.label}</span>
                <p className="text-muted-foreground text-xs mt-0.5">{p.description}</p>
                <p className="text-muted-foreground/80 text-xs mt-1 italic">{p.sample}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sliders */}
      <Card className="min-w-0 overflow-x-hidden">
        <CardHeader>
          <CardTitle>Personality sliders</CardTitle>
          <CardDescription>Define your AI persona along these spectrums.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {SLIDER_AXES.map(axis => {
            const v = config.sliders?.[axis.id] ?? 50;
            return (
              <div key={axis.id} className="space-y-2">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 text-muted-foreground break-words">{axis.left}</span>
                  <span className="min-w-0 flex-1 text-right text-muted-foreground break-words">{axis.right}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={v}
                  disabled={disabled}
                  onChange={e => setSlider(axis.id, Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted accent-pink-500"
                />
                <p className="text-xs text-muted-foreground">
                  {v <= 50 ? axis.left : axis.right} ({v <= 50 ? 50 - v : v - 50}% toward that end)
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Worldview */}
      <Card className="min-w-0 overflow-x-hidden">
        <CardHeader>
          <CardTitle>Worldview & style</CardTitle>
          <CardDescription>How should your AI respond in these situations?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {WORLDVIEW_QUESTIONS.map(q => (
            <div key={q.id} className="space-y-2">
              <Label className="text-sm">{q.question}</Label>
              <div className="flex flex-wrap gap-2">
                {q.options.map(opt => (
                  <Button
                    key={opt.id}
                    type="button"
                    variant={config.worldview?.[q.id] === opt.id ? 'default' : 'outline'}
                    size="sm"
                    disabled={disabled}
                    className={config.worldview?.[q.id] === opt.id ? 'bg-pink-500 hover:bg-pink-600' : ''}
                    onClick={() => setWorldview(q.id, opt.id)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Approve/reject samples */}
      <Card className="min-w-0 overflow-x-hidden">
        <CardHeader>
          <CardTitle>Example responses</CardTitle>
          <CardDescription>Approve responses that sound like you; reject ones that don&apos;t.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {SAMPLE_FAN_MESSAGES.map(s => {
            const approved = isSampleApproved(s.response);
            return (
              <div key={s.id} className="p-3 rounded-lg border border-border space-y-1">
                <p className="text-sm text-muted-foreground">&quot;{s.fan}&quot;</p>
                <p className="text-sm">&quot;{s.response}&quot;</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={approved ? 'default' : 'outline'}
                    disabled={disabled}
                    className={approved ? 'bg-green-600 hover:bg-green-700' : ''}
                    onClick={() => setSampleApproved(s.id, s.response, true)}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Sounds like me
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!approved ? 'destructive' : 'outline'}
                    disabled={disabled}
                    onClick={() => setSampleApproved(s.id, s.response, false)}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Not quite
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Allowed topics */}
      <Card className="min-w-0 overflow-x-hidden">
        <CardHeader>
          <CardTitle>Allowed topics</CardTitle>
          <CardDescription>Topics your AI can discuss. Defaults are conservative; opt in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {ALLOWED_TOPIC_OPTIONS.map(topic => (
              <label key={topic} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(config.allowedTopics || []).includes(topic)}
                  disabled={disabled}
                  onChange={() => toggleAllowed(topic)}
                  className="rounded border-input accent-pink-500"
                />
                <span className="text-sm">{topic}</span>
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="allowed-custom">Custom allowed topics (comma-separated)</Label>
            <Input
              id="allowed-custom"
              value={config.allowedCustom || ''}
              disabled={disabled}
              onChange={e => updateConfig({ allowedCustom: e.target.value })}
              placeholder="e.g. cooking, travel"
              className="max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      {/* Forbidden topics */}
      <Card className="min-w-0 overflow-x-hidden">
        <CardHeader>
          <CardTitle>Forbidden topics</CardTitle>
          <CardDescription>Topics your AI must never engage with.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {FORBIDDEN_TOPIC_OPTIONS.map(topic => (
              <label key={topic} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(config.forbiddenTopics || []).includes(topic)}
                  disabled={disabled}
                  onChange={() => toggleForbidden(topic)}
                  className="rounded border-input accent-pink-500"
                />
                <span className="text-sm">{topic}</span>
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="forbidden-custom">Custom forbidden topics (comma-separated)</Label>
            <Input
              id="forbidden-custom"
              value={config.forbiddenCustom || ''}
              disabled={disabled}
              onChange={e => updateConfig({ forbiddenCustom: e.target.value })}
              placeholder="e.g. specific names, triggers"
              className="max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      {/* Emotional tone limits */}
      <Card className="min-w-0 overflow-x-hidden">
        <CardHeader>
          <CardTitle>Emotional tone limits</CardTitle>
          <CardDescription>Guardrails on how intense or certain behaviors the AI should avoid.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={config.emotionalNeverAggressive ?? false}
                disabled={disabled}
                onCheckedChange={c => updateConfig({ emotionalNeverAggressive: c })}
              />
              <span className="text-sm">Never be aggressive</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={config.emotionalNotOverlySexual ?? false}
                disabled={disabled}
                onCheckedChange={c => updateConfig({ emotionalNotOverlySexual: c })}
              />
              <span className="text-sm">Don&apos;t be overly sexual</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={config.emotionalAvoidSarcasm ?? false}
                disabled={disabled}
                onCheckedChange={c => updateConfig({ emotionalAvoidSarcasm: c })}
              />
              <span className="text-sm">Avoid sarcasm</span>
            </label>
          </div>
          <div className="space-y-2">
            <Label>Emotional intensity</Label>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Calm / reserved</span>
              <span>High energy</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={config.emotionalIntensity ?? 50}
              disabled={disabled}
              onChange={e => updateConfig({ emotionalIntensity: Number(e.target.value) })}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted accent-pink-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Romantic/sexual boundaries */}
      <Card className="min-w-0 overflow-x-hidden">
        <CardHeader>
          <CardTitle>Romantic / sexual boundaries</CardTitle>
          <CardDescription>How far romantic or sexual conversation can go.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {ROMANTIC_BOUNDARIES.map(r => (
            <button
              key={r.id}
              type="button"
              disabled={disabled}
              onClick={() => updateConfig({ romanticBoundary: r.id })}
              className={`text-left w-full p-3 rounded-lg border text-sm transition-colors ${
                config.romanticBoundary === r.id
                  ? 'border-pink-500 bg-pink-500/10'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <span className="font-medium">{r.label}</span>
              <p className="text-muted-foreground text-xs mt-0.5">{r.description}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Additional notes */}
      <Card className="min-w-0 overflow-x-hidden">
        <CardHeader>
          <CardTitle>Additional notes</CardTitle>
          <CardDescription>Anything else to add to your personality prompt (free text).</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={config.additionalNotes || ''}
            disabled={disabled}
            onChange={e => updateConfig({ additionalNotes: e.target.value })}
            placeholder="e.g. specific phrases you use, things to never say..."
            rows={3}
            className="resize-y"
          />
        </CardContent>
      </Card>
    </div>
  );
}
