'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect, useCallback } from 'react';
import { Package, Store } from 'lucide-react';

import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { PageShell } from '@/components/layout/page-header';
import { CreateProductDialog } from '@/components/marketplace/create-product-dialog';
import { MarketplaceProductCard } from '@/components/marketplace/marketplace-product-card';
import { MarketplaceStoreCard } from '@/components/marketplace/marketplace-store-card';
import { AdminCard } from '@/components/admin/admin-ui';
import { useCreditMonetization } from '@/lib/contexts/credit-monetization-context';
import { formatUsdFromCents, formatUsdWithCreditsSuffix } from '@/lib/credits/monetization-display';

interface FeaturedProduct {
  id: string;
  product_name: string;
  price_cents: number;
  shipping_price_cents: number | null;
  main_photo: string | null;
  creator_profile_id: string;
  creator: {
    username: string;
    avatar_url: string | null;
    full_name: string | null;
  } | null;
}

interface CreatorStoreSummary {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  productCount: number;
  minPriceCents: number;
  maxPriceCents: number;
}

function productSlug(name: string) {
  return encodeURIComponent(name.toLowerCase().replace(/\s+/g, '-'));
}

function formatPriceRange(minCents: number, maxCents: number) {
  if (minCents === maxCents) return formatUsdFromCents(minCents);
  return `${formatUsdFromCents(minCents)} – ${formatUsdFromCents(maxCents)}`;
}

