/** Config stored in personality_prompt (in a comment block) for UI round-trip. No DB schema change. */
export interface PersonalityCalibrationConfig {
  preset?: string;
  sliders?: Record<string, number>;
  worldview?: Record<string, string>;
  approvedSamples?: string[];
  rejectedSamples?: string[];
  allowedTopics?: string[];
  allowedCustom?: string;
  forbiddenTopics?: string[];
  forbiddenCustom?: string;
  emotionalNeverAggressive?: boolean;
  emotionalNotOverlySexual?: boolean;
  emotionalAvoidSarcasm?: boolean;
  emotionalIntensity?: number;
  romanticBoundary?: 'none' | 'light' | 'romantic' | 'explicit';
  additionalNotes?: string;
}

export const CALIBRATION_MARKER = '<!--BLABBER_CALIBRATION';
export const CALIBRATION_MARKER_END = '-->';

export const SLIDER_AXES = [
  { id: 'warm_dominant', left: 'Warm', right: 'Dominant' },
  { id: 'playful_serious', left: 'Playful', right: 'Serious' },
  { id: 'casual_formal', left: 'Casual', right: 'Formal' },
  { id: 'nurturing_tough', left: 'Nurturing', right: 'Tough love' },
] as const;

export const TONE_PRESETS: { id: string; label: string; description: string; sample: string }[] = [
  { id: 'confident', label: 'Confident', description: 'Self-assured, direct, and clear.', sample: '"I\'ve got you. Here\'s what I think..."' },
  { id: 'nurturing', label: 'Nurturing', description: 'Warm, supportive, and caring.', sample: '"That sounds really hard. I\'m here for you."' },
  { id: 'teasing', label: 'Teasing', description: 'Playful, light teasing, fun.', sample: '"Oh really? Try me. 😏"' },
  { id: 'blunt', label: 'Blunt', description: 'Straight to the point, no sugar-coating.', sample: '"Honestly? You already know the answer."' },
  { id: 'flirty', label: 'Flirty', description: 'Charming, light flirtation.', sample: '"You\'re gonna make me blush."' },
  { id: 'motivational', label: 'Motivational', description: 'Uplifting, encouraging, push to grow.', sample: '"You can do this. I believe in you."' },
  { id: 'casual', label: 'Casual', description: 'Relaxed, like texting a friend.', sample: '"lol same though"' },
  { id: 'formal', label: 'Formal', description: 'Polished, professional tone.', sample: '"I appreciate you reaching out. Here\'s my take."' },
];

/** Slider values per preset: warm_dominant, playful_serious, casual_formal, nurturing_tough (0–100). */
export const PRESET_SLIDERS: Record<string, Record<string, number>> = {
  confident: { warm_dominant: 70, playful_serious: 65, casual_formal: 70, nurturing_tough: 65 },
  nurturing: { warm_dominant: 18, playful_serious: 28, casual_formal: 22, nurturing_tough: 12 },
  teasing: { warm_dominant: 42, playful_serious: 12, casual_formal: 18, nurturing_tough: 38 },
  blunt: { warm_dominant: 78, playful_serious: 82, casual_formal: 72, nurturing_tough: 82 },
  flirty: { warm_dominant: 48, playful_serious: 18, casual_formal: 28, nurturing_tough: 22 },
  motivational: { warm_dominant: 38, playful_serious: 58, casual_formal: 52, nurturing_tough: 28 },
  casual: { warm_dominant: 42, playful_serious: 22, casual_formal: 12, nurturing_tough: 32 },
  formal: { warm_dominant: 58, playful_serious: 72, casual_formal: 88, nurturing_tough: 55 },
};

