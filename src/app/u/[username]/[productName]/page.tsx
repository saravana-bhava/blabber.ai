'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/contexts/user-context';
import { useCreditMonetization } from '@/lib/contexts/credit-monetization-context';
import { formatUsdWithCreditsSuffix } from '@/lib/credits/monetization-display';
import { usePulseUI } from '@/lib/contexts/pulse-ui-context';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, MoreVertical, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Shell (SideNav / right rail) is provided by ClientLayout.
import { RequireAuth } from '@/components/auth/require-auth';
import { BuyProductModal } from '@/components/subscription/BuyProductModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Product {
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
  creator: {
    username: string;
    full_name: string | null;
  } | null;
}

export default function ProductPage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const productName = params.productName as string;
  const { session, profile: currentUserProfile, isLoading } = useUser();
  const { creditOnlyEcosystem, pricePerCreditCents } = useCreditMonetization();
  const { pulseEnabled } = usePulseUI();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreatorDemo, setIsCreatorDemo] = useState(false);
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state for edit product
  const [editFormData, setEditFormData] = useState({
    product_name: '',
    description: '',
    price_cents: '',
    shipping_price_cents: '',
    main_photo: null as File | null,
    secondary_photo: null as File | null,
    tertiary_photo: null as File | null,
  });

  const [editImageUrls, setEditImageUrls] = useState({
    main_photo: '',
    secondary_photo: '',
    tertiary_photo: '',
  });

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const supabase = createClient();
        
        // First, get the creator's profile ID
        const { data: creatorData, error: creatorError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .single();

        if (creatorError) throw creatorError;

        // Convert URL slug back to product name format
        const decodedProductName = decodeURIComponent(productName).replace(/-/g, ' ');
        
        // Fetch the product by name and creator
        const { data, error } = await supabase
          .from('creator_products')
          .select(`
            *,
            creator:profiles(username, full_name)
          `)
          .eq('creator_profile_id', creatorData.id)
          .ilike('product_name', decodedProductName)
          .single();

        if (error) throw error;
        const productData = data as Product;
        setProduct(productData);
        
        // Check if creator is demo
        const { data: creatorRecord } = await supabase
          .from('creators')
          .select('is_demo')
          .eq('profile_id', creatorData.id)
          .maybeSingle();
        
        setIsCreatorDemo(creatorRecord?.is_demo || false);
        
        // Initialize edit form with product data
        setEditFormData({
          product_name: productData.product_name,
          description: productData.description || '',
          price_cents: (productData.price_cents / 100).toString(),
          shipping_price_cents: productData.shipping_price_cents ? (productData.shipping_price_cents / 100).toString() : '',
          main_photo: null,
          secondary_photo: null,
          tertiary_photo: null,
        });
        
        setEditImageUrls({
          main_photo: productData.main_photo || '',
          secondary_photo: productData.secondary_photo || '',
          tertiary_photo: productData.tertiary_photo || '',
        });
      } catch (error) {
        console.error('Error fetching product:', error);
        toast.error('Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [username, productName]);

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    // Force cleanup of body styles
    setTimeout(() => {
      document.body.style.pointerEvents = '';
    }, 0);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    // Force cleanup of body styles
    setTimeout(() => {
      document.body.style.pointerEvents = '';
    }, 0);
  };

  // Monitor modal state changes and force cleanup
  useEffect(() => {
    if (!isEditModalOpen && !isDeleteModalOpen) {
      // Force cleanup when both modals are closed
      setTimeout(() => {
        document.body.style.pointerEvents = '';
      }, 100);
    }
  }, [isEditModalOpen, isDeleteModalOpen]);

  // Cleanup effect for modals
  useEffect(() => {
    return () => {
      // Ensure modals are closed when component unmounts
      setIsEditModalOpen(false);
      setIsDeleteModalOpen(false);
      // Force cleanup of body styles
      document.body.style.pointerEvents = '';
    };
  }, []);

  // Global cleanup effect
  useEffect(() => {
    const cleanupPointerEvents = () => {
      if (document.body.style.pointerEvents === 'none') {
        document.body.style.pointerEvents = '';
      }
    };

    // Check periodically for pointer-events issues
    const interval = setInterval(cleanupPointerEvents, 1000);

    // Also check on mouse events
    const handleMouseEvent = () => {
      cleanupPointerEvents();
    };

    document.addEventListener('mousedown', handleMouseEvent);
    document.addEventListener('click', handleMouseEvent);

    return () => {
      clearInterval(interval);
      document.removeEventListener('mousedown', handleMouseEvent);
      document.removeEventListener('click', handleMouseEvent);
    };
  }, []);

  const formatBuyerPrice = (cents: number) =>
    formatUsdWithCreditsSuffix(cents, creditOnlyEcosystem, pricePerCreditCents);

  const handleImageUpload = async (file: File, type: 'main_photo' | 'secondary_photo' | 'tertiary_photo') => {
    if (!file || !product) return;

    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${product.creator_profile_id}/${type}_${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      setEditImageUrls(prev => ({ ...prev, [type]: publicUrl }));
      setEditFormData(prev => ({ ...prev, [type]: file }));
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    }
  };

  const handleEditProduct = async () => {
    if (!editFormData.product_name || !editFormData.price_cents || !product) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsUpdating(true);
    try {
      const supabase = createClient();
      
      // Upload new images if any
      const imageUrls = { ...editImageUrls };
      
      if (editFormData.main_photo) {
        const fileExt = editFormData.main_photo.name.split('.').pop();
        const fileName = `${product.creator_profile_id}/main_${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(fileName, editFormData.main_photo);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        imageUrls.main_photo = publicUrl;
      }

      if (editFormData.secondary_photo) {
        const fileExt = editFormData.secondary_photo.name.split('.').pop();
        const fileName = `${product.creator_profile_id}/secondary_${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(fileName, editFormData.secondary_photo);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        imageUrls.secondary_photo = publicUrl;
      }

      if (editFormData.tertiary_photo) {
        const fileExt = editFormData.tertiary_photo.name.split('.').pop();
        const fileName = `${product.creator_profile_id}/tertiary_${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(fileName, editFormData.tertiary_photo);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        imageUrls.tertiary_photo = publicUrl;
      }

      // Update product record
      const { data, error } = await supabase
        .from('creator_products')
        .update({
          product_name: editFormData.product_name,
          description: editFormData.description || null,
          price_cents: Math.round(parseFloat(editFormData.price_cents) * 100),
          shipping_price_cents: editFormData.shipping_price_cents ? Math.round(parseFloat(editFormData.shipping_price_cents) * 100) : null,
          main_photo: imageUrls.main_photo || null,
          secondary_photo: imageUrls.secondary_photo || null,
          tertiary_photo: imageUrls.tertiary_photo || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id)
        .select(`
          *,
          creator:profiles(username, full_name)
        `)
        .single();

      if (error) throw error;

      setProduct(data as Product);
      toast.success('Product updated successfully!');
      setIsEditModalOpen(false);
      
      // If product name changed, redirect to new URL
      if (editFormData.product_name !== product.product_name) {
        const newSlug = editFormData.product_name.toLowerCase().replace(/\s+/g, '-');
        router.push(`/u/${username}/${encodeURIComponent(newSlug)}`);
      }
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Failed to update product');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!product) return;

    setIsDeleting(true);
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from('creator_products')
        .update({ is_active: false })
        .eq('id', product.id);

      if (error) throw error;

      toast.success('Product deleted successfully!');
      setIsDeleteModalOpen(false);
      router.push(`/u/${username}`);
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const marginLeftClass = '';

  let mainContent;
  if (loading || isLoading) {
    mainContent = (
      <RequireAuth allowAnonymous>
        <main className="min-h-screen bg-background relative">
          <div className="animate-pulse p-6">
            <div className="h-8 w-32 bg-muted rounded mb-6" />
            <div className="aspect-square w-full max-w-2xl mx-auto bg-muted rounded-lg mb-6" />
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="h-8 w-3/4 bg-muted rounded" />
              <div className="h-6 w-1/4 bg-muted rounded" />
              <div className="h-24 w-full bg-muted rounded" />
            </div>
          </div>
        </main>
      </RequireAuth>
    );
  } else if (!product) {
    mainContent = (
      <RequireAuth allowAnonymous>
        <main className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Product not found</h1>
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={20} className="mr-2" />
              Go back
            </Button>
          </div>
        </main>
      </RequireAuth>
    );
  } else {
    mainContent = (
      <RequireAuth allowAnonymous>
        <main className="min-h-screen bg-background relative">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push(`/u/${username}`)}
                  className="mr-4"
                >
                  <ArrowLeft size={20} />
                </Button>
                <h1 className="text-md font-semibold truncate">
                  {username} <span className="mx-2">&gt;</span> {product?.product_name}
                </h1>
              </div>
              
              {/* Dropdown menu for product owner */}
              {session && currentUserProfile && product && currentUserProfile.id === product.creator_profile_id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical size={20} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
                      Edit Product
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setIsDeleteModalOpen(true)}
                      className="text-red-600 focus:text-red-600"
                    >
                      Delete Product
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Product Content */}
            <div className="w-full p-4">
              <div className="flex flex-col lg:flex-row gap-2 lg:gap-5">
                {/* Left Column - Images */}
                <div className="flex-1">
                  {/* Main Image */}
                  <div className="aspect-square relative bg-muted rounded-lg overflow-hidden mb-4 w-full">
                    {product.main_photo ? (
                      <Image
                        src={product.main_photo}
                        alt={product.product_name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Package size={64} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Secondary Images */}
                  {(product.secondary_photo || product.tertiary_photo) && (
                    <div className="grid grid-cols-2 gap-4 mb-6 w-full">
                      {product.secondary_photo && (
                        <div className="aspect-square relative bg-muted rounded-lg overflow-hidden">
                          <Image
                            src={product.secondary_photo}
                            alt={`${product.product_name} - secondary view`}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      {product.tertiary_photo && (
                        <div className="aspect-square relative bg-muted rounded-lg overflow-hidden">
                          <Image
                            src={product.tertiary_photo}
                            alt={`${product.product_name} - tertiary view`}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Column - Product Info */}
                <div className="flex-1 space-y-4">
                  <h1 className="text-md font-bold">{product.product_name}</h1>
                  <div className="mt-4 flex items-baseline gap-4">
                    <span className="text-md font-bold">
                      {formatBuyerPrice(product.price_cents)}
                    </span>
                    {product.shipping_price_cents && product.shipping_price_cents > 0 && (
                      <span className="text-sm font-medium text-muted-foreground">
                        +{formatBuyerPrice(product.shipping_price_cents)} shipping
                      </span>
                    )}
                  </div>
                  {product.description && (
                    <p className="mt-3 text-sm font-normal leading-relaxed text-muted-foreground whitespace-pre-wrap">
                      {product.description}
                    </p>
                  )}
                  
                  {/* Buy Button */}
                  <Button 
                    className={cn(
                      'mt-6 w-full bg-pink-500 font-bold text-white hover:bg-pink-600',
                      pulseEnabled && 'pulse-money-btn'
                    )}
                    onClick={() => setIsBuyModalOpen(true)}
                  >
                    Buy Now
                  </Button>
                  
                  {/* Buy Product Modal */}
                  {product && (
                    <BuyProductModal 
                      isOpen={isBuyModalOpen}
                      onClose={() => setIsBuyModalOpen(false)}
                      product={product}
                      isDemo={isCreatorDemo}
                      onPurchaseSuccess={(transactionId) => {
                        toast.success('Product purchased successfully!');
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
        </main>
      </RequireAuth>
    );
  }

  return (
    <>
      {mainContent}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => {
        setIsEditModalOpen(open);
        if (!open) {
          setTimeout(() => {
            document.body.style.pointerEvents = '';
          }, 50);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
            <div className="space-y-2">
            <Label htmlFor="edit_product_name">Product Name *</Label>
            <Input
                id="edit_product_name"
                value={editFormData.product_name}
                onChange={(e) => setEditFormData(prev => ({ ...prev, product_name: e.target.value }))}
                placeholder="Enter product name"
            />
            </div>
            
            <div className="space-y-2">
            <Label htmlFor="edit_description">Description</Label>
            <Textarea
                id="edit_description"
                value={editFormData.description}
                onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter product description"
                rows={3}
            />
            </div>

            <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="edit_price">Price (USD) *</Label>
                <Input
                id="edit_price"
                type="number"
                step="0.01"
                min="0"
                value={editFormData.price_cents}
                onChange={(e) => setEditFormData(prev => ({ ...prev, price_cents: e.target.value }))}
                placeholder="0.00"
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="edit_shipping_price">Shipping Price (USD)</Label>
                <Input
                id="edit_shipping_price"
                type="number"
                step="0.01"
                min="0"
                value={editFormData.shipping_price_cents}
                onChange={(e) => setEditFormData(prev => ({ ...prev, shipping_price_cents: e.target.value }))}
                placeholder="0.00"
                />
            </div>
            </div>

            {/* Image Upload Section */}
            <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Main Photo Card */}
                <div className="space-y-3">
                <div className="text-center">
                    <Label htmlFor="edit_main_photo" className="text-sm font-medium">
                    Main Photo *
                    </Label>
                </div>
                <div 
                    className="aspect-square bg-muted rounded-md flex items-center justify-center relative overflow-hidden cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => document.getElementById('edit_main_photo')?.click()}
                >
                    {editImageUrls.main_photo ? (
                    <Image
                        src={editImageUrls.main_photo}
                        alt="Main photo preview"
                        fill
                        className="object-cover"
                    />
                    ) : (
                    <Upload size={24} className="text-muted-foreground" />
                    )}
                </div>
                <Input
                    id="edit_main_photo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'main_photo');
                    }}
                />
                </div>

                {/* Secondary Photo Card */}
                <div className="space-y-3">
                <div className="text-center">
                    <Label htmlFor="edit_secondary_photo" className="text-sm font-medium">
                    Secondary Photo
                    </Label>
                </div>
                <div 
                    className="aspect-square bg-muted rounded-md flex items-center justify-center relative overflow-hidden cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => document.getElementById('edit_secondary_photo')?.click()}
                >
                    {editImageUrls.secondary_photo ? (
                    <Image
                        src={editImageUrls.secondary_photo}
                        alt="Secondary photo preview"
                        fill
                        className="object-cover"
                    />
                    ) : (
                    <Upload size={24} className="text-muted-foreground" />
                    )}
                </div>
                <Input
                    id="edit_secondary_photo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'secondary_photo');
                    }}
                />
                </div>

                {/* Tertiary Photo Card */}
                <div className="space-y-3">
                <div className="text-center">
                    <Label htmlFor="edit_tertiary_photo" className="text-sm font-medium">
                    Tertiary Photo
                    </Label>
                </div>
                <div 
                    className="aspect-square bg-muted rounded-md flex items-center justify-center relative overflow-hidden cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => document.getElementById('edit_tertiary_photo')?.click()}
                >
                    {editImageUrls.tertiary_photo ? (
                    <Image
                        src={editImageUrls.tertiary_photo}
                        alt="Tertiary photo preview"
                        fill
                        className="object-cover"
                    />
                    ) : (
                    <Upload size={24} className="text-muted-foreground" />
                    )}
                </div>
                <Input
                    id="edit_tertiary_photo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'tertiary_photo');
                    }}
                />
                </div>
            </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
            <Button
                variant="outline"
                onClick={handleCloseEditModal}
                disabled={isUpdating}
            >
                Cancel
            </Button>
            <Button
                onClick={handleEditProduct}
                disabled={isUpdating}
                className="bg-pink-500 hover:bg-pink-600 text-white"
            >
                {isUpdating ? 'Updating...' : 'Update Product'}
            </Button>
            </div>
        </div>
        </DialogContent>
    </Dialog>

    <Dialog open={isDeleteModalOpen} onOpenChange={(open) => {
        setIsDeleteModalOpen(open);
        if (!open) {
          setTimeout(() => {
            document.body.style.pointerEvents = '';
          }, 50);
        }
      }}>
        <DialogContent className="max-w-md">
        <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this product? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
            <Button
                variant="outline"
                onClick={handleCloseDeleteModal}
                disabled={isDeleting}
            >
                Cancel
            </Button>
            <Button
                onClick={handleDeleteProduct}
                disabled={isDeleting}
                variant="destructive"
            >
                {isDeleting ? 'Deleting...' : 'Delete Product'}
            </Button>
            </div>
        </div>
        </DialogContent>
    </Dialog>
    </>
  );
}