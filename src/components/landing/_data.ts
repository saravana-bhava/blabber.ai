/* ─── Landing page data (blabberai design) ─── */

/** Real creator photos from /public/avatars */
export const AVATAR_IMAGES: Record<string, string> = {
  mayarivera: '/avatars/hero-maya.jpg',
  siennavale: '/avatars/hero-sienna.jpg',
  arianoir: '/avatars/hero-aria.jpg',
  ivybrooks: '/avatars/hero-aria.jpg',
  juleskim: '/avatars/hero-aria.jpg',
  novalang: '/avatars/hero-sienna.jpg',
  leocast: '/avatars/hero-aria.jpg',
  dre: '/avatars/hero-maya.jpg',
  amberscott: '/avatars/hero-sienna.jpg',
};

export const LANDING_STATS = [
  { prefix: '', to: 180000, suffix: '+', label: 'Creators onboarding' },
  { prefix: '$', to: 340000000, suffix: '', label: 'Paid to creators' },
  { prefix: '', to: 90, suffix: '%', label: 'Revenue you keep' },
  { prefix: '', to: 24000000, suffix: '+', label: 'AI messages handled' },
] as const;

export const FEATURE_ROWS = [
  {
    id: 'fees',
    eyebrow: 'Lowest Fees',
    title: 'Keep more of what you earn',
    body: 'You keep 90% on subscriptions, tips, and PPV — the lowest fees in the industry. Transparent splits, instant payouts, no surprises.',
    bullets: ['90% creator share on everything', 'Instant crypto & bank payouts', 'Real-time revenue analytics'],
    flip: false,
    mock: 'dashboard' as const,
  },
  {
    id: 'ai',
    eyebrow: 'AI Voice & Chat',
    title: 'Monetize every conversation',
    body: 'Host calls and send messages — and let your AI-powered persona earn for you, 24/7. It speaks in your cloned voice and remembers every fan, every conversation.',
    bullets: ['True AI voice cloning for live calls', 'AI DMs in your tone & style', 'Long-term memory across text & voice'],
    flip: true,
    mock: 'ai' as const,
  },
  {
    id: 'store',
    eyebrow: 'Marketplace',
    title: 'Sell products instantly',
    body: 'A built-in product marketplace — no need to set up your own shop. Sell digital or physical products directly to your fans, hassle-free.',
    bullets: ['Digital & physical products', 'Checkout built in — zero setup', 'Sell straight from your profile'],
    flip: false,
    mock: 'store' as const,
  },
] as const;

export const WHY_CARDS = [
  { title: 'Lowest Fees', desc: 'Blabber takes the smallest cut of subscription and PPV earnings — more for you, less for us.', icon: 'lock' as const },
  { title: 'AI Voice Cloning & Memory', desc: 'Monetize calls and messages with AI that remembers every fan, every conversation.', icon: 'sparkles' as const },
  { title: '24/7 AI Earning', desc: 'Your AI persona works around the clock — earn from calls and messages, even while you sleep.', icon: 'coins' as const },
] as const;

export const TESTIMONIALS = [
  { quote: "My AI handles my DMs overnight and I wake up to tips. It genuinely sounds like me — fans can't tell.", handle: 'mayarivera', name: 'Maya Rivera', meta: '@mayarivera · +$8k/mo', ai: false },
  { quote: 'The voice calls are unreal. I set a per-minute rate and it just runs. Best fees in the game, too.', handle: 'siennavale', name: 'Sienna Vale', meta: '@siennavale · AI persona', ai: true },
  { quote: 'Switched from another platform and kept 90% instead of 70%. The marketplace sold out my first drop.', handle: 'juleskim', name: 'Jules Kim', meta: '@juleskim · 24k fans', ai: false },
] as const;

export const FAQS = [
  { q: 'What makes Blabber AI different from OnlyFans or Fanvue?', a: 'Blabber AI offers the lowest subscription and PPV fees, true AI voice cloning for monetized calls, AI-powered messaging, and a built-in creator marketplace. Our multimodal AI remembers every fan and every conversation — text or voice.' },
  { q: 'How does AI voice cloning work for calls?', a: 'Our advanced AI voice cloning lets creators host monetized calls where fans interact with a lifelike AI version of their voice, unlocking new ways to earn and connect.' },
  { q: 'Can I monetize my messages and conversations?', a: 'Yes! Blabber AI enables creators to earn from every message, with AI that remembers each fan and conversation for a truly personalized experience.' },
  { q: 'What is the creator marketplace?', a: "It's a built-in product marketplace — creators can sell directly to fans without the hassle of setting up their own shop." },
  { q: 'How do the AI agents remember conversations?', a: 'Our multimodal AI retains long-term memory across both text and voice, so every fan interaction is remembered and personalized, no matter how you connect.' },
] as const;

export const PRICING_ROWS = [
  ['Subscriptions', '90%', '10% platform fee'],
  ['Pay-per-view', '90%', '10% platform fee'],
  ['Tips', '90%', '10% platform fee'],
  ['AI calls & messages', '70%', '30% platform fee'],
] as const;

export const VOICE_FEATURES = [
  ['Lifelike voice cloning', '60-second sample. Indistinguishable results.', 'sparkles' as const],
  ['Per-minute monetization', 'Set your rate. Earnings stack in real time.', 'coins' as const],
  ['Persistent memory', 'Remembers names, moments, every chat.', 'heart' as const],
] as const;