/** Worldview choices per preset: questionId -> optionId. */
export const PRESET_WORLDVIEW: Record<string, Record<string, string>> = {
  confident: { bad_day: 'ask', advice: 'direct', compliment: 'graceful' },
  nurturing: { bad_day: 'comfort', advice: 'gentle', compliment: 'humble' },
  teasing: { bad_day: 'humor', advice: 'personal', compliment: 'playful' },
  blunt: { bad_day: 'tough_love', advice: 'direct', compliment: 'graceful' },
  flirty: { bad_day: 'humor', advice: 'personal', compliment: 'playful' },
  motivational: { bad_day: 'comfort', advice: 'direct', compliment: 'graceful' },
  casual: { bad_day: 'ask', advice: 'personal', compliment: 'deflect' },
  formal: { bad_day: 'ask', advice: 'direct', compliment: 'graceful' },
};

export const WORLDVIEW_QUESTIONS: { id: string; question: string; options: { id: string; label: string }[] }[] = [
  {
    id: 'bad_day',
    question: 'A fan is having a bad day. You…',
    options: [
      { id: 'comfort', label: 'Offer comfort and support' },
      { id: 'tough_love', label: 'Give tough love' },
      { id: 'humor', label: 'Distract with humor' },
      { id: 'ask', label: 'Ask what happened and listen' },
    ],
  },
  {
    id: 'advice',
    question: 'A fan asks for advice. You…',
    options: [
      { id: 'direct', label: 'Give direct, honest advice' },
      { id: 'gentle', label: 'Suggest gently and leave room for them' },
      { id: 'personal', label: 'Share how you\'d handle it personally' },
      { id: 'redirect', label: 'Encourage them to reflect first' },
    ],
  },
  {
    id: 'compliment',
    question: 'A fan gives you a heavy compliment. You…',
    options: [
      { id: 'graceful', label: 'Accept gracefully and thank them' },
      { id: 'deflect', label: 'Deflect lightly and turn it back to them' },
      { id: 'playful', label: 'Respond playfully or tease' },
      { id: 'humble', label: 'Stay humble and redirect' },
    ],
  },
];

export const SAMPLE_FAN_MESSAGES = [
  { id: 's1', fan: 'I\'m having such a rough week.', response: 'That sounds really hard. I\'m here for you—want to talk about it?' },
  { id: 's2', fan: 'You\'re so amazing!', response: 'You\'re too kind! That made my day.' },
  { id: 's3', fan: 'What would you do in my situation?', response: 'I\'d probably step back and think about what you really want. What\'s your gut saying?' },
  { id: 's4', fan: 'Can\'t wait for your next drop!', response: 'Same! Working on it. You\'re gonna love it.' },
  { id: 's5', fan: 'I need some real talk right now.', response: 'Alright, real talk: sometimes the answer\'s simpler than we make it. What\'s going on?' },
  { id: 's6', fan: 'You always know what to say.', response: 'I try. Mostly I just listen and meet people where they\'re at.' },
];

export const ALLOWED_TOPIC_OPTIONS = [
  'Fitness & health',
  'Relationships',
  'Career & money',
  'Mental wellness',
  'Hobbies & interests',
  'Daily life & chat',
  'Content & updates',
  'Advice (general)',
];

export const FORBIDDEN_TOPIC_OPTIONS = [
  'Politics',
  'Religion',
  'Ex-partners / past relationships',
  'Specific personal details (address, etc.)',
  'Medical/legal advice',
  'Other people\'s private info',
];

export const ROMANTIC_BOUNDARIES: { id: 'none' | 'light' | 'romantic' | 'explicit'; label: string; description: string }[] = [
  { id: 'none', label: 'No romantic content', description: 'Keep all conversation platonic and friendly.' },
  { id: 'light', label: 'Light flirting only', description: 'Occasional light, playful flirtation; nothing suggestive or explicit.' },
  { id: 'romantic', label: 'Romantic but not explicit', description: 'Romantic tone and affection are okay; no sexually explicit content.' },
  { id: 'explicit', label: 'Explicit allowed', description: 'Romantic and sexually explicit conversation allowed within platform rules.' },
];
