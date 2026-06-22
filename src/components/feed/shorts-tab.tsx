'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Flame, Heart, LayoutGrid, Play, Sparkles } from 'lucide-react';
import { getShortsPostsWithInteractions } from '@/app/actions/postActions';
import { Post } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { muxThumbnailUrl } from '@/lib/mux/thumbnail';
import { cn } from '@/lib/utils';
import { AIBadge } from '@/components/landing/_atoms';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ShortGridPreview } from '@/components/feed/ShortGridPreview';
import { ShortsModal } from '@/components/feed/ShortsModal';

const SHORT_CATEGORIES = [
  'For You',
  'Trending',
  'AI Companions',
  'Live highlights',
  'New',
  'Following',
] as const;

type ShortCategory = (typeof SHORT_CATEGORIES)[number];

const GRADIENT_FALLBACKS: [string, string][] = [
  ['oklch(0.56 0.2 330)', 'oklch(0.42 0.2 290)'],
  ['oklch(0.68 0.14 60)', 'oklch(0.48 0.17 28)'],
  ['oklch(0.55 0.14 200)', 'oklch(0.4 0.16 250)'],
  ['oklch(0.5 0.16 220)', 'oklch(0.44 0.12 260)'],
  ['oklch(0.46 0.2 340)', 'oklch(0.4 0.18 305)'],
  ['oklch(0.38 0.14 265)', 'oklch(0.32 0.1 310)'],
];

function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function getShortThumbnail(post: Post): string | null {
  const media = post.post_media?.find((m) => m.media_type === 'short') ?? post.post_media?.[0];
  if (!media) return null;
  if (media.mux_playback_id) {
    return muxThumbnailUrl(media.mux_playback_id, { time: 0, width: 400 });
  }
  return media.storage_path ?? null;
}

function getShortGradient(post: Post, index: number): [string, string] {
  const media = post.post_media?.[0];
  const meta = media?.metadata as { ph_a?: string; ph_b?: string } | undefined;
  if (meta?.ph_a && meta?.ph_b) return [meta.ph_a, meta.ph_b];
  return GRADIENT_FALLBACKS[index % GRADIENT_FALLBACKS.length];
}

type ShortThumbProps = {
  post: Post;
  onClick: () => void;
  rank?: number;
  isAi?: boolean;
  className?: string;
  fixedWidth?: number;
  priority?: boolean;
};

function ShortThumb({ post, onClick, rank, isAi, className, fixedWidth, priority }: ShortThumbProps) {
  const creator = post.profiles;
  const thumb = getShortThumbnail(post);
  const caption = post.text_content?.trim() || 'Short';
  const views = post.view_count ?? 0;
  const thumbSizes = fixedWidth ? `${fixedWidth}px` : '33vw';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'short-thumb group relative overflow-hidden rounded-2xl border border-border text-left',
        fixedWidth ? 'shrink-0' : 'w-full',
        className
      )}
      style={{
        width: fixedWidth ? fixedWidth : undefined,
        aspectRatio: '9 / 16',
        background: thumb
          ? undefined
          : `linear-gradient(145deg, ${getShortGradient(post, 0)[0]}, ${getShortGradient(post, 0)[1]})`,
      }}
    >
      <ShortGridPreview post={post} priority={priority} sizes={thumbSizes} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="short-hover absolute inset-0 grid place-items-center bg-black/25 opacity-0 transition-opacity duration-200">
        <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-white/90 text-[#111]">
          <Play size={22} fill="#111" strokeWidth={0} />
        </span>
      </div>
      {rank != null && (
        <div
          className="absolute left-2.5 top-2 font-display text-[30px] font-extrabold leading-none text-white"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
        >
          {rank}
        </div>
      )}
      {isAi && (
        <div className="absolute right-2 top-2">
          <AIBadge small />
        </div>
      )}
      {!rank && !isAi && views > 0 && (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-black/40 px-1.5 py-0.5 text-[11.5px] font-bold text-white">
          <Play size={11} fill="#fff" strokeWidth={0} />
          {formatCompactCount(views)}
        </div>
      )}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
        <p className="mb-1.5 line-clamp-2 text-[12.5px] font-semibold leading-snug">{caption}</p>
        <div className="flex items-center gap-1.5">
          <Avatar className="h-[22px] w-[22px] border-0" profileId={creator.id}>
            <AvatarImage src={creator.avatar_url ?? undefined} alt={creator.username ?? ''} />
            <AvatarFallback className="text-[9px]">
              {(creator.username ?? 'U').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-[11.5px] font-semibold">@{creator.username}</span>
        </div>
      </div>
    </button>
  );
}

