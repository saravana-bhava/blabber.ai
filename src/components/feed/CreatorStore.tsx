'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Package, Upload, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { useCreditMonetization } from '@/lib/contexts/credit-monetization-context';
import { formatUsdWithCreditsSuffix } from '@/lib/credits/monetization-display';
import { cn } from '@/lib/utils';
import {
  AdminCard,
  AdminGradButton,
  AdminGhostButton,
  AdminDialogPanel,
  adminInputClass,
  adminTextareaClass,
  brandCancelBtn,
} from '@/components/admin/admin-ui';

interface CreatorProduct {
  id: string;
  creator_profile_id: string;
  product_name: string;
  description: string | null;
  price_cents: number;
  shipping_price_cents: number | null;
  main_photo: string | null;
  secondary_photo: string | null;
  tertiary_photo: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface CreatorStoreProps {
  creatorProfileId: string;
  isOwnStore?: boolean;
  isMarketPage?: boolean;
  isDemo?: boolean;
}

function productSlug(name: string) {
  return encodeURIComponent(name.toLowerCase().replace(/\s+/g, '-'));
}

export function CreatorStore({ creatorProfileId, isOwnStore = false, isMarketPage = false }: CreatorStoreProps) {
  const [products, setProducts] = useState<CreatorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const { creditOnlyEcosystem, pricePerCreditCents } = useCreditMonetization();
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [salesCount, setSalesCount] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    product_name: '',
    description: '',
    price_cents: '',
    shipping_price_cents: '',
    main_photo: null as File | null,
    secondary_photo: null as File | null,
    tertiary_photo: null as File | null,
  });

  const [imageUrls, setImageUrls] = useState({
    main_photo: '',
    secondary_photo: '',
    tertiary_photo: '',
  });

  const [creatorInfo, setCreatorInfo] = useState<{
    username: string;
    full_name?: string;
    avatar_url?: string;
    banner_url?: string | null;
  } | null>(null);

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from('creator_products')
        .select('*')
        .eq('creator_profile_id', creatorProfileId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (isMarketPage) {
        query = query.limit(3);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [creatorProfileId]);

  useEffect(() => {
    const fetchCreatorInfo = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, full_name, avatar_url, banner_url')
        .eq('id', creatorProfileId)
        .single();
      if (!error && data) {
        setCreatorInfo({
          username: data.username,
          full_name: data.full_name,
          avatar_url: data.avatar_url,
          banner_url: data.banner_url,
        });
      }
    };
    fetchCreatorInfo();
  }, [creatorProfileId, supabase]);

  const fetchMarketStats = useCallback(async () => {
    if (!isMarketPage) return;
    try {
      const { count: subCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', creatorProfileId)
        .eq('status', 'active');
      setFollowerCount(subCount ?? 0);

      const { data: productRows } = await supabase
        .from('creator_products')
        .select('id')
        .eq('creator_profile_id', creatorProfileId);
      const ids = productRows?.map((r) => r.id) ?? [];
      if (ids.length === 0) {
        setSalesCount(0);
        return;
      }
      const { count: orderCount } = await supabase
        .from('creator_product_orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'paid')
        .in('creator_product_id', ids);
      setSalesCount(orderCount ?? 0);
    } catch {
      setFollowerCount(null);
      setSalesCount(null);
    }
  }, [creatorProfileId, isMarketPage, supabase]);

  useEffect(() => {
    fetchMarketStats();
  }, [fetchMarketStats]);

  const handleImageUpload = async (file: File, type: 'main_photo' | 'secondary_photo' | 'tertiary_photo') => {
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${creatorProfileId}/${type}_${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage.from('product-images').upload(fileName, file);

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from('product-images').getPublicUrl(fileName);

      setImageUrls((prev) => ({ ...prev, [type]: publicUrl }));
      setFormData((prev) => ({ ...prev, [type]: file }));
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    }
  };

  const handleCreateProduct = async () => {
    if (!formData.product_name || !formData.price_cents) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    try {
      const uploadedUrls = { main_photo: '', secondary_photo: '', tertiary_photo: '' };

      if (formData.main_photo) {
        const fileExt = formData.main_photo.name.split('.').pop();
        const fileName = `${creatorProfileId}/main_${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('product-images').upload(fileName, formData.main_photo);
        if (error) throw error;
        const {
          data: { publicUrl },
        } = supabase.storage.from('product-images').getPublicUrl(fileName);
        uploadedUrls.main_photo = publicUrl;
      }

      if (formData.secondary_photo) {
        const fileExt = formData.secondary_photo.name.split('.').pop();
        const fileName = `${creatorProfileId}/secondary_${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('product-images').upload(fileName, formData.secondary_photo);
        if (error) throw error;
        const {
          data: { publicUrl },
        } = supabase.storage.from('product-images').getPublicUrl(fileName);
        uploadedUrls.secondary_photo = publicUrl;
      }

      if (formData.tertiary_photo) {
        const fileExt = formData.tertiary_photo.name.split('.').pop();
        const fileName = `${creatorProfileId}/tertiary_${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('product-images').upload(fileName, formData.tertiary_photo);
        if (error) throw error;
        const {
          data: { publicUrl },
        } = supabase.storage.from('product-images').getPublicUrl(fileName);
        uploadedUrls.tertiary_photo = publicUrl;
      }

      const { error } = await supabase
        .from('creator_products')
        .insert({
          creator_profile_id: creatorProfileId,
          product_name: formData.product_name,
          description: formData.description || null,
          price_cents: Math.round(parseFloat(formData.price_cents) * 100),
          shipping_price_cents: formData.shipping_price_cents
            ? Math.round(parseFloat(formData.shipping_price_cents) * 100)
            : null,
          main_photo: uploadedUrls.main_photo || null,
          secondary_photo: uploadedUrls.secondary_photo || null,
          tertiary_photo: uploadedUrls.tertiary_photo || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Product created successfully!');
      setIsCreateModalOpen(false);
      setFormData({
        product_name: '',
        description: '',
        price_cents: '',
        shipping_price_cents: '',
        main_photo: null,
        secondary_photo: null,
        tertiary_photo: null,
      });
      setImageUrls({ main_photo: '', secondary_photo: '', tertiary_photo: '' });
      fetchProducts();
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Failed to create product');
    } finally {
      setIsCreating(false);
    }
  };

  const formatBuyerPrice = (cents: number) =>
    formatUsdWithCreditsSuffix(cents, creditOnlyEcosystem, pricePerCreditCents);

  const goToProduct = (product: CreatorProduct) => {
    if (!creatorInfo?.username) return;
    router.push(`/u/${creatorInfo.username}/${productSlug(product.product_name)}`);
  };

  const renderImageUpload = (
    type: 'main_photo' | 'secondary_photo' | 'tertiary_photo',
    label: string,
    required?: boolean,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={type} className="text-sm font-semibold">
        {label}
        {required ? ' *' : ''}
      </Label>
      <div
        className="aspect-square bg-secondary rounded-2xl flex items-center justify-center relative overflow-hidden cursor-pointer border border-border hover:border-[var(--brand-pink)]/40 transition-colors"
        onClick={() => document.getElementById(type)?.click()}
      >
        {imageUrls[type] ? (
          <Image src={imageUrls[type]} alt={`${label} preview`} fill className="object-cover" />
        ) : (
          <Upload size={22} className="text-muted-foreground" />
        )}
      </div>
      <Input
        id={type}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file, type);
        }}
      />
    </div>
  );

  if (loading) {
    return (
      <div className={cn(isMarketPage ? 'p-4' : 'pt-4')}>
        <div className="grid grid-cols-2 gap-3.5">
          {[...Array(4)].map((_, i) => (
            <AdminCard key={i} padding="none" className="animate-pulse overflow-hidden">
              <div className="h-[150px] bg-muted" />
              <div className="p-3.5 space-y-2">
                <div className="h-4 bg-muted rounded-full w-3/4" />
                <div className="h-3 bg-muted rounded-full w-1/2" />
              </div>
            </AdminCard>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(isMarketPage ? 'border-b border-border/60 p-4' : 'pt-4')}>
      {isOwnStore && (
        <div className="mb-4">
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <AdminGradButton type="button">
                <Plus size={16} className="mr-2" />
                Add product
              </AdminGradButton>
            </DialogTrigger>
            <AdminDialogPanel
              icon={ShoppingBag}
              title="Create product"
              description="List a physical or digital item in your store"
              size="wide"
              footer={
                <>
                  <AdminGhostButton
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={isCreating}
                    className={brandCancelBtn}
                  >
                    Cancel
                  </AdminGhostButton>
                  <AdminGradButton type="button" onClick={handleCreateProduct} disabled={isCreating}>
                    {isCreating ? 'Creating…' : 'Create product'}
                  </AdminGradButton>
                </>
              }
            >
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="product_name" className="text-sm font-semibold">
                    Product name *
                  </Label>
                  <Input
                    id="product_name"
                    className={adminInputClass}
                    value={formData.product_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, product_name: e.target.value }))}
                    placeholder="Enter product name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-semibold">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    className={adminTextareaClass}
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your product"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-sm font-semibold">
                      Price (USD) *
                    </Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      className={adminInputClass}
                      value={formData.price_cents}
                      onChange={(e) => setFormData((prev) => ({ ...prev, price_cents: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shipping_price" className="text-sm font-semibold">
                      Shipping (USD)
                    </Label>
                    <Input
                      id="shipping_price"
                      type="number"
                      step="0.01"
                      min="0"
                      className={adminInputClass}
                      value={formData.shipping_price_cents}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, shipping_price_cents: e.target.value }))
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {renderImageUpload('main_photo', 'Main photo', true)}
                  {renderImageUpload('secondary_photo', 'Secondary photo')}
                  {renderImageUpload('tertiary_photo', 'Third photo')}
                </div>
              </div>
            </AdminDialogPanel>
          </Dialog>
        </div>
      )}

      {isMarketPage && creatorInfo && (
        <AdminCard padding="none" className="mb-5 overflow-hidden">
          <div
            className="relative h-36 w-full bg-muted md:h-44"
            style={
              creatorInfo.banner_url
                ? {
                    backgroundImage: `url(${creatorInfo.banner_url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : {
                    backgroundImage:
                      'repeating-linear-gradient(135deg, oklch(0.5 0.08 320 / 0.10) 0 2px, transparent 2px 11px), linear-gradient(135deg, var(--brand-violet), var(--brand-pink))',
                  }
            }
          />
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
            <Avatar className="h-12 w-12 shrink-0 border-2 border-background -mt-8">
              <AvatarImage
                src={creatorInfo.avatar_url || undefined}
                alt={creatorInfo.full_name || creatorInfo.username || 'User'}
              />
              <AvatarFallback />
            </Avatar>
            <div className="min-w-0 flex-1 sm:-mt-6">
              <Link href={`/u/${creatorInfo.username}`} className="block hover:underline">
                <h4 className="font-display text-base font-semibold leading-tight">
                  {creatorInfo.full_name || creatorInfo.username}
                </h4>
              </Link>
              {creatorInfo.username && (
                <Link
                  href={`/u/${creatorInfo.username}`}
                  className="block text-sm text-muted-foreground hover:underline"
                >
                  @{creatorInfo.username}
                </Link>
              )}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>
                  <span className="font-bold tabular-nums">{followerCount ?? '—'}</span>{' '}
                  <span className="text-muted-foreground">followers</span>
                </span>
                <span>
                  <span className="font-bold tabular-nums">{salesCount ?? '—'}</span>{' '}
                  <span className="text-muted-foreground">sales</span>
                </span>
              </div>
            </div>
            <AdminGradButton
              type="button"
              className="shrink-0"
              onClick={() => router.push(`/u/${creatorInfo.username}?store`)}
            >
              View store
            </AdminGradButton>
          </div>
        </AdminCard>
      )}

      {products.length === 0 ? (
        <AdminCard className="text-center py-10">
          <Package size={40} className="mx-auto text-muted-foreground mb-3 opacity-60" />
          <h3 className="font-display text-base font-semibold mb-1">
            {isOwnStore ? 'No products yet' : 'No products available'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            {isOwnStore
              ? 'Add your first product to start selling to fans.'
              : "This creator hasn't listed anything yet."}
          </p>
        </AdminCard>
      ) : (
        <div
          className={cn(
            'grid gap-3.5',
            isMarketPage ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2',
          )}
        >
          {products.map((product) => (
            <div
              key={product.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-pink)] rounded-2xl"
              onClick={() => goToProduct(product)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  goToProduct(product);
                }
              }}
            >
              <AdminCard padding="none" className="overflow-hidden group hover:border-[var(--brand-pink)]/30 transition-colors h-full">
              <div className="relative h-[150px] bg-muted">
                {product.main_photo ? (
                  <Image
                    src={product.main_photo}
                    alt={product.product_name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package size={36} className="text-muted-foreground opacity-50" />
                  </div>
                )}
              </div>
              <div className="p-3.5">
                <h3 className="font-semibold text-[14px] leading-snug line-clamp-2 mb-1">
                  {product.product_name}
                </h3>
                {product.shipping_price_cents != null && product.shipping_price_cents > 0 ? (
                  <p className="text-[11.5px] text-muted-foreground mb-2.5">
                    +{formatBuyerPrice(product.shipping_price_cents)} shipping
                  </p>
                ) : (
                  <p className="text-[11.5px] text-muted-foreground mb-2.5">Free shipping</p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-lg tabular-nums leading-none">
                    {formatBuyerPrice(product.price_cents)}
                  </span>
                  <AdminGradButton
                    type="button"
                    className="h-[34px] px-4 text-[13px] shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      goToProduct(product);
                    }}
                  >
                    Buy
                  </AdminGradButton>
                </div>
              </div>
              </AdminCard>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
