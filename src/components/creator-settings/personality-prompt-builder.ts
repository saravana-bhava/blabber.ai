import type { PersonalityCalibrationConfig } from './personality-calibration-types';
import {
  CALIBRATION_MARKER,
  CALIBRATION_MARKER_END,
  SLIDER_AXES,
  TONE_PRESETS,
  WORLDVIEW_QUESTIONS,
  ROMANTIC_BOUNDARIES,
} from './personality-calibration-types';

/** Build human-readable system prompt from config and append JSON block for round-trip. */
export function buildPersonalityPrompt(config: PersonalityCalibrationConfig): string {
  const sections: string[] = [];

  // --- Personality Calibration ---
  sections.push('## Personality Calibration');

  const preset = config.preset && TONE_PRESETS.find(p => p.id === config.preset);
  if (preset) {
    sections.push(`Tone preset: ${preset.label}. ${preset.description}`);
    sections.push(`Example tone: ${preset.sample}`);
    sections.push('');
  }

  if (config.sliders && Object.keys(config.sliders).length > 0) {
    sections.push('Tone sliders:');
    SLIDER_AXES.forEach(axis => {
      const v = config.sliders![axis.id] ?? 50;
      const label = v <= 50 ? axis.left : axis.right;
      const pct = v <= 50 ? 50 - v : v - 50;
      sections.push(`- ${axis.left} ↔ ${axis.right}: ${label} (${pct}% toward ${label})`);
    });
    sections.push('');
  }

  if (config.worldview && Object.keys(config.worldview).length > 0) {
    sections.push('Worldview / style:');
    WORLDVIEW_QUESTIONS.forEach(q => {
      const choice = config.worldview![q.id];
      if (choice) {
        const opt = q.options.find(o => o.id === choice);
        sections.push(`- ${q.question} ${opt ? opt.label : choice}`);
      }
    });
    sections.push('');
  }

  if (config.approvedSamples && config.approvedSamples.length > 0) {
    sections.push('Approved response style (match this tone):');
    config.approvedSamples.forEach(line => sections.push(`- ${line}`));
    sections.push('');
  }

  // --- Boundaries ---
  sections.push('## Boundaries');

  if ((config.allowedTopics && config.allowedTopics.length > 0) || (config.allowedCustom || '').trim()) {
    const allowed = [...(config.allowedTopics || []), (config.allowedCustom || '').trim()].filter(Boolean);
    sections.push('Allowed topics: ' + allowed.join(', ') + '.');
    sections.push('');
  }

  if ((config.forbiddenTopics && config.forbiddenTopics.length > 0) || (config.forbiddenCustom || '').trim()) {
    const forbidden = [...(config.forbiddenTopics || []), (config.forbiddenCustom || '').trim()].filter(Boolean);
    sections.push('Forbidden topics (do not discuss): ' + forbidden.join(', ') + '.');
    sections.push('');
  }

  const emotionalParts: string[] = [];
  if (config.emotionalNeverAggressive) emotionalParts.push('Never be aggressive.');
  if (config.emotionalNotOverlySexual) emotionalParts.push('Do not be overly sexual.');
  if (config.emotionalAvoidSarcasm) emotionalParts.push('Avoid sarcasm.');
  if (config.emotionalIntensity != null && config.emotionalIntensity < 50) {
    emotionalParts.push('Keep emotional intensity moderate or low.');
  } else if (config.emotionalIntensity != null && config.emotionalIntensity > 50) {
    emotionalParts.push('Emotional intensity can be high when appropriate.');
  }
  if (emotionalParts.length > 0) {
    sections.push('Emotional tone limits:');
    emotionalParts.forEach(p => sections.push(`- ${p}`));
    sections.push('');
  }

  const romantic = config.romanticBoundary && ROMANTIC_BOUNDARIES.find(r => r.id === config.romanticBoundary);
  if (romantic) {
    sections.push(`Romantic/sexual boundaries: ${romantic.label}. ${romantic.description}`);
    sections.push('');
  }

  if ((config.additionalNotes || '').trim()) {
    sections.push('## Additional notes');
    sections.push(config.additionalNotes!.trim());
    sections.push('');
  }

  let body = sections.join('\n').trim();

  const jsonBlock = JSON.stringify(config);
  body += '\n\n' + CALIBRATION_MARKER + '\n' + jsonBlock + '\n' + CALIBRATION_MARKER_END;

  return body;
}

/** Parse personality_prompt to extract config for UI. Returns null if not parseable. */
export function parsePersonalityPrompt(prompt: string | null | undefined): PersonalityCalibrationConfig | null {
  if (!prompt || typeof prompt !== 'string') return null;
  const idx = prompt.indexOf(CALIBRATION_MARKER);
  if (idx === -1) return null;
  const start = idx + CALIBRATION_MARKER.length;
  const end = prompt.indexOf(CALIBRATION_MARKER_END, start);
  if (end === -1) return null;
  const json = prompt.slice(start, end).trim();
  try {
    return JSON.parse(json) as PersonalityCalibrationConfig;
  } catch {
    return null;
  }
}
