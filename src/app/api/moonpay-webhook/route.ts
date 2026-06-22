import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { createPPVPurchaseNotification, createTipNotification, createProductPurchaseNotification, createNewSubscriptionNotification } from '@/app/actions/notificationActions';
import { fetchAgencyAttributionForCreator } from '@/lib/payments/agency-split';

// Initialize Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

// Verify webhook signature
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Handle signature formats like "sha256=<hash>" or just the hash
    const cleanSignature = signature.includes('=') 
      ? signature.split('=')[1] 
      : signature;
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    // Compare signatures using timing-safe comparison
    const signatureBuffer = Buffer.from(cleanSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    if (signatureBuffer.length !== expectedBuffer.length) {
      console.error('Signature length mismatch');
      return false;
    }
    
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    
    // Log all headers for debugging
    const headers: { [key: string]: string } = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    // Check if secret is configured
    const webhookSecret = process.env.MOONPAY_WEBHOOK_SECRET;
    
    // MoonPay/Helio uses x-signature header for HMAC verification
    // They also use Bearer token in Authorization header
    const signature = request.headers.get('x-signature');
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    
    // Verify using x-signature HMAC if available
    if (webhookSecret && signature) {
      const isValid = verifyWebhookSignature(body, signature, webhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    } 
    // Also verify Bearer token matches secret (MoonPay/Helio may use this)
    else if (webhookSecret && bearerToken && bearerToken === webhookSecret) {
    }
    else {
      if (!webhookSecret) {
        console.warn('⚠️ Webhook verification skipped - MOONPAY_WEBHOOK_SECRET not configured');
      } else if (!signature && !bearerToken) {
        console.warn('⚠️ Webhook verification skipped - no signature or bearer token provided');
      } else if (bearerToken && bearerToken !== webhookSecret) {
        console.error('Invalid Bearer token');
        return NextResponse.json(
          { error: 'Invalid authorization' },
          { status: 401 }
        );
      }
    }

    const event = JSON.parse(body);

    // Handle CREATED event (when payment is successful)
    if (event.event === 'CREATED' && event.transactionObject) {
      const { transactionObject } = event;
      const { meta } = transactionObject;
      
      // Check if transaction was successful
      if (meta?.transactionStatus !== 'SUCCESS') {
        return NextResponse.json({ success: true, message: 'Transaction not successful yet' });
      }
      
      // Parse the additionalJSON string to get our metadata
      let additionalData;
      try {
        additionalData = JSON.parse(meta.customerDetails?.additionalJSON || '{}');
      } catch (parseError) {
        console.error('Error parsing additionalJSON:', parseError);
        return NextResponse.json(
          { error: 'Invalid metadata format' },
          { status: 400 }
        );
      }

      const { userId, credits, transactionId, postId, messageId, creatorId, productId, orderId, paymentId, subscriptionId, isCrypto, transactionType } = additionalData;

      if (!userId) {
        console.error('Missing userId in webhook:', additionalData);
        return NextResponse.json(
          { error: 'Missing userId' },
          { status: 400 }
        );
      }

      const providerDetails = {
        transactionSignature: meta.transactionSignature,
        currency: meta.currency?.symbol,
        amount: meta.totalAmount,
        blockchain: meta.currency?.blockchain?.name,
        senderPK: meta.senderPK,
        recipientPK: meta.recipientPK,
        tokenQuote: meta.tokenQuote,
      };

      // Determine transaction type by checking which table has the transaction
      // This prevents misclassifying tips as PPVs (since tips can also have postId)
      let actualTransactionType: 'credit' | 'tip' | 'ppv' | 'product' | 'subscription' | null = null;
      if (transactionId) {
        // Check each table to find where the transaction exists
        const [creditCheck, tipCheck, ppvCheck, productCheck] = await Promise.all([
          supabase.from('credit_transactions').select('id').eq('id', transactionId).single(),
          supabase.from('tip_transactions').select('id').eq('id', transactionId).single(),
          supabase.from('ppv_transactions').select('id').eq('id', transactionId).single(),
          supabase.from('creator_product_transactions').select('id').eq('id', transactionId).single(),
        ]);
        
        // Log each check result for debugging
        
        if (!creditCheck.error && creditCheck.data) {
          actualTransactionType = 'credit';
        } else if (!tipCheck.error && tipCheck.data) {
          actualTransactionType = 'tip';
        } else if (!ppvCheck.error && ppvCheck.data) {
          actualTransactionType = 'ppv';
        } else if (!productCheck.error && productCheck.data) {
          actualTransactionType = 'product';
        }
        
      }

      // Handle credit transactions (check by transaction type first, then by credits field)
      if (actualTransactionType === 'credit' || (credits && transactionId && actualTransactionType === null)) {

        const { error: updateError } = await supabase
          .from('credit_transactions')
          .update({
            status: 'succeeded',
            provider_transaction_reference: transactionObject.id,
            provider_specific_details: providerDetails,
            updated_at: new Date().toISOString(),
          })
          .eq('id', transactionId);

        if (updateError) {
          console.error('Error updating credit transaction:', updateError);
          return NextResponse.json(
            { error: 'Failed to update transaction' },
            { status: 500 }
          );
        }

        // Get current credits and update
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('credits')
          .eq('id', userId)
          .single();

        if (fetchError) {
          console.error('Error fetching current credits:', fetchError);
          return NextResponse.json(
            { error: 'Failed to fetch user profile' },
            { status: 500 }
          );
        }

        const { error: creditsError } = await supabase
          .from('profiles')
          .update({ credits: (profile?.credits || 0) + parseInt(credits) })
          .eq('id', userId);

        if (creditsError) {
          console.error('Error updating user credits:', creditsError);
          return NextResponse.json(
            { error: 'Failed to update credits' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      }

      // Handle PPV transactions (only if it's actually a PPV, not a tip)
      if (transactionId && (postId || messageId) && actualTransactionType === 'ppv') {

        // Get the transaction to calculate shares
        const { data: transaction, error: transactionError } = await supabase
          .from('ppv_transactions')
          .select('amount_cents, post_id, message_id')
          .eq('id', transactionId)
          .single();

        if (transactionError || !transaction) {
          console.error('PPV transaction not found:', transactionError);
          return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        // Calculate shares (90% creator, 10% platform)
        const creatorShareCents = Math.floor(transaction.amount_cents * 0.9);
        const platformShareCents = transaction.amount_cents - creatorShareCents;

        // Resolve creator id for agency attribution
        let ppvCreatorId: string | null = null;
        if (transaction.message_id) {
          const { data: msg } = await supabase
            .from('messages')
            .select('sender_id')
            .eq('id', transaction.message_id)
            .single();
          ppvCreatorId = msg?.sender_id || null;
        } else if (transaction.post_id) {
          const { data: post } = await supabase
            .from('posts')
            .select('user_id')
            .eq('id', transaction.post_id)
            .single();
          ppvCreatorId = post?.user_id || null;
        }
        const { agencyShare: ppvAgencyShare, agencyProfileId: ppvAgencyId } =
          await fetchAgencyAttributionForCreator(ppvCreatorId, creatorShareCents);

        const { error: updateError } = await supabase
          .from('ppv_transactions')
          .update({
            status: 'succeeded',
            provider_transaction_reference: transactionObject.id,
            provider_specific_details: providerDetails,
            creator_share_cents: creatorShareCents,
            platform_share_cents: platformShareCents,
            agency_share_cents: ppvAgencyShare > 0 ? ppvAgencyShare : null,
            agency_profile_id: ppvAgencyId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', transactionId);

        if (updateError) {
          console.error('Error updating PPV transaction:', updateError);
          return NextResponse.json(
            { error: 'Failed to update transaction' },
            { status: 500 }
          );
        }

        // Update message with PPV_transaction_id if it's a message transaction
        if (messageId) {
          await supabase
            .from('messages')
            .update({ PPV_transaction_id: transactionId })
            .eq('id', messageId);
        }

        // Create PPV purchase notification (only for post PPVs, not messages)
        if (postId) {
          try {
            // Get the buyer's profile information
            const { data: buyerProfile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', userId)
              .single();

            // Get the post to find the creator
            const { data: post } = await supabase
              .from('posts')
              .select('user_id')
              .eq('id', postId)
              .single();

            if (buyerProfile?.username && post?.user_id) {
              await createPPVPurchaseNotification({
                creatorId: post.user_id,
                buyerId: userId,
                buyerUsername: buyerProfile.username,
                postId: postId,
                amount: transaction.amount_cents / 100 // Convert cents to dollars
              });
            }
          } catch (notificationError) {
            console.error('Failed to create PPV purchase notification:', notificationError);
            // Don't fail the transaction if notification fails
          }
        }

        return NextResponse.json({ success: true });
      }

      // Handle tip transactions (check actualTransactionType to avoid misclassifying as PPV)
      if (transactionId && creatorId && actualTransactionType === 'tip') {

        // Get the transaction to calculate shares
        const { data: transaction, error: transactionError } = await supabase
          .from('tip_transactions')
          .select('amount_cents, post_id')
          .eq('id', transactionId)
          .single();

        if (transactionError || !transaction) {
          console.error('Tip transaction not found:', transactionError);
          return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        // Calculate shares (90% creator, 10% platform)
        const creatorShareCents = Math.floor(transaction.amount_cents * 0.9);
        const platformShareCents = transaction.amount_cents - creatorShareCents;

        const { agencyShare: tipAgencyShare, agencyProfileId: tipAgencyId } =
          await fetchAgencyAttributionForCreator(creatorId, creatorShareCents);

        const { error: updateError } = await supabase
          .from('tip_transactions')
          .update({
            status: 'succeeded',
            provider_transaction_reference: transactionObject.id,
            provider_specific_details: providerDetails,
            creator_share_cents: creatorShareCents,
            platform_share_cents: platformShareCents,
            agency_share_cents: tipAgencyShare > 0 ? tipAgencyShare : null,
            agency_profile_id: tipAgencyId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', transactionId);

        if (updateError) {
          console.error('Error updating tip transaction:', updateError);
          return NextResponse.json(
            { error: 'Failed to update transaction' },
            { status: 500 }
          );
        }

        // Create tip notification
        try {
          // Get the tipper's profile information
          const { data: tipperProfile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', userId)
            .single();

          if (tipperProfile?.username) {
            await createTipNotification({
              creatorId: creatorId,
              tipperId: userId,
              tipperUsername: tipperProfile.username,
              amount: transaction.amount_cents / 100, // Convert cents to dollars
              postId: transaction.post_id || undefined
            });
          }
        } catch (notificationError) {
          console.error('Failed to create tip notification:', notificationError);
          // Don't fail the transaction if notification fails
        }

        return NextResponse.json({ success: true });
      }

      // Handle product transactions (verify it's actually a product transaction)
      if (transactionId && productId && actualTransactionType === 'product') {

        // Get the transaction and product to calculate shares
        const { data: transaction, error: transactionError } = await supabase
          .from('creator_product_transactions')
          .select('amount_cents, creator_product_id, shipping_address')
          .eq('id', transactionId)
          .single();

        if (transactionError || !transaction) {
          console.error('Product transaction not found:', transactionError);
          return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        // Get product details for notification
        const { data: product, error: productError } = await supabase
          .from('creator_products')
          .select('product_name, creator_profile_id')
          .eq('id', transaction.creator_product_id)
          .single();

        if (productError || !product) {
          console.error('Product not found:', productError);
          return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // Calculate shares (using store split calculation - typically 90/10)
        const creatorShareCents = Math.floor(transaction.amount_cents * 0.9);
        const platformShareCents = transaction.amount_cents - creatorShareCents;

        const { agencyShare: prodAgencyShare, agencyProfileId: prodAgencyId } =
          await fetchAgencyAttributionForCreator(product.creator_profile_id, creatorShareCents);

        const { error: updateError } = await supabase
          .from('creator_product_transactions')
          .update({
            status: 'succeeded',
            provider_transaction_reference: transactionObject.id,
            provider_specific_details: providerDetails,
            creator_share_cents: creatorShareCents,
            platform_share_cents: platformShareCents,
            agency_share_cents: prodAgencyShare > 0 ? prodAgencyShare : null,
            agency_profile_id: prodAgencyId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', transactionId);

        if (updateError) {
          console.error('Error updating product transaction:', updateError);
          return NextResponse.json(
            { error: 'Failed to update transaction' },
            { status: 500 }
          );
        }

        // Check if order exists, create if it doesn't
        const { data: existingOrder } = await supabase
          .from('creator_product_orders')
          .select('id')
          .eq('creator_product_transaction_id', transactionId)
          .maybeSingle();

        if (existingOrder) {
          // Update existing order status
          await supabase
            .from('creator_product_orders')
            .update({ order_status: 'paid' })
            .eq('id', existingOrder.id);
        } else {
          // Create order if it doesn't exist
          const { error: orderCreateError } = await supabase
            .from('creator_product_orders')
            .insert({
              creator_product_id: transaction.creator_product_id,
              user_id: userId,
              creator_product_transaction_id: transactionId,
              quantity: 1,
              order_status: 'paid',
              shipping_address: transaction.shipping_address,
            });

          if (orderCreateError) {
            console.error('Error creating product order:', orderCreateError);
            // Don't fail the transaction if order creation fails, but log it
          }
        }

        // Create product purchase notification
        try {
          // Get buyer's username for notification
          const { data: buyerProfile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', userId)
            .single();

          if (buyerProfile?.username) {
            await createProductPurchaseNotification({
              creatorId: product.creator_profile_id,
              buyerId: userId,
              buyerUsername: buyerProfile.username,
              productName: product.product_name,
              amount: transaction.amount_cents / 100 // Convert cents to dollars
            });
          }
        } catch (notificationError) {
          console.error('Error creating product purchase notification:', notificationError);
          // Don't fail the transaction if notification fails
        }

        return NextResponse.json({ success: true });
      }

      // Handle subscription payments
      if (paymentId) {

        // Get the payment record
        const { data: payment, error: paymentError } = await supabase
          .from('subscription_payments')
          .select('*')
          .eq('id', paymentId)
          .single();

        if (paymentError || !payment) {
          console.error('Error fetching subscription payment:', paymentError);
          return NextResponse.json(
            { error: 'Payment record not found' },
            { status: 404 }
          );
        }

        // Update payment status
        const { error: updateError } = await supabase
          .from('subscription_payments')
          .update({
            status: 'succeeded',
            provider_payment_reference: transactionObject.id,
            provider_specific_details: providerDetails,
          })
          .eq('id', paymentId);

        if (updateError) {
          console.error('Error updating subscription payment:', updateError);
          return NextResponse.json(
            { error: 'Failed to update payment' },
            { status: 500 }
          );
        }

        // Handle subscription creation/update
        // For crypto subscriptions, period_ends_at is already set to 30 days in the payment record
        let subscription;
        if (subscriptionId) {
          // Update existing subscription
          const { data: updatedSubscription, error: subUpdateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              current_period_ends_at: payment.period_ends_at, // Use 30 days for crypto, or normal interval for Stripe
              payment_provider: 'moonpay',
              canceled_at: null,
            })
            .eq('id', subscriptionId)
            .select()
            .single();

          if (subUpdateError) {
            console.error('Error updating subscription:', subUpdateError);
          } else {
            subscription = updatedSubscription;
          }
        } else {
          // Create new subscription (for crypto, expires in 30 days)
          const { data: newSubscription, error: subCreateError } = await supabase
            .from('subscriptions')
            .insert({
              follower_id: userId,
              following_id: payment.creator_profile_id,
              status: 'active',
              current_period_ends_at: payment.period_ends_at, // 30 days for crypto
              provider_subscription_id: `moonpay_${paymentId}`,
              price_at_time_of_subscription_cents: payment.amount_cents,
              interval_at_time_of_subscription: 'month', // Default, but expiration is 30 days
              payment_provider: 'moonpay',
            })
            .select()
            .single();

          if (subCreateError) {
            console.error('Error creating subscription:', subCreateError);
          } else {
            subscription = newSubscription;
            // Update payment with subscription_id
            await supabase
              .from('subscription_payments')
              .update({ subscription_id: subscription.id })
              .eq('id', paymentId);

            // Create subscription notification for new subscriptions
            try {
              // Get the subscriber's profile information
              const { data: subscriberProfile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', userId)
                .single();

              if (subscriberProfile?.username) {
                await createNewSubscriptionNotification({
                  creatorId: payment.creator_profile_id,
                  subscriberId: userId,
                  subscriberUsername: subscriberProfile.username
                });
              }
            } catch (notificationError) {
              console.error('Failed to create subscription notification:', notificationError);
              // Don't fail the subscription if notification fails
            }
          }
        }

        return NextResponse.json({ success: true });
      }

      // If we couldn't determine the transaction type, log and return error
      if (transactionId && actualTransactionType === null) {
        console.error('Unknown transaction type - transaction not found in any table:', {
          transactionId,
          additionalData
        });
        return NextResponse.json(
          { error: 'Transaction not found in database' },
          { status: 404 }
        );
      }

      console.error('Unknown transaction type in webhook:', additionalData);
      return NextResponse.json(
        { error: 'Unknown transaction type' },
        { status: 400 }
      );
    }

    // Handle other event types if needed
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing MoonPay webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

