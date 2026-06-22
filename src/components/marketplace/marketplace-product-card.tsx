'use client';

import Image from 'next/image';
import { Package } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AdminCard } from '@/components/admin/admin-ui';
import { cn } from '@/lib/utils';

interface MarketplaceProductCardProps {
  productName: string;
  priceLabel: string;
  imageUrl: string | null;
  isPhysical: boolean;
  creatorName: string;
  creatorAvatarUrl?: string | null;
  onClick: () => void;
  className?: string;
}

export function MarketplaceProductCard({
  productName,
  priceLabel,
  imageUrl,
  isPhysical,
  creatorName,
  creatorAvatarUrl,
  onClick,
  className,
}: MarketplaceProductCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-pink)] rounded-2xl',
        className,
      )}
    >
      <AdminCard padding="none" className="overflow-hidden h-full transition-colors group-hover:border-[var(--brand-pink)]/30">
        <div className="relative aspect-square bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={productName}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package size={32} className="text-muted-foreground opacity-50" />
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur-sm">
            {isPhysical ? 'Physical' : 'Digital'}
          </span>
        </div>
        <div className="p-3">
          <p className="mb-1.5 line-clamp-2 min-h-[34px] text-[13px] font-semibold leading-snug">
            {productName}
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-base tabular-nums text-[var(--brand-pink)]">{priceLabel}</span>
            <Avatar className="h-[22px] w-[22px] shrink-0">
              <AvatarImage src={creatorAvatarUrl || undefined} alt={creatorName} />
              <AvatarFallback className="text-[9px]">{creatorName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </AdminCard>
    </button>
  );
}
