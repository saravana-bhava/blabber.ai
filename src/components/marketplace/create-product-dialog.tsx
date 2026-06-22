'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Plus, ShoppingBag, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  AdminDialogPanel,
  AdminGradButton,
  AdminGhostButton,
  adminInputClass,
  adminTextareaClass,
  brandCancelBtn,
} from '@/components/admin/admin-ui';

interface CreateProductDialogProps {
  profileId: string;
  onCreated: () => void;
}

export function CreateProductDialog({ profileId, onCreated }: CreateProductDialogProps) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
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

  const resetForm = () => {
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
  };

  const handleImageUpload = async (
    file: File,
    type: 'main_photo' | 'secondary_photo' | 'tertiary_photo',
  ) => {
    if (!file || !profileId) return;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profileId}/${type}_${Date.now()}.${fileExt}`;
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
    if (!formData.product_name || !formData.price_cents || !profileId) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    try {
      const uploadedUrls = { main_photo: '', secondary_photo: '', tertiary_photo: '' };

      for (const type of ['main_photo', 'secondary_photo', 'tertiary_photo'] as const) {
        const file = formData[type];
        if (!file) continue;
        const fileExt = file.name.split('.').pop();
        const fileName = `${profileId}/${type.split('_')[0]}_${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('product-images').upload(fileName, file);
        if (error) throw error;
        const {
          data: { publicUrl },
        } = supabase.storage.from('product-images').getPublicUrl(fileName);
        uploadedUrls[type] = publicUrl;
      }

      const { error } = await supabase.from('creator_products').insert({
        creator_profile_id: profileId,
        product_name: formData.product_name,
        description: formData.description || null,
        price_cents: Math.round(parseFloat(formData.price_cents) * 100),
        shipping_price_cents: formData.shipping_price_cents
          ? Math.round(parseFloat(formData.shipping_price_cents) * 100)
          : null,
        main_photo: uploadedUrls.main_photo || null,
        secondary_photo: uploadedUrls.secondary_photo || null,
        tertiary_photo: uploadedUrls.tertiary_photo || null,
      });

      if (error) throw error;

      toast.success('Product created successfully!');
      setOpen(false);
      resetForm();
      onCreated();
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Failed to create product');
    } finally {
      setIsCreating(false);
    }
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
        className="relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary transition-colors hover:border-[var(--brand-pink)]/40"
        onClick={() => document.getElementById(`marketplace-${type}`)?.click()}
      >
        {imageUrls[type] ? (
          <Image src={imageUrls[type]} alt={`${label} preview`} fill className="object-cover" />
        ) : (
          <Upload size={22} className="text-muted-foreground" />
        )}
      </div>
      <Input
        id={`marketplace-${type}`}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImageUpload(file, type);
        }}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <AdminGradButton type="button" className="h-[38px] gap-1.5 px-4 text-[13px]">
          <Plus size={16} aria-hidden />
          Create product
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
              onClick={() => setOpen(false)}
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {renderImageUpload('main_photo', 'Main photo', true)}
            {renderImageUpload('secondary_photo', 'Secondary photo')}
            {renderImageUpload('tertiary_photo', 'Third photo')}
          </div>
        </div>
      </AdminDialogPanel>
    </Dialog>
  );
}