export default function MarketplacePage() {
  const supabase = createClient();
  const router = useRouter();
  const { profile } = useUser();
  const { creditOnlyEcosystem, pricePerCreditCents } = useCreditMonetization();

  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [creatorStores, setCreatorStores] = useState<CreatorStoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);

  const formatBuyerPrice = useCallback(
    (cents: number) => formatUsdWithCreditsSuffix(cents, creditOnlyEcosystem, pricePerCreditCents),
    [creditOnlyEcosystem, pricePerCreditCents],
  );

  const fetchMarketplaceData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: products, error: productsError } = await supabase
        .from('creator_products')
        .select(
          `
          id,
          product_name,
          price_cents,
          shipping_price_cents,
          main_photo,
          creator_profile_id,
          profiles:creator_profile_id (
            username,
            avatar_url,
            full_name
          )
        `,
        )
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(12);

      if (productsError) throw productsError;

      const mappedProducts: FeaturedProduct[] = (products ?? []).map((row) => {
        const profileRow = row.profiles as FeaturedProduct['creator'] | FeaturedProduct['creator'][];
        const creator = Array.isArray(profileRow) ? profileRow[0] ?? null : profileRow;
        return {
          id: row.id,
          product_name: row.product_name,
          price_cents: row.price_cents,
          shipping_price_cents: row.shipping_price_cents,
          main_photo: row.main_photo,
          creator_profile_id: row.creator_profile_id,
          creator,
        };
      });
      setFeaturedProducts(mappedProducts);

      const { data: allProducts, error: storesError } = await supabase
        .from('creator_products')
        .select('creator_profile_id, price_cents')
        .eq('is_active', true);

      if (storesError) throw storesError;

      const storeMap = new Map<string, { count: number; min: number; max: number }>();
      for (const row of allProducts ?? []) {
        const existing = storeMap.get(row.creator_profile_id);
        if (existing) {
          existing.count += 1;
          existing.min = Math.min(existing.min, row.price_cents);
          existing.max = Math.max(existing.max, row.price_cents);
        } else {
          storeMap.set(row.creator_profile_id, {
            count: 1,
            min: row.price_cents,
            max: row.price_cents,
          });
        }
      }

      const creatorIds = Array.from(storeMap.keys());
      if (creatorIds.length === 0) {
        setCreatorStores([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, banner_url')
        .in('id', creatorIds);

      if (profilesError) throw profilesError;

      const stores: CreatorStoreSummary[] = (profiles ?? [])
        .map((p) => {
          const stats = storeMap.get(p.id);
          if (!stats) return null;
          return {
            id: p.id,
            username: p.username,
            full_name: p.full_name,
            avatar_url: p.avatar_url,
            banner_url: p.banner_url,
            productCount: stats.count,
            minPriceCents: stats.min,
            maxPriceCents: stats.max,
          };
        })
        .filter((s): s is CreatorStoreSummary => s !== null)
        .sort((a, b) => b.productCount - a.productCount);

      setCreatorStores(stores);
    } catch (error) {
      console.error('Error loading marketplace:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void fetchMarketplaceData();
  }, [fetchMarketplaceData]);

  useEffect(() => {
    const checkCreatorStatus = async () => {
      if (!profile?.id) return;
      const { data: creator, error } = await supabase
        .from('creators')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();
      setIsCreator(!error && !!creator);
    };
    if (profile?.id) void checkCreatorStatus();
  }, [profile?.id, supabase]);

  const goToProduct = (product: FeaturedProduct) => {
    const username = product.creator?.username;
    if (!username) return;
    router.push(`/u/${username}/${productSlug(product.product_name)}`);
  };

  const goToStore = (store: CreatorStoreSummary) => {
    router.push(`/u/${store.username}?store`);
  };

  return (
    <RequireAuth>
      <PageShell
        title="Marketplace"
        subtitle="Shop directly from creators"
        rightActions={
          isCreator && profile?.id ? (
            <CreateProductDialog profileId={profile.id} onCreated={fetchMarketplaceData} />
          ) : null
        }
      >
        <div className="mx-auto max-w-[760px] px-[22px] pb-[60px] pt-5">
          {/* Featured products */}
          <section className="mb-[30px]">
            <h2 className="mb-3.5 text-[15px] font-bold">Featured products</h2>
            {loading ? (
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <AdminCard key={i} padding="none" className="animate-pulse overflow-hidden">
                    <div className="aspect-square bg-muted" />
                    <div className="space-y-2 p-3">
                      <div className="h-4 rounded-full bg-muted" />
                      <div className="h-4 w-1/2 rounded-full bg-muted" />
                    </div>
                  </AdminCard>
                ))}
              </div>
            ) : featuredProducts.length === 0 ? (
              <AdminCard className="py-10 text-center">
                <Package size={36} className="mx-auto mb-3 text-muted-foreground opacity-60" />
                <p className="font-display text-base font-semibold">No products yet</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                  When creators list items, they&apos;ll show up here.
                </p>
              </AdminCard>
            ) : (
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                {featuredProducts.map((product) => (
                  <MarketplaceProductCard
                    key={product.id}
                    productName={product.product_name}
                    priceLabel={formatBuyerPrice(product.price_cents)}
                    imageUrl={product.main_photo}
                    isPhysical={
                      product.shipping_price_cents != null && product.shipping_price_cents > 0
                    }
                    creatorName={
                      product.creator?.full_name || product.creator?.username || 'Creator'
                    }
                    creatorAvatarUrl={product.creator?.avatar_url}
                    onClick={() => goToProduct(product)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Creator stores */}
          <section>
            <h2 className="mb-3.5 text-[15px] font-bold">Creator stores</h2>
            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <AdminCard key={i} padding="none" className="animate-pulse overflow-hidden">
                    <div className="h-[92px] bg-muted" />
                    <div className="space-y-2 px-4 pb-4 pt-2">
                      <div className="h-[50px] w-[50px] rounded-full bg-muted" />
                      <div className="h-4 w-2/3 rounded-full bg-muted" />
                      <div className="h-3 w-1/2 rounded-full bg-muted" />
                    </div>
                  </AdminCard>
                ))}
              </div>
            ) : creatorStores.length === 0 ? (
              <AdminCard className="py-10 text-center">
                <Store size={36} className="mx-auto mb-3 text-muted-foreground opacity-60" />
                <p className="font-display text-base font-semibold">No creator stores yet</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                  Browse creator profiles to find their shops once they start selling.
                </p>
              </AdminCard>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {creatorStores.map((store) => (
                  <MarketplaceStoreCard
                    key={store.id}
                    name={store.full_name || store.username}
                    username={store.username}
                    avatarUrl={store.avatar_url}
                    bannerUrl={store.banner_url}
                    productCount={store.productCount}
                    priceRangeLabel={formatPriceRange(store.minPriceCents, store.maxPriceCents)}
                    onClick={() => goToStore(store)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </PageShell>
    </RequireAuth>
  );
}
