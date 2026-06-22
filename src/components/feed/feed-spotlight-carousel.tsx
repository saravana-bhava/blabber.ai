'use client';

import { useCallback, useEffect, useState } from 'react';
import { RemoteImage } from '@/components/ui/remote-image';
import Link from 'next/link';
import { Flame, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AIBadge, VerifiedBadge } from '@/components/landing/_atoms';
import { cn } from '@/lib/utils';

const GRADIENT_FALLBACKS: [string, string][] = [
  ['oklch(0.56 0.2 330)', 'oklch(0.42 0.2 290)'],
  ['oklch(0.68 0.14 60)', 'oklch(0.48 0.17 28)'],
  ['oklch(0.55 0.14 200)', 'oklch(0.4 0.16 250)'],
];

const SPOTLIGHT_TAGS = [
  'Featured creator',
  'AI Companion · Live calls tonight',
  'New this week',
];

type SpotlightCreator = {
  id: string;
  full_name: string;
  username: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  engagement_score?: number;
  subscription_price_cents?: number | null;
  showAiBadge?: boolean;
};

function formatFanStat(score?: number, postCount?: number): string {
  const n = score ?? postCount ?? 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M fans`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k fans`;
  if (n > 0) return `${Math.round(n)} fans`;
  return 'Creator';
}

function formatSubPrice(cents?: number | null): string {
  if (!cents || cents <= 0) return 'Subscribe';
  return `Subscribe · $${(cents / 100).toFixed(2)}/mo`;
}

export function FeedSpotlightCarouselSkeleton() {
  return (
    <div className="px-[22px] pt-4 pb-1">
      <div className="h-[248px] w-full animate-pulse rounded-[22px] bg-muted" />
    </div>
  );
}

export function FeedSpotlightCarousel() {
  const [slides, setSlides] = useState<SpotlightCreator[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchSpotlight = useCallback(async () => {
    const supabase = createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let blockedIds: string[] = [];
      if (user?.id) {
        const { data: blocked } = await supabase
          .from('blocked_users')
          .select('blockee_profile_id')
          .eq('blocker_profile_id', user.id);
        if (blocked) blockedIds = blocked.map((b: { blockee_profile_id: string }) => b.blockee_profile_id);
      }

      const { data: suggested, error } = await supabase.rpc('get_suggested_profiles', {
        p_current_user_id: user?.id ?? null,
        p_limit: 5,
        p_offset: 0,
      });

      if (error || !suggested?.length) {
        setSlides([]);
        return;
      }

      let profiles = suggested as SpotlightCreator[];
      if (blockedIds.length) {
        profiles = profiles.filter((p) => !blockedIds.includes(p.id));
      }
      profiles = profiles.slice(0, 3);

      const ids = profiles.map((p) => p.id);
      const { data: creators } = await supabase
        .from('creators')
        .select('profile_id, subscription_price_cents, can_img_gen')
        .in('profile_id', ids);

      const priceById = new Map(
        (creators ?? []).map((c: { profile_id: string; subscription_price_cents: number | null; can_img_gen: boolean }) => [
          c.profile_id,
          { price: c.subscription_price_cents, ai: c.can_img_gen },
        ])
      );

      setSlides(
        profiles.map((p) => ({
          ...p,
          subscription_price_cents: priceById.get(p.id)?.price ?? null,
          showAiBadge: priceById.get(p.id)?.ai ?? false,
        }))
      );
      setIndex(0);
    } catch {
      setSlides([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpotlight();
  }, [fetchSpotlight]);

  useEffect(() => {
    if (slides.length < 2) return;
    const iv = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 5500);
    return () => clearInterval(iv);
  }, [slides.length]);

  if (loading) return <FeedSpotlightCarouselSkeleton />;
  if (slides.length === 0) return null;

  const slide = slides[index];
  const [gradA, gradB] = GRADIENT_FALLBACKS[index % GRADIENT_FALLBACKS.length];
  const tag = SPOTLIGHT_TAGS[index % SPOTLIGHT_TAGS.length];
  const showAiTag = slide.showAiBadge || tag.includes('AI');
  const bannerSrc = slide.banner_url || null;

  const initials = (slide.full_name || slide.username || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="px-[22px] pt-4 pb-1">
      <div
        className="relative h-[248px] overflow-hidden rounded-[22px] border border-border"
        style={{
          background: bannerSrc
            ? undefined
            : `linear-gradient(135deg, ${gradA}, ${gradB})`,
        }}
      >
        {bannerSrc && (
          <RemoteImage
            src={bannerSrc}
            alt=""
            fill
            className="object-cover"
            sizes="680px"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(110deg, rgba(8,4,14,0.72) 30%, rgba(8,4,14,0.15) 75%)',
          }}
        />

        <div className="absolute inset-0 flex flex-col justify-between p-6 text-white">
          <div className="flex items-center gap-2">
            {showAiTag && <AIBadge small />}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[12.5px] font-semibold backdrop-blur-md">
              <Flame className="h-3.5 w-3.5" aria-hidden />
              {tag}
            </span>
          </div>

          <div className="max-w-[440px]">
            <div className="mb-2.5 flex items-center gap-2.5">
              <div className="relative h-[46px] w-[46px] shrink-0 overflow-hidden rounded-full ring-2 ring-white/40 ring-offset-2 ring-offset-transparent">
                {slide.avatar_url ? (
                  <RemoteImage
                    src={slide.avatar_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="46px"
                    priority
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-white/20 text-sm font-bold">
                    {initials}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1 font-display text-[19px] font-extrabold leading-tight">
                  {slide.full_name || slide.username}
                  <VerifiedBadge size={16} />
                </div>
                <p className="text-[12.5px] opacity-85">
                  @{slide.username} · {formatFanStat(slide.engagement_score)}
                </p>
              </div>
            </div>

            {slide.bio && (
              <p className="mb-4 line-clamp-2 text-[14.5px] leading-snug opacity-92">
                {slide.bio}
              </p>
            )}

            <div className="flex flex-wrap gap-2.5">
              <Link
                href={`/u/${slide.username}`}
                className="inline-flex h-10 items-center justify-center rounded-full bg-white px-5 text-[14px] font-bold text-[var(--brand-violet)]"
              >
                {formatSubPrice(slide.subscription_price_cents)}
              </Link>
              {showAiTag ? (
                <Link
                  href={`/u/${slide.username}`}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-5 text-[14px] font-semibold text-white backdrop-blur-sm"
                >
                  <Phone className="h-4 w-4" aria-hidden />
                  Call
                </Link>
              ) : (
                <Link
                  href={`/u/${slide.username}`}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/30 bg-white/15 px-5 text-[14px] font-semibold text-white backdrop-blur-sm"
                >
                  View profile
                </Link>
              )}
            </div>
          </div>
        </div>

        {slides.length > 1 && (
          <div className="absolute bottom-4 right-5 flex gap-1.5">
            {slides.map((_, k) => (
              <button
                key={k}
                type="button"
                aria-label={`Show creator ${k + 1}`}
                onClick={() => setIndex(k)}
                className={cn(
                  'h-[7px] rounded-full transition-all duration-300',
                  k === index ? 'w-[22px] bg-white' : 'w-[7px] bg-white/45'
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
