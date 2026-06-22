'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AdminCard, AdminPill } from '@/components/admin/admin-ui';
import { cn } from '@/lib/utils';

interface MarketplaceStoreCardProps {
  name: string;
  username: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  productCount: number;
  priceRangeLabel: string;
  onClick: () => void;
  className?: string;
}

export function MarketplaceStoreCard({
  name,
  username,
  avatarUrl,
  bannerUrl,
  productCount,
  priceRangeLabel,
  onClick,
  className,
}: MarketplaceStoreCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-pink)] rounded-2xl',
        className,
      )}
    >
      <AdminCard padding="none" className="overflow-hidden transition-colors group-hover:border-[var(--brand-pink)]/30">
        <div
          className="h-[92px] w-full bg-muted"
          style={
            bannerUrl
              ? {
                  backgroundImage: `url(${bannerUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {
                  backgroundImage:
                    'repeating-linear-gradient(135deg, oklch(0.5 0.08 320 / 0.10) 0 2px, transparent 2px 11px), linear-gradient(135deg, var(--brand-violet), var(--brand-pink))',
                }
          }
        />
        <div className="-mt-6 px-4 pb-4">
          <div className="mb-2 w-fit rounded-full border-[3px] border-background">
            <Avatar className="h-[50px] w-[50px]">
              <AvatarImage src={avatarUrl || undefined} alt={name} />
              <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
          <p className="font-display text-[15px] font-bold leading-tight">{name}</p>
          <p className="text-[12px] text-muted-foreground">@{username}</p>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="text-[13px] text-muted-foreground">
              {productCount} {productCount === 1 ? 'product' : 'products'}
            </span>
            <AdminPill variant="staff">{priceRangeLabel}</AdminPill>
          </div>
        </div>
      </AdminCard>
    </button>
  );
}
