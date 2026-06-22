/** One option = { hook, cta }. CTA can be empty for bio-style. */
export type MarketingOption = { hook: string; cta: string };

export const MARKETING_TEMPLATES: Record<string, MarketingOption[]> = {
  'Instagram story': [
    { hook: 'I built an AI version of me — come talk to it 👀', cta: 'Link in bio' },
    { hook: 'My AI clone is live. Swipe up to chat 👆', cta: 'Link in bio' },
    { hook: 'You can now DM my AI 24/7. No joke.', cta: 'Link in bio' },
    { hook: 'I finally did it — an AI that sounds like me. Try it 🔗', cta: 'Link in bio' },
    { hook: 'Talk to my AI anytime. Subscriptions, tips, everything.', cta: 'Link in bio' },
    { hook: 'My AI just went live on Blabber. Come say hi 👋', cta: 'Link in bio' },
    { hook: 'Your fav creator now has an AI. You’re welcome.', cta: 'Link in bio' },
    { hook: 'AI me is here. Ask it anything. Link below 👇', cta: 'Link in bio' },
    { hook: 'I’m not always online — but my AI is. Chat anytime.', cta: 'Link in bio' },
    { hook: 'New drop: my voice AI. Sub, tip, or just vibe.', cta: 'Link in bio' },
    { hook: 'Blabber just gave me an AI clone. This is not a drill.', cta: 'Link in bio' },
    { hook: 'My AI handles DMs when I can’t. Try it 👀', cta: 'Link in bio' },
    { hook: '24/7 AI version of me. Subscriptions & tips on Blabber.', cta: 'Link in bio' },
    { hook: 'You asked for more of me — here’s an AI that never sleeps.', cta: 'Link in bio' },
    { hook: 'Chat with my AI. Tips, subs, PPV — all in one place.', cta: 'Link in bio' },
    { hook: 'My AI is live. Be nice to it. Link in bio 😂', cta: 'Link in bio' },
    { hook: 'Finally: talk to me (well, my AI) anytime.', cta: 'Link in bio' },
    { hook: 'AI clone dropped. Sub to unlock, or just chat for free.', cta: 'Link in bio' },
    { hook: 'Your DMs just got an upgrade. My AI’s on Blabber.', cta: 'Link in bio' },
    { hook: 'I outsourced answering DMs to my AI. Link below.', cta: 'Link in bio' },
  ],
  'Twitter / X': [
    { hook: 'My AI clone is live. Ask it anything.', cta: 'Try it here 👇' },
    { hook: 'I built an AI that sounds like me. It’s on Blabber.', cta: 'Link below' },
    { hook: 'You can now DM my AI 24/7. Yes, really.', cta: 'Try it 👇' },
    { hook: 'My AI just went live. Sub, tip, or just chat.', cta: 'Blabber link in bio' },
    { hook: 'New: talk to my AI anytime. Subscriptions & tips on Blabber.', cta: 'Link below' },
    { hook: 'AI me is here. Ask it anything. No cap.', cta: 'Try it 👇' },
    { hook: 'Your fav creator now has an AI. You’re welcome.', cta: 'Link in bio' },
    { hook: 'I’m not always online — my AI is. Blabber.', cta: 'Link below' },
    { hook: 'My voice AI is live. Sub, tip, PPV — all on Blabber.', cta: 'Try it 👇' },
    { hook: 'Finally: an AI that sounds like me. Chat 24/7.', cta: 'Link below' },
    { hook: 'AI clone dropped. Sub to unlock or just vibe.', cta: 'Blabber link 👇' },
    { hook: 'Talk to my AI. No bots, just me (the AI version).', cta: 'Link below' },
    { hook: 'My AI handles DMs when I can’t. Try it on Blabber.', cta: 'Link 👇' },
    { hook: '24/7 AI version of me. Subscriptions, tips, everything.', cta: 'Try it below' },
    { hook: 'I outsourced my DMs to an AI. It’s on Blabber.', cta: 'Link in bio' },
    { hook: 'New drop: my AI. Chat, sub, tip — one link.', cta: 'Try it 👇' },
    { hook: 'You asked for more of me. Here’s an AI that never sleeps.', cta: 'Link below' },
    { hook: 'My AI is live. Be nice to it. Link below 😂', cta: 'Blabber' },
    { hook: 'DM my AI anytime. Subscriptions & tips on Blabber.', cta: 'Link 👇' },
    { hook: 'AI me. Live. Blabber. You’re welcome.', cta: 'Link below' },
  ],
  'TikTok bio': [
    { hook: 'Chat with my AI on Blabber 🔗', cta: '' },
    { hook: 'My AI is on Blabber — chat 24/7 🔗', cta: '' },
    { hook: 'AI clone live. Blabber link below 👇', cta: '' },
    { hook: 'Talk to my AI anytime. Blabber 🔗', cta: '' },
    { hook: 'DM my AI 24/7. Sub & tips on Blabber 🔗', cta: '' },
    { hook: 'AI me is here. Blabber link in bio 🔗', cta: '' },
    { hook: 'Your fav creator’s AI. Blabber 👇', cta: '' },
    { hook: 'Sub, tip, chat — my AI’s on Blabber 🔗', cta: '' },
    { hook: 'I’m not always on — my AI is. Blabber 🔗', cta: '' },
    { hook: 'New: voice AI. Blabber link below 🔗', cta: '' },
    { hook: 'Chat with my AI. No sleep, no days off. Blabber 🔗', cta: '' },
    { hook: 'AI clone dropped. Blabber 👇', cta: '' },
    { hook: '24/7 AI. Subscriptions & tips. Blabber 🔗', cta: '' },
    { hook: 'My AI handles my DMs. Try it on Blabber 🔗', cta: '' },
    { hook: 'Talk to me (AI version) anytime. Blabber 🔗', cta: '' },
    { hook: 'Blabber = my AI. Chat, sub, tip. 🔗', cta: '' },
    { hook: 'AI me. Live. Blabber link below 🔗', cta: '' },
    { hook: 'DM my AI. Blabber 🔗', cta: '' },
    { hook: 'Voice AI live. Blabber link in bio 🔗', cta: '' },
    { hook: 'More of me, 24/7. My AI on Blabber 🔗', cta: '' },
  ],
  'Generic post': [
    { hook: 'You can now talk to my AI 24/7. Subscriptions, tips & PPV on Blabber.', cta: 'Link below' },
    { hook: 'My AI is live. Chat anytime — sub, tip, or just vibe.', cta: 'Link below' },
    { hook: 'I built an AI that sounds like me. Subscriptions & tips on Blabber.', cta: 'Try it 👇' },
    { hook: 'New: talk to my AI 24/7. No bots — it’s my voice. Blabber.', cta: 'Link below' },
    { hook: 'My AI clone is here. Sub to unlock, tip, or chat for free.', cta: 'Link below' },
    { hook: 'Your fav creator now has an AI. Sub, tip, PPV — all on Blabber.', cta: 'Link below' },
    { hook: 'I’m not always online. My AI is. Chat 24/7 on Blabber.', cta: 'Link below' },
    { hook: 'AI me is live. Subscriptions, tips, and DMs — Blabber.', cta: 'Link below' },
    { hook: 'Finally: an AI that sounds like me. Sub & tip on Blabber.', cta: 'Try it 👇' },
    { hook: 'My AI handles DMs when I can’t. Sub, tip, chat on Blabber.', cta: 'Link below' },
    { hook: '24/7 AI version of me. Subscriptions, tips & more on Blabber.', cta: 'Link below' },
    { hook: 'New drop: my voice AI. Chat, sub, tip — one link.', cta: 'Blabber 👇' },
    { hook: 'You asked for more of me. Here’s an AI that never sleeps. Blabber.', cta: 'Link below' },
    { hook: 'Talk to my AI. Sub to unlock, tip, or just chat. Blabber.', cta: 'Link below' },
    { hook: 'My AI is live. Be nice to it. Sub & tip on Blabber 😂', cta: 'Link below' },
    { hook: 'AI clone dropped. Subscriptions, tips, PPV — Blabber.', cta: 'Link below' },
    { hook: 'I outsourced my DMs to an AI. Sub & tip on Blabber.', cta: 'Link below' },
    { hook: 'DM my AI anytime. Subscriptions & tips on Blabber.', cta: 'Try it 👇' },
    { hook: 'More of me, 24/7. My AI. Sub, tip, chat. Blabber.', cta: 'Link below' },
    { hook: 'My voice AI is live. Chat, sub, tip — all on Blabber.', cta: 'Link below' },
  ],
  'Short CTA': [
    { hook: 'DM my AI anytime.', cta: 'Link in bio' },
    { hook: 'Chat with my AI 24/7.', cta: 'Link in bio' },
    { hook: 'My AI is live. Link in bio.', cta: 'Link in bio' },
    { hook: 'Talk to my AI. Link below.', cta: 'Link in bio' },
    { hook: 'AI me. Link in bio.', cta: 'Link in bio' },
    { hook: 'My AI never sleeps. Link in bio.', cta: 'Link in bio' },
    { hook: 'DM my AI. Link in bio.', cta: 'Link in bio' },
    { hook: 'Your fav creator’s AI. Link below.', cta: 'Link in bio' },
    { hook: 'Sub, tip, chat — link in bio.', cta: 'Link in bio' },
    { hook: 'AI clone live. Link in bio.', cta: 'Link in bio' },
    { hook: 'Talk to me (AI). Link in bio.', cta: 'Link in bio' },
    { hook: '24/7 AI. Link in bio.', cta: 'Link in bio' },
    { hook: 'My AI’s on Blabber. Link in bio.', cta: 'Link in bio' },
    { hook: 'Chat with my AI. Link below.', cta: 'Link in bio' },
    { hook: 'AI me is here. Link in bio.', cta: 'Link in bio' },
    { hook: 'New: my AI. Link in bio.', cta: 'Link in bio' },
    { hook: 'Voice AI live. Link in bio.', cta: 'Link in bio' },
    { hook: 'More of me, 24/7. Link in bio.', cta: 'Link in bio' },
    { hook: 'Blabber = my AI. Link in bio.', cta: 'Link in bio' },
  ],
};

const PLATFORM_ORDER = ['Instagram story', 'Twitter / X', 'TikTok bio', 'Generic post', 'Short CTA'] as const;

function pickOnePerPlatform(): { platform: string; hook: string; cta: string }[] {
  return PLATFORM_ORDER.map((platform) => {
    const options = MARKETING_TEMPLATES[platform];
    const idx = Math.floor(Math.random() * options.length);
    const { hook, cta } = options[idx];
    return { platform, hook, cta };
  });
}

/** Call once per page visit to get one random template per platform. */
export function getRandomTemplates(): { platform: string; hook: string; cta: string }[] {
  return pickOnePerPlatform();
}