type ShortRailProps = {
  title: string;
  icon: React.ReactNode;
  accentClass?: string;
  posts: Post[];
  aiFlags: Record<string, boolean>;
  onOpen: (postId: string) => void;
  ranked?: boolean;
};

function ShortRail({ title, icon, posts, aiFlags, onOpen, ranked }: ShortRailProps) {
  if (posts.length === 0) return null;

  return (
    <section className="mb-[30px]">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="font-display text-[19px] text-foreground">{title}</h2>
        <div className="flex-1" />
        <button type="button" className="shrink-0 text-[13px] font-semibold text-muted-foreground/80">
          See all
        </button>
      </div>
      <div className="scroll-x -mx-[22px] flex gap-3 px-[22px] pb-1">
        {posts.map((post, k) => (
          <ShortThumb
            key={post.id}
            post={post}
            onClick={() => onOpen(post.id)}
            rank={ranked ? k + 1 : undefined}
            isAi={!!aiFlags[post.user_id]}
            fixedWidth={160}
            priority={k === 0}
          />
        ))}
      </div>
    </section>
  );
}

function ShortsTabSkeleton() {
  return (
    <div className="px-[22px] pb-[60px] pt-5">
      <div className="mb-[22px] h-[230px] animate-pulse rounded-[22px] bg-muted" />
      <div className="scroll-x -mx-[22px] mb-6 flex gap-2 px-[22px]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
      <div className="scroll-x -mx-[22px] mb-8 flex gap-3 px-[22px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[284px] w-[160px] shrink-0 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[9/16] animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function ShortsTab() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ShortCategory>('For You');
  const [aiFlags, setAiFlags] = useState<Record<string, boolean>>({});
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [initialPostId, setInitialPostId] = useState<string | undefined>();

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getShortsPostsWithInteractions(0, 48);
      if (result.error) {
        setError(result.error);
        setPosts([]);
      } else {
        setPosts(result.data ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shorts');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (posts.length === 0) return;
    const supabase = createClient();
    const userIds = [...new Set(posts.map((p) => p.user_id))];

    supabase
      .from('creators')
      .select('profile_id, can_img_gen')
      .in('profile_id', userIds)
      .then(({ data }) => {
        const flags: Record<string, boolean> = {};
        (data ?? []).forEach((row: { profile_id: string; can_img_gen: boolean | null }) => {
          flags[row.profile_id] = !!row.can_img_gen;
        });
        setAiFlags(flags);
      });
  }, [posts]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('subscriptions')
        .select('following_id')
        .eq('follower_id', user.id)
        .eq('status', 'active')
        .then(({ data }) => {
          setFollowingIds(new Set((data ?? []).map((r: { following_id: string }) => r.following_id)));
        });
    });
  }, []);

  const filteredPosts = useMemo(() => {
    let list = [...posts];
    switch (category) {
      case 'AI Companions':
        list = list.filter((p) => aiFlags[p.user_id]);
        break;
      case 'Live highlights':
        list = list.filter(
          (p) =>
            p.content_type === 'live_stream' ||
            p.post_media?.some((m) => m.media_type === 'live_stream')
        );
        break;
      case 'New':
        list.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case 'Following':
        list = list.filter((p) => followingIds.has(p.user_id));
        break;
      case 'Trending':
      case 'For You':
      default:
        break;
    }
    return list;
  }, [posts, category, aiFlags, followingIds]);

  const featured = filteredPosts[0] ?? posts[0];
  const trendingRail = (filteredPosts.length ? filteredPosts : posts).slice(0, 6);
  const aiPosts = (filteredPosts.length ? filteredPosts : posts).filter((p) => aiFlags[p.user_id]).slice(0, 6);
  const discoverPosts = filteredPosts.length ? filteredPosts : posts;

  const openShort = (postId: string) => {
    setInitialPostId(postId);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setInitialPostId(undefined);
  };

  if (loading) return <ShortsTabSkeleton />;

  if (error) {
    return (
      <div className="px-[22px] py-12 text-center text-destructive">
        Error loading shorts: {error}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="px-[22px] py-16 text-center text-muted-foreground">
        No shorts found yet.
      </div>
    );
  }

  const featuredCreator = featured.profiles;
  const featuredThumb = getShortThumbnail(featured);
  const [phA, phB] = getShortGradient(featured, 0);
  const featuredCaption = featured.text_content?.trim() || 'Trending short';

  return (
    <>
      <div className="px-[22px] pb-[60px] pt-5">
        {/* Featured hero — Dim ShortsTab */}
        <button
          type="button"
          onClick={() => openShort(featured.id)}
          className="relative mb-[22px] h-[230px] w-full cursor-pointer overflow-hidden rounded-[22px] border border-border text-left"
          style={{
            background: featuredThumb
              ? undefined
              : `linear-gradient(100deg, ${phA}, ${phB})`,
          }}
        >
          {featuredThumb && (
            <Image src={featuredThumb} alt="" fill className="object-cover" sizes="740px" priority />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[rgba(8,4,14,0.78)] via-[rgba(8,4,14,0.35)] to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-between p-[26px]">
            <div className="flex gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-white"
                style={{ background: 'var(--brand-live)' }}
              >
                <Flame size={13} />
                #1 Trending Short
              </span>
              {aiFlags[featured.user_id] && <AIBadge />}
            </div>
            <div className="max-w-[430px] text-white">
              <div className="mb-2 flex items-center gap-2">
                <Avatar className="h-[38px] w-[38px] border-0" profileId={featuredCreator.id}>
                  <AvatarImage src={featuredCreator.avatar_url ?? undefined} alt="" />
                  <AvatarFallback>
                    {(featuredCreator.username ?? 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[15px] font-bold">
                  {featuredCreator.full_name || featuredCreator.username}
                </span>
              </div>
              <p className="font-display mb-3 text-[22px] leading-[1.15]">{featuredCaption}</p>
              <div className="flex items-center gap-3.5">
                <span className="inline-flex h-[42px] items-center gap-2 rounded-full bg-white px-[22px] text-[14px] font-bold text-[#111]">
                  <Play size={16} fill="#111" strokeWidth={0} />
                  Watch now
                </span>
                <span className="flex items-center gap-1.5 text-[13px] opacity-90">
                  <Heart size={14} fill="#fff" strokeWidth={0} />
                  {formatCompactCount(featured.like_count)}
                  <span className="opacity-60">·</span>
                  <Play size={13} fill="#fff" strokeWidth={0} />
                  {formatCompactCount(featured.view_count)}
                </span>
              </div>
            </div>
          </div>
        </button>

        {/* Category chips */}
        <div className="scroll-x -mx-[22px] mb-[26px] flex gap-2 px-[22px]">
          {SHORT_CATEGORIES.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  'shrink-0 rounded-full px-[15px] py-2 text-[13px] font-semibold transition-[color,background,box-shadow] duration-150',
                  active
                    ? 'text-[var(--brand-on-accent)]'
                    : 'border border-border text-muted-foreground'
                )}
                style={
                  active
                    ? {
                        background: 'var(--brand-grad)',
                        boxShadow: 'var(--brand-ring-money)',
                      }
                    : { background: 'var(--brand-surface)' }
                }
              >
                {cat}
              </button>
            );
          })}
        </div>

        {discoverPosts.length === 0 ? (
          <p className="py-10 text-center text-[14.5px] text-muted-foreground">
            Nothing here yet in this category.
          </p>
        ) : (
          <>
            <ShortRail
              title="Trending now"
              icon={<Flame className="h-[18px] w-[18px] shrink-0 text-[var(--brand-pink)]" aria-hidden />}
              posts={trendingRail}
              aiFlags={aiFlags}
              onOpen={openShort}
              ranked
            />
            <ShortRail
              title="From AI Companions"
              icon={<Sparkles className="h-[18px] w-[18px] shrink-0 text-[var(--brand-violet)]" aria-hidden />}
              posts={aiPosts}
              aiFlags={aiFlags}
              onOpen={openShort}
            />

            <section>
              <div className="mb-3.5 flex items-center gap-2">
                <LayoutGrid
                  className="h-[17px] w-[17px] shrink-0 text-[var(--brand-gold)]"
                  aria-hidden
                />
                <h2 className="font-display text-[19px] text-foreground">Discover</h2>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {discoverPosts.map((post, i) => (
                  <ShortThumb
                    key={post.id}
                    post={post}
                    onClick={() => openShort(post.id)}
                    isAi={!!aiFlags[post.user_id]}
                    priority={i < 3}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      <ShortsModal
        isOpen={modalOpen}
        onClose={closeModal}
        initialPostId={initialPostId}
      />
    </>
  );
}
