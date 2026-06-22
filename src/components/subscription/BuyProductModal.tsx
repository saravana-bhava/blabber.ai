'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CreditCard, Loader2, Shield, Wallet } from 'lucide-react';
import { useUser } from '@/lib/contexts/user-context';
import { useCreditsModal } from '@/lib/contexts/credits-modal-context';
import { useCreditMonetization } from '@/lib/contexts/credit-monetization-context';
import { postCreditSpend } from '@/lib/credits/post-credit-spend';
import { formatUsdWithCreditsSuffix } from '@/lib/credits/monetization-display';
import { OnyxCardForm } from '@/components/subscription/OnyxCardForm';
import { StripePaymentInline } from '@/components/payments/StripePaymentInline';
import { createClient } from '@/lib/supabase/client';

interface Product {
  id: string;
  product_name: string;
  price_cents: number;
  shipping_price_cents: number | null;
  creator_profile_id: string;
}

interface BuyProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  isDemo?: boolean;
  onPaymentSuccess?: () => void;
  onPurchaseSuccess?: (transactionId: string) => void;
}

export function BuyProductModal({ isOpen, onClose, product, isDemo, onPaymentSuccess, onPurchaseSuccess }: BuyProductModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);
  const [showOnyxCardForm, setShowOnyxCardForm] = useState(false);
  // Reusing OnyxCardForm UI for GOAT — toggle decides which backend route to hit on submit.
  const [cardFormProcessor, setCardFormProcessor] = useState<'onyx' | 'goat'>('onyx');
  const [showStripePayment, setShowStripePayment] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [profileBilling, setProfileBilling] = useState<{ first_name: string; last_name: string; email: string } | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<Array<{ id: string; last4: string; brand: string | null; is_default: boolean; onyx_payment_method_id: string }>>([]);
  const [shippingAddress, setShippingAddress] = useState({
    name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
  });
  const supabase = createClient();
  const { profile, refreshProfile } = useUser();
  const { setIsBuyCreditsModalOpen } = useCreditsModal();
  const { creditOnlyEcosystem, pricePerCreditCents, fiatPaymentProcessor, loaded: creditMetaLoaded } =
    useCreditMonetization();

  const handleAdminTestProduct = async () => {
    const totalAmountCents = product.price_cents + (product.shipping_price_cents || 0);
    const response = await fetch('/api/stripe/create-product-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        amountCents: totalAmountCents,
        shippingAddress,
        adminTestBypass: true,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Admin test purchase failed');
    }

    const data = await response.json();
    toast.success('Admin test purchase recorded (no charge)');
    onPurchaseSuccess?.(data.transactionId);
    onPaymentSuccess?.();
    handleClose();
  };

  const handleDemoProduct = async () => {
    const totalAmountCents = product.price_cents + (product.shipping_price_cents || 0);
    
    // Create demo product transaction and order records directly
    const response = await fetch('/api/stripe/create-product-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: product.id,
        paymentIntentId: `demo_product_${Date.now()}`,
        amountCents: totalAmountCents,
        shippingAddress,
        isDemo: true,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create demo product transaction');
    }

    const data = await response.json();
    toast.success('Demo product purchased successfully!');
    onPurchaseSuccess?.(data.transactionId);
    onPaymentSuccess?.();
    handleClose();
  };

  const handleOpen = async () => {
    // Validate shipping address (required even for demo)
    if (!shippingAddress.name || !shippingAddress.address_line1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postal_code) {
      toast.error('Please fill in all required shipping address fields');
      return;
    }

    if (isDemo) {
      // Demo mode: bypass Stripe and directly create product transaction
      try {
        setIsLoading(true);
        await handleDemoProduct();
      } catch (error) {
        console.error('Error creating demo product transaction:', error);
        toast.error('Failed to process demo purchase.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!creditMetaLoaded) {
      return;
    }

    if (creditOnlyEcosystem) {
      setIsLoading(true);
      try {
        const result = await postCreditSpend({
          kind: 'product',
          productId: product.id,
          amountCents: totalAmountCents,
          shippingAddress,
        });
        if (!result.ok) {
          if (result.insufficientCredits) {
            toast.error('Insufficient credits');
            setIsBuyCreditsModalOpen(true);
          } else {
            toast.error(result.error);
          }
          return;
        }
        toast.success('Purchase successful');
        await refreshProfile();
        onPaymentSuccess?.();
        handleClose();
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setShowPaymentSelection(true);
  };

  const totalAmountCents = product.price_cents + (product.shipping_price_cents || 0);

  const handleOnyxCardPay = async (card: { number: string; exp_month: string; exp_year: string; cvc: string }, billing?: { first_name: string; last_name: string; email: string }, saveCard?: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('You must be logged in to purchase');
      return;
    }
    setIsLoading(true);
    try {
      const returnUrl = window.location.href;
      const endpoint =
        cardFormProcessor === 'goat'
          ? '/api/goat/process-payment'
          : '/api/onyx/process-payment';
      const payload: Record<string, unknown> = {
        transactionType: 'product',
        amountCents: totalAmountCents,
        metadata: {
          userId: session.user.id,
          transactionType: 'product',
          productId: product.id,
          creatorId: product.creator_profile_id,
          amountCents: totalAmountCents,
          shippingAddress: JSON.stringify(shippingAddress),
        },
        card,
        billing,
        returnUrl,
      };
      if (cardFormProcessor === 'onyx') payload.save_card = !!saveCard;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Payment failed');
        setIsLoading(false);
        return;
      }
      if (data.status === 'redirect' && data.redirect_url) {
        window.location.href = data.redirect_url;
        return;
      }
      if (data.status === 'pending') {
        toast.info(data.message || 'Payment is processing. The creator will see your order as soon as it settles.');
        handleClose();
        return;
      }
      if (data.status === 'success') {
        toast.success('Purchase successful');
        onPurchaseSuccess?.(data.transaction_id);
        onPaymentSuccess?.();
        handleClose();
      }
    } catch (err) {
      toast.error('Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayWithCardClick = () => {
    setCardFormProcessor('onyx');
    setShowOnyxCardForm(true);
  };

  const handlePayWithGoatCardClick = () => {
    setCardFormProcessor('goat');
    setShowOnyxCardForm(true);
  };

  useEffect(() => {
    if (!showPaymentSelection || !isOpen) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: methods } = await supabase
        .from('user_payment_methods')
        .select('id, last4, brand, is_default, onyx_payment_method_id')
        .eq('user_id', session.user.id)
        .order('is_default', { ascending: false });
      setSavedPaymentMethods((methods as any) || []);
    })();
  }, [showPaymentSelection, isOpen]);

  const handlePayWithSavedCard = async (onyxPaymentMethodId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('You must be logged in to purchase');
      return;
    }
    setIsLoading(true);
    try {
      const returnUrl = window.location.href;
      const response = await fetch('/api/onyx/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionType: 'product',
          amountCents: totalAmountCents,
          metadata: {
            userId: session.user.id,
            transactionType: 'product',
            productId: product.id,
            creatorId: product.creator_profile_id,
            amountCents: totalAmountCents,
            shippingAddress: JSON.stringify(shippingAddress),
          },
          payment_method_id: onyxPaymentMethodId,
          returnUrl,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Payment failed');
        setIsLoading(false);
        return;
      }
      if (data.status === 'redirect' && data.redirect_url) {
        window.location.href = data.redirect_url;
        return;
      }
      if (data.status === 'success') {
        toast.success('Purchase successful');
        if (data.saved_card_error) toast.warning(data.saved_card_error);
        onPurchaseSuccess?.(data.transaction_id);
        onPaymentSuccess?.();
        handleClose();
      }
    } catch (err) {
      toast.error('Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!showOnyxCardForm || !isOpen) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single();
      const name = (profile?.full_name || '').trim().split(/\s+/);
      setProfileBilling({
        first_name: name[0] || '',
        last_name: name.slice(1).join(' ') || '',
        email: session.user.email || '',
      });
    })();
  }, [showOnyxCardForm, isOpen]);

  const handleMoonpayPayment = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to purchase a product');
        return;
      }

      const totalAmountCents = product.price_cents + (product.shipping_price_cents || 0);
      
      // Create checkout session (validates amount server-side)
      const response = await fetch('/api/moonpay/create-product-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: totalAmountCents,
          userId: session.user.id,
          productId: product.id,
          shippingAddress,
        }),
      });

      if (!response.ok) throw new Error('Failed to create checkout session');

      const data = await response.json();
      
      // Redirect with only type and transactionId (config will be fetched from Supabase)
      const params = new URLSearchParams({
        type: 'product',
        transactionId: data.transactionId,
      });

      window.location.href = `/crypto-payment?${params.toString()}`;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session';
      toast.error(errorMessage);
      
      // If transaction is still pending, close the modal and redirect to transactions page
      if (errorMessage.includes('Transaction still pending')) {
        handleClose();
        window.location.href = '/transactions';
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEpochProduct = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to purchase');
        return;
      }
      const response = await fetch('/api/epoch/create-product-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          amountCents: totalAmountCents,
          shippingAddress,
          returnUrl: window.location.href,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to create payment link');
        return;
      }
      if (data.paymentUrl) window.location.href = data.paymentUrl;
    } catch (e) {
      console.error(e);
      toast.error('Failed to start checkout');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsPaymateProduct = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to purchase');
        return;
      }
      const response = await fetch('/api/uspaymate/create-product-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          amountCents: totalAmountCents,
          shippingAddress,
          returnUrl: window.location.href,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to create checkout session');
        return;
      }
      if (data.paymentUrl) window.location.href = data.paymentUrl;
    } catch (e) {
      console.error(e);
      toast.error('Failed to start checkout');
    } finally {
      setIsLoading(false);
    }
  };

  const startStripeProduct = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to purchase');
        return;
      }
      const response = await fetch('/api/stripe/create-product-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          amountCents: totalAmountCents,
          shippingAddress,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to start card payment');
        return;
      }
      if (data.clientSecret) {
        setStripeClientSecret(data.clientSecret);
        setShowStripePayment(true);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to start card payment');
    } finally {
      setIsLoading(false);
    }
  };

  const finalizeStripeProduct = async (paymentIntentId: string) => {
    const response = await fetch('/api/stripe/create-product-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        paymentIntentId,
        amountCents: totalAmountCents,
        shippingAddress,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      toast.error((err as { error?: string }).error || 'Failed to record purchase');
      return;
    }
    const data = await response.json();
    toast.success('Purchase successful');
    handleSuccess(data.transactionId);
  };

  const handleClose = () => {
    setShowPaymentSelection(false);
    setShowOnyxCardForm(false);
    setShowStripePayment(false);
    setStripeClientSecret(null);
    setShippingAddress({
      name: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
    });
    onClose();
  };

  const handleBackToSelection = () => {
    setShowPaymentSelection(false);
    setShowStripePayment(false);
    setStripeClientSecret(null);
  };

  const handleSuccess = (transactionId: string) => {
    onPurchaseSuccess?.(transactionId);
    onPaymentSuccess?.();
    handleClose();
  };

  const formatPrice = (cents: number) => {
    return formatUsdWithCreditsSuffix(cents, creditOnlyEcosystem, pricePerCreditCents);
  };

  // Lock page scroll when modal is open (fixes iOS keyboard layout shift issue)
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Lock body scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        // Restore scroll position when modal closes
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md !translate-x-[-50%] !translate-y-[-50%] !top-[50%] !left-[50%]">
        <DialogHeader>
          <DialogTitle>
            {showPaymentSelection ? 'Choose Payment Method' : `Purchase ${product.product_name}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Price Summary */}
          {!creditMetaLoaded ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
              <p className="text-sm">Loading price…</p>
            </div>
          ) : (
          <div className="bg-muted p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm">Product Price:</span>
              <span className="font-medium">{formatPrice(product.price_cents)}</span>
            </div>
            {product.shipping_price_cents && product.shipping_price_cents > 0 && (
              <div className="flex justify-between items-center mt-1">
                <span className="text-sm">Shipping:</span>
                <span className="font-medium">{formatPrice(product.shipping_price_cents)}</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-2 pt-2 border-t">
              <span className="font-semibold">Total:</span>
              <span className="font-bold">{formatPrice(totalAmountCents)}</span>
            </div>
          </div>
          )}

          {showStripePayment && stripeClientSecret ? (
            <StripePaymentInline
              clientSecret={stripeClientSecret}
              amountLabel={`Total: ${formatPrice(totalAmountCents)}`}
              onSuccess={finalizeStripeProduct}
              onCancel={() => {
                setShowStripePayment(false);
                setStripeClientSecret(null);
              }}
            />
          ) : showOnyxCardForm ? (
            <OnyxCardForm
              amountLabel={`Total: ${formatPrice(totalAmountCents)}`}
              billing={profileBilling}
              showSaveCard={cardFormProcessor === 'onyx'}
              onSubmit={handleOnyxCardPay}
              onCancel={() => setShowOnyxCardForm(false)}
              isLoading={isLoading}
            />
          ) : showPaymentSelection ? (
            <div className="space-y-4">
              {fiatPaymentProcessor === 'onyx' && (
                <>
                  {savedPaymentMethods.length > 0 && (
                    <div className="grid grid-cols-1 gap-2">
                      {savedPaymentMethods.map((pm) => (
                        <Button
                          key={pm.id}
                          variant="outline"
                          className="w-full h-auto py-4 px-4 flex items-center justify-between gap-2 border-green-600/50 hover:bg-green-600/10"
                          onClick={() => handlePayWithSavedCard(pm.onyx_payment_method_id)}
                          disabled={isLoading}
                        >
                          <CreditCard className="w-4 h-4" />
                          <span className="font-mono">•••• {pm.last4}</span>
                          <span className="text-xs capitalize text-muted-foreground">{pm.brand || 'Card'}</span>
                          {pm.is_default && <span className="text-xs bg-muted px-1.5 rounded">Default</span>}
                        </Button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      variant="outline"
                      className="w-full h-auto py-6 px-6 flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-600 text-white border-blue-500 hover:border-blue-600"
                      onClick={handlePayWithCardClick}
                      disabled={isLoading}
                    >
                      <CreditCard className="w-5 h-5" />
                      <div className="flex flex-col items-start">
                        <span className="text-lg font-semibold">{savedPaymentMethods.length > 0 ? 'Pay with new card' : 'Pay with Card'}</span>
                        <span className="text-xs opacity-90">Onyx — Credit or Debit Card</span>
                      </div>
                    </Button>
                  </div>
                </>
              )}
              {fiatPaymentProcessor === 'moonpay' && (
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    variant="outline"
                    className="w-full h-auto py-6 px-6 flex items-center justify-center gap-3 bg-purple-500 hover:bg-purple-600 text-white border-purple-500 hover:border-purple-600"
                    onClick={handleMoonpayPayment}
                    disabled={isLoading}
                  >
                    <Wallet className="w-5 h-5" />
                    <div className="flex flex-col items-start">
                      <span className="text-lg font-semibold">Pay with MoonPay</span>
                      <span className="text-xs opacity-90">USDC, ETH, SOL & more</span>
                    </div>
                  </Button>
                </div>
              )}
              {fiatPaymentProcessor === 'stripe' && (
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    variant="outline"
                    className="w-full h-auto py-6 px-6 flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-600 text-white border-blue-500 hover:border-blue-600"
                    onClick={startStripeProduct}
                    disabled={isLoading}
                  >
                    <CreditCard className="w-5 h-5" />
                    <div className="flex flex-col items-start">
                      <span className="text-lg font-semibold">Pay with Card</span>
                      <span className="text-xs opacity-90">Stripe</span>
                    </div>
                  </Button>
                </div>
              )}
              {fiatPaymentProcessor === 'epoch' && (
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    variant="outline"
                    className="w-full h-auto py-6 px-6 flex items-center justify-center gap-3 bg-slate-600 hover:bg-slate-700 text-white"
                    onClick={handleEpochProduct}
                    disabled={isLoading}
                  >
                    <CreditCard className="w-5 h-5" />
                    <div className="flex flex-col items-start">
                      <span className="text-lg font-semibold">Continue to checkout</span>
                      <span className="text-xs opacity-90">Epoch</span>
                    </div>
                  </Button>
                </div>
              )}
              {fiatPaymentProcessor === 'uspaymate' && (
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    variant="outline"
                    className="w-full h-auto py-6 px-6 flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={handleUsPaymateProduct}
                    disabled={isLoading}
                  >
                    <CreditCard className="w-5 h-5" />
                    <div className="flex flex-col items-start">
                      <span className="text-lg font-semibold">Continue to checkout</span>
                      <span className="text-xs opacity-90">USPaymate</span>
                    </div>
                  </Button>
                </div>
              )}
              {fiatPaymentProcessor === 'goat' && (
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    variant="outline"
                    className="w-full h-auto py-6 px-6 flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 hover:border-emerald-700"
                    onClick={handlePayWithGoatCardClick}
                    disabled={isLoading}
                  >
                    <CreditCard className="w-5 h-5" />
                    <div className="flex flex-col items-start">
                      <span className="text-lg font-semibold">Pay with Card</span>
                      <span className="text-xs opacity-90">GOAT Payments — Credit or Debit Card</span>
                    </div>
                  </Button>
                </div>
              )}
              {profile?.isAdmin && (
                <Button
                  variant="outline"
                  className="w-full h-auto py-6 px-6 flex items-center justify-center gap-3 border-amber-600/60 bg-amber-500/15 hover:bg-amber-500/25 text-amber-950 dark:text-amber-100"
                  onClick={async () => {
                    try {
                      setIsLoading(true);
                      await handleAdminTestProduct();
                    } catch (e) {
                      console.error(e);
                      toast.error(e instanceof Error ? e.message : 'Admin test purchase failed');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                >
                  <Shield className="w-5 h-5" />
                  <div className="flex flex-col items-start">
                    <span className="text-lg font-semibold">Admin test (no charge)</span>
                    <span className="text-xs opacity-90">Bypass payment for testing</span>
                  </div>
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={handleBackToSelection}
                className="w-full"
              >
                Back
              </Button>
            </div>
          ) : (
            <>
              {/* Shipping Address Form */}
              <div className="space-y-3">
                <h3 className="font-medium">Shipping Address</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={shippingAddress.name}
                    onChange={(e) => setShippingAddress(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_line1">Address Line 1 *</Label>
                  <Input
                    id="address_line1"
                    value={shippingAddress.address_line1}
                    onChange={(e) => setShippingAddress(prev => ({ ...prev, address_line1: e.target.value }))}
                    placeholder="Street address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_line2">Address Line 2</Label>
                  <Input
                    id="address_line2"
                    value={shippingAddress.address_line2}
                    onChange={(e) => setShippingAddress(prev => ({ ...prev, address_line2: e.target.value }))}
                    placeholder="Apartment, suite, etc. (optional)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      value={shippingAddress.state}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, state: e.target.value }))}
                      placeholder="State"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">ZIP Code *</Label>
                    <Input
                      id="postal_code"
                      value={shippingAddress.postal_code}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, postal_code: e.target.value }))}
                      placeholder="ZIP Code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={shippingAddress.country}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, country: e.target.value }))}
                      placeholder="Country"
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleOpen} className="w-full" disabled={isLoading || !creditMetaLoaded}>
                {isLoading ? 'Loading...' : !creditMetaLoaded ? 'Loading…' : 'Continue to Payment'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 