'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import {
  Bell, Bookmark, Check, Coins, DollarSign, Gauge, Heart, Home, Lock,
  MessageSquare, MoreHorizontal, Phone, Play, Plus, Search, Settings, User, Users,
} from 'lucide-react';
import { AIBadge, VerifiedBadge } from './_atoms';
import { AVATAR_IMAGES } from './_data';

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="land-frame">
      <div className="flex items-center gap-[7px] px-3.5 py-2.5 border-b border-border bg-secondary">
        {['#ff5f57', '#febc2e', '#28c840'].map(c => (
          <span key={c} className="w-[11px] h-[11px] rounded-full" style={{ background: c }} />
        ))}
        <span className="ml-2 text-[11.5px] text-muted-foreground font-semibold">{label}</span>
      </div>
      {children}
    </div>
  );
}

export function LandingAvatar({
  handle,
  size = 42,
  className,
}: {
  handle: string;
  size?: number;
  className?: string;
}) {
  const src = AVATAR_IMAGES[handle] ?? '/avatars/hero-sienna.jpg';
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    </div>
  );
}

function MiniSidebar({ active }: { active: string }) {
  const items: [string, React.ElementType][] = [
    ['Home', Home], ['Search', Search], ['Messages', MessageSquare], ['Notifications', Bell],
    ['Bookmarks', Bookmark], ['My Profile', User], ['Creator Dashboard', Gauge],
  ];
  return (
    <div className="hidden sm:flex w-[168px] shrink-0 border-r border-border p-3 flex-col gap-0.5 bg-background">
      <div className="flex items-center gap-2 px-1.5 pb-3">
        <LandingAvatar handle="amberscott" size={30} />
        <div className="min-w-0">
          <div className="text-[11.5px] font-bold truncate">Amber Scott</div>
          <div className="text-[9.5px] text-muted-foreground">@amberscott</div>
        </div>
      </div>
      {items.map(([l, Ic]) => (
        <div
          key={l}
          className="flex items-center gap-2 px-2 py-[7px] rounded-lg text-[11.5px]"
          style={{
            fontWeight: active === l ? 700 : 500,
            color: active === l ? 'var(--foreground)' : 'var(--muted-foreground)',
            background: active === l ? 'var(--secondary)' : 'transparent',
          }}
        >
          <Ic size={15} /> {l}
        </div>
      ))}
      <div className="flex-1" />
      <div className="flex items-center justify-center gap-1.5 p-2 rounded-lg text-[11px] font-bold text-white [background:var(--brand-grad)]">
        <Plus size={13} /> NEW POST
      </div>
    </div>
  );
}

export function DashboardMock() {
  const stats: [string, string, string, React.ElementType][] = [
    ['Gross Revenue', '$21,278.78', 'Before platform splits', DollarSign],
    ['Net Revenue', '$14,896.02', 'Your creator share', Gauge],
    ['Subscriber LTV', '$7,448.01', 'Avg per subscriber', Users],
  ];
  return (
    <Frame label="blabber.ai/dashboard">
      <div className="flex h-[340px] bg-card">
        <MiniSidebar active="Creator Dashboard" />
        <div className="flex-1 min-w-0 p-3 sm:p-[18px] overflow-hidden">
          <div className="text-[10px] sm:text-xs font-extrabold tracking-[.06em] text-muted-foreground mb-3 sm:mb-4">CREATOR DASHBOARD</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-[11px] mb-3">
            {stats.map(([t, v, s, Ic]) => (
              <div key={t} className="min-w-0 p-2.5 sm:p-[13px] rounded-xl border border-border bg-background">
                <div className="flex items-center justify-between gap-2 text-muted-foreground mb-1.5 sm:mb-2">
                  <span className="text-[10px] sm:text-[10.5px] font-semibold leading-tight truncate">{t}</span>
                  <Ic size={13} className="shrink-0" />
                </div>
                <div className="font-display text-base sm:text-lg truncate">{v}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5 truncate">{s}</div>
              </div>
            ))}
          </div>
          <div className="p-3.5 rounded-xl border border-border bg-background">
            <div className="text-xs font-bold mb-3">Revenue breakdown</div>
            {[['Tips', 0.82, '$20,038'], ['PPV', 0.42, '$1,010'], ['Subscriptions', 0.22, '$120']].map(([l, w, v]) => (
              <div key={l as string} className="flex items-center gap-2.5 mb-2">
                <span className="text-[11px] text-muted-foreground w-[78px] font-semibold">{l}</span>
                <span className="flex-1 h-[7px] rounded-full bg-secondary overflow-hidden">
                  <span className="block h-full [background:var(--brand-grad)] rounded-full" style={{ width: `${(w as number) * 100}%` }} />
                </span>
                <span className="tabular-nums text-[11px] font-bold w-[54px] text-right">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function Toggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => set(!on)}
      className="w-[42px] h-6 rounded-full p-[3px] border border-border flex transition-colors"
      style={{ background: on ? 'var(--brand-grad)' : 'var(--secondary)', justifyContent: on ? 'flex-end' : 'flex-start' }}
    >
      <span className="w-[18px] h-[18px] rounded-full bg-white shadow-sm" />
    </button>
  );
}

export function AIMock() {
  const [calls, setCalls] = useState(true);
  const [dms, setDms] = useState(true);
  return (
    <Frame label="blabber.ai/settings">
      <div className="p-5 bg-card h-[340px] overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
          <AIBadge /> <span className="font-bold text-sm">AI Features</span>
        </div>
        <div className="text-xs text-muted-foreground mb-[18px]">Configure AI-powered features</div>
        {([['Enable AI Calls', 'Allow AI-powered voice calls with your personality', calls, setCalls], ['Enable AI DMs', 'Allow AI-powered direct messages in your voice', dms, setDms]] as const).map(([t, d, on, set]) => (
          <div key={t} className="flex items-center gap-3 py-3 border-b border-border">
            <div className="flex-1">
              <div className="font-semibold text-[13px]">{t}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{d}</div>
            </div>
            <Toggle on={on} set={set} />
          </div>
        ))}
        <div className="font-semibold text-[12.5px] mt-4 mb-[7px]">Personality prompt</div>
        <div className="p-[11px] rounded-[10px] border border-border bg-background text-[11.5px] text-muted-foreground leading-snug h-16 overflow-hidden">
          Amber is a vibrant young creator from Cincinnati — warm, playful, and quick-witted. She loves late-night chats and remembers every fan…
        </div>
        <div className="flex items-center gap-2.5 mt-3 p-2.5 rounded-[10px] [background:var(--brand-grad-soft)]">
          <span className="w-[30px] h-[30px] rounded-full [background:var(--brand-grad)] grid place-items-center text-white shrink-0">
            <Play size={13} fill="#fff" strokeWidth={0} />
          </span>
          <div className="flex-1">
            <div className="text-[11.5px] font-semibold">Voice clone · 0:21</div>
            <span className="block h-[5px] rounded-full bg-secondary mt-[5px] overflow-hidden">
              <span className="block h-full w-[40%] [background:var(--brand-grad)]" />
            </span>
          </div>
          <span className="land-pill bg-card text-[var(--brand-pink)] text-[10px] font-bold">Active</span>
        </div>
      </div>
    </Frame>
  );
}

export function StoreMock() {
  const prods = [['WaterBoy Recovery', '$28'], ['Signed Print', '$45']] as const;
  return (
    <Frame label="blabber.ai/u/amberscott">
      <div className="min-h-[400px] bg-card overflow-hidden">
        <div className="land-ph h-[92px] relative" style={{ '--ph-a': 'oklch(0.72 0.17 350)', '--ph-b': 'oklch(0.7 0.16 60)' } as React.CSSProperties}>
          <span className="land-pill absolute top-2.5 right-3 bg-[var(--brand-pink)] text-white text-[10.5px] font-bold">
            <Settings size={11} /> Edit Profile
          </span>
        </div>
        <div className="px-3 sm:px-[18px] relative z-10">
          <div className="-mt-[34px] flex items-start gap-2.5 sm:gap-3 mb-3">
            <div className="rounded-full p-[3px] bg-card shrink-0">
              <LandingAvatar handle="amberscott" size={64} />
            </div>
            <div className="pt-[38px] min-w-0 pb-0.5">
              <div className="flex items-center gap-1 font-bold text-[14px] sm:text-[15px]">
                <span className="truncate">Amber Scott</span>
                <VerifiedBadge size={13} />
              </div>
              <div className="text-[11px] sm:text-[11.5px] text-muted-foreground truncate">
                @amberscott · 28k subscribers
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mb-3 sm:mb-3.5 gap-2">
            <span className="font-bold text-[13px]">Store</span>
            <span className="land-pill [background:var(--brand-grad)] text-white text-[10.5px] font-bold"><Plus size={11} /> Add Product</span>
          </div>
          <div className="grid grid-cols-2 gap-[11px]">
            {prods.map(([n, p], i) => (
              <div key={n} className="rounded-xl overflow-hidden border border-border bg-background">
                <div className="land-ph h-[110px]" style={{ '--ph-a': i ? 'oklch(0.7 0.13 60)' : 'oklch(0.7 0.13 200)', '--ph-b': i ? 'oklch(0.6 0.16 30)' : 'oklch(0.6 0.16 250)' } as React.CSSProperties} />
                <div className="p-2.5 px-[11px]">
                  <div className="text-[11.5px] font-semibold truncate">{n}</div>
                  <div className="flex items-center justify-between mt-[5px]">
                    <span className="font-display text-sm text-[var(--brand-pink)]">{p}</span>
                    <span className="land-pill bg-secondary text-muted-foreground text-[9.5px] font-bold">Buy</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function Coin({ className, style, children }: { className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'absolute z-[3] w-[54px] h-[54px] rounded-full [background:var(--brand-grad)] grid place-items-center text-white land-coin-bob',
        'border-[3px] border-background shadow-[0_12px_30px_-8px_var(--brand-pink)]',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

export function FeedShowcase() {
  return (
    <div className="relative w-full max-w-[520px] mx-auto min-w-0">
      <Coin className="hidden sm:grid left-[-26px] top-10" style={{ animationDelay: '0s' } as React.CSSProperties}><DollarSign size={22} /></Coin>
      <Coin className="hidden sm:grid right-[-8px] top-[-18px]" style={{ animationDelay: '0.6s' } as React.CSSProperties}><Coins size={22} /></Coin>
      <Coin className="hidden sm:grid right-0 top-[250px]" style={{ animationDelay: '1.1s' } as React.CSSProperties}><Heart size={22} /></Coin>
      <Frame label="blabber.ai">
        <div className="bg-card p-3 sm:p-4 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2.5 mb-3 min-w-0">
            <LandingAvatar handle="siennavale" size={42} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 font-bold text-sm min-w-0">
                <span className="truncate">Sienna Vale</span>
                <VerifiedBadge size={13} />
                <AIBadge small />
              </div>
              <div className="text-xs text-muted-foreground truncate">@siennavale · 2h</div>
            </div>
            <MoreHorizontal size={18} className="text-muted-foreground shrink-0" />
          </div>
          <p className="text-sm leading-normal mb-3">
            late-night thoughts, just for my inner circle 🖤 unlock to see what i&apos;ve been working on.
          </p>
          <div className="relative rounded-[14px] h-[200px] sm:h-[220px] overflow-hidden isolate">
            <Image
              src="/avatars/hero-sienna.jpg"
              alt=""
              fill
              className="object-cover object-[center_25%] blur-[14px] scale-110"
              sizes="(max-width: 640px) 100vw, 520px"
            />
            <div className="absolute inset-0 bg-[rgba(10,6,16,0.4)] grid place-items-center px-3">
              <div className="text-center text-white max-w-full">
                <div className="w-[46px] h-[46px] rounded-full bg-white/16 border border-white/30 grid place-items-center mx-auto mb-2.5">
                  <Lock size={19} />
                </div>
                <span className="land-pill inline-flex bg-[var(--brand-pink)] text-white text-[11px] sm:text-xs font-bold px-3 sm:px-4 py-[7px] whitespace-nowrap">
                  Subscribe · $14.99/mo
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-[18px] mt-3 text-muted-foreground text-[12px] sm:text-[13px] font-semibold min-w-0">
            <span className="inline-flex items-center gap-1.5 shrink-0 text-[var(--brand-pink)]">
              <Heart size={16} className="sm:w-[17px] sm:h-[17px]" fill="currentColor" strokeWidth={0} /> 3.1k
            </span>
            <span className="inline-flex items-center gap-1.5 shrink-0">
              <MessageSquare size={16} className="sm:w-[17px] sm:h-[17px]" /> 214
            </span>
            <span className="inline-flex items-center gap-1.5 shrink-0 tabular-nums">
              <Coins size={16} className="sm:w-[17px] sm:h-[17px] text-[var(--brand-gold)]" /> $1.2k
            </span>
            <span className="land-pill inline-flex shrink-0 ml-auto [background:var(--brand-grad)] text-white text-[10.5px] sm:text-[11.5px] font-bold px-2.5 sm:px-3 py-1">
              <Phone size={12} /> Call
            </span>
          </div>
        </div>
      </Frame>
    </div>
  );
}

export function MockAvatarChip({ handle }: { handle: string }) {
  return <LandingAvatar handle={handle} size={34} />;
}
