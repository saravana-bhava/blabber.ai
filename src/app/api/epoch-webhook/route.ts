import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyEpochPostback, parseEpochPostbackMetadata, EpochPaymentMetadata } from '@/lib/payments/epoch';
import { calculatePaymentSplits } from '@/lib/payments/calculate-splits';
import { calculatePaymentSplitsStore } from '@/lib/payments/calculate-splits-store';
import { createPPVPurchaseNotification, createTipNotification, createProductPurchaseNotification, createNewSubscriptionNotification } from '@/app/actions/notificationActions';

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

export async function POST(request: Request) {
  try {
    // Epoch sends postback data - could be form data or JSON
    const contentType = request.headers.get('content-type') || '';
    let postbackData: Record<string, any> = {};

    if (contentType.includes('application/json')) {
      const body = await request.json();
      postbackData = body;
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const body = await request.text();
      const params = new URLSearchParams(body);
      params.forEach((value, key) => {
        postbackData[key] = value;
      });
    } else {
      // Try to parse as form data
      const formData = await request.formData();
      formData.forEach((value, key) => {
        postbackData[key] = value.toString();
      });
    }

    // Verify postback signature using epoch_digest
    const epochDigest = postbackData.epoch_digest || postbackData.digest;
    if (epochDigest) {
      const isValid = verifyEpochPostback(postbackData, epochDigest);
      if (!isValid) {
        console.error('Invalid Epoch postback signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    } else {
      console.warn('⚠️ No epoch_digest found in postback - verification skipped');
    }

    // Check if payment was successful (ans parameter indicates success)
    const ans = postbackData.ans;
    if (ans !== 'Y' && ans !== 'y' && ans !== '1') {
      return NextResponse.json({ success: true, message: 'Payment not successful' });
    }

    // Parse metadata from postback
    const metadata = parseEpochPostbackMetadata(postbackData);
    if (!metadata) {
      console.error('Failed to parse metadata from postback');
      return NextResponse.json(
        { error: 'Invalid metadata' },
        { status: 400 }
      );
    }

    const { userId, transactionType, postId, messageId, creatorId, productId, amountCents } = metadata;

    if (!userId || !transactionType) {
      console.error('Missing required metadata:', metadata);
      return NextResponse.json(
        { error: 'Missing required metadata' },
        { status: 400 }
      );
    }

    // Extract Epoch transaction details
    const epochTransactionId = postbackData.transaction_id || postbackData.id || postbackData.transactionId;
    // Use amountCents from metadata if available, otherwise parse from postback
    const amount = metadata.amountCents ? metadata.amountCents / 100 : (postbackData.amount ? parseFloat(postbackData.amount) : 0);
    const currency = postbackData.currency || 'USD';

    const providerDetails = {
      transactionId: epochTransactionId,
      amount: amount,
      currency: currency,
      ans: ans,
      ...postbackData, // Include all postback data
    };

    // Handle different transaction types
    switch (transactionType) {
      case 'credit': {
        return await handleCreditTransaction(metadata, epochTransactionId, providerDetails, amountCents);
      }
      case 'tip': {
        return await handleTipTransaction(metadata, epochTransactionId, providerDetails);
      }
      case 'ppv': {
        return await handlePPVTransaction(metadata, epochTransactionId, providerDetails, postId, messageId);
      }
      case 'product': {
        return await handleProductTransaction(metadata, epochTransactionId, providerDetails, productId);
      }
      case 'subscription': {
        return await handleSubscriptionTransaction(metadata, epochTransactionId, providerDetails);
      }
      default: {
        console.error('Unknown transaction type:', transactionType);
        return NextResponse.json(
          { error: 'Unknown transaction type' },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error('Error processing Epoch webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleCreditTransaction(
  metadata: EpochPaymentMetadata,
  epochTransactionId: string,
  providerDetails: any,
  amountCents: number
) {
  const { userId, credits } = metadata;

  if (!credits) {
    return NextResponse.json(
      { error: 'Missing credits in metadata' },
      { status: 400 }
    );
  }

  // Create credit transaction record
  const { data: transaction, error: transactionError } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: userId,
      amount_cents: amountCents,
      credits_purchased: parseInt(credits),
      currency: 'USD',
      payment_provider: 'epoch',
      status: 'succeeded',
      provider_transaction_reference: epochTransactionId,
      provider_specific_details: providerDetails,
    })
    .select()
    .single();

  if (transactionError) {
    console.error('Error creating credit transaction:', transactionError);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }

  // Update user credits
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();

  if (fetchError) {
    console.error('Error fetching user profile:', fetchError);
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

async function handleTipTransaction(
  metadata: EpochPaymentMetadata,
  epochTransactionId: string,
  providerDetails: any
) {
  const { userId, creatorId, postId, amountCents } = metadata;

  if (!creatorId) {
    return NextResponse.json(
      { error: 'Missing creatorId in metadata' },
      { status: 400 }
    );
  }

  // Calculate payment splits (includes any agency cut)
  const { creatorShare, platformShare, agencyShare, agencyProfileId } =
    await calculatePaymentSplits(amountCents, creatorId);

  // Create tip transaction record
  const { data: transaction, error: transactionError } = await supabase
    .from('tip_transactions')
    .insert({
      user_id: userId,
      post_id: postId || null,
      creator_id: creatorId,
      amount_cents: amountCents,
      currency: 'USD',
      payment_provider: 'epoch',
      status: 'succeeded',
      provider_transaction_reference: epochTransactionId,
      provider_specific_details: providerDetails,
      creator_share_cents: creatorShare,
      platform_share_cents: platformShare,
      agency_share_cents: agencyShare > 0 ? agencyShare : null,
      agency_profile_id: agencyProfileId || null,
    })
    .select()
    .single();

  if (transactionError) {
    console.error('Error creating tip transaction:', transactionError);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }

  // Create tip notification
  try {
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
        amount: amountCents / 100,
        postId: postId || undefined
      });
    }
  } catch (notificationError) {
    console.error('Failed to create tip notification:', notificationError);
  }

  return NextResponse.json({ success: true });
}

async function handlePPVTransaction(
  metadata: EpochPaymentMetadata,
  epochTransactionId: string,
  providerDetails: any,
  postId?: string,
  messageId?: string
) {
  const { userId, amountCents } = metadata;

  if (!postId && !messageId) {
    return NextResponse.json(
      { error: 'Missing postId or messageId in metadata' },
      { status: 400 }
    );
  }

  let creatorId: string;
  if (messageId) {
    // Get message and find creator
    const { data: msg, error: msgError } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('id', messageId)
      .single();

    if (msgError || !msg) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    creatorId = msg.sender_id;
  } else {
    // Get post and find creator
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId!)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    creatorId = post.user_id;
  }

  // Calculate payment splits (includes any agency cut)
  const { creatorShare, platformShare, agencyShare, agencyProfileId } =
    await calculatePaymentSplits(amountCents, creatorId);

  // Create PPV transaction record
  const transactionData: any = {
    user_id: userId,
    amount_cents: amountCents,
    currency: 'USD',
    payment_provider: 'epoch',
    status: 'succeeded',
    provider_transaction_reference: epochTransactionId,
    provider_specific_details: providerDetails,
    creator_share_cents: creatorShare,
    platform_share_cents: platformShare,
    agency_share_cents: agencyShare > 0 ? agencyShare : null,
    agency_profile_id: agencyProfileId || null,
  };

  if (messageId) {
    transactionData.message_id = messageId;
  } else {
    transactionData.post_id = postId;
  }

  const { data: transaction, error: transactionError } = await supabase
    .from('ppv_transactions')
    .insert(transactionData)
    .select()
    .single();

  if (transactionError) {
    console.error('Error creating PPV transaction:', transactionError);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }

  // Update message with PPV_transaction_id if it's a message transaction
  if (messageId) {
    await supabase
      .from('messages')
      .update({ PPV_transaction_id: transaction.id })
      .eq('id', messageId);
  }

  // Create PPV purchase notification (only for post PPVs)
  if (postId) {
    try {
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();

      if (buyerProfile?.username) {
        await createPPVPurchaseNotification({
          creatorId: creatorId,
          buyerId: userId,
          buyerUsername: buyerProfile.username,
          postId: postId,
          amount: amountCents / 100
        });
      }
    } catch (notificationError) {
      console.error('Failed to create PPV purchase notification:', notificationError);
    }
  }

  return NextResponse.json({ success: true });
}

async function handleProductTransaction(
  metadata: EpochPaymentMetadata,
  epochTransactionId: string,
  providerDetails: any,
  productId?: string
) {
  const { userId, amountCents } = metadata;

  if (!productId) {
    return NextResponse.json(
      { error: 'Missing productId in metadata' },
      { status: 400 }
    );
  }

  // Get product details
  const { data: product, error: productError } = await supabase
    .from('creator_products')
    .select('*')
    .eq('id', productId)
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Calculate payment splits (using store split, includes any agency cut)
  const { creatorShare, platformShare, agencyShare, agencyProfileId } =
    await calculatePaymentSplitsStore(amountCents, product.creator_profile_id);

  // Create product transaction
  const { data: transaction, error: transactionError } = await supabase
    .from('creator_product_transactions')
    .insert({
      user_id: userId,
      creator_product_id: productId,
      amount_cents: amountCents,
      currency: 'USD',
      payment_provider: 'epoch',
      status: 'succeeded',
      provider_transaction_reference: epochTransactionId,
      provider_specific_details: providerDetails,
      creator_share_cents: creatorShare,
      platform_share_cents: platformShare,
      agency_share_cents: agencyShare > 0 ? agencyShare : null,
      agency_profile_id: agencyProfileId || null,
    })
    .select()
    .single();

  if (transactionError) {
    console.error('Error creating product transaction:', transactionError);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }

  // Create product order
  const { data: order, error: orderError } = await supabase
    .from('creator_product_orders')
    .insert({
      creator_product_id: productId,
      user_id: userId,
      creator_product_transaction_id: transaction.id,
      quantity: 1,
      order_status: 'paid',
    })
    .select()
    .single();

  if (orderError) {
    console.error('Error creating order:', orderError);
  }

  // Create product purchase notification
  try {
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
        amount: amountCents / 100
      });
    }
  } catch (notificationError) {
    console.error('Error creating product purchase notification:', notificationError);
  }

  return NextResponse.json({ success: true });
}

async function handleSubscriptionTransaction(
  metadata: EpochPaymentMetadata,
  epochTransactionId: string,
  providerDetails: any
) {
  const { userId, creatorId, subscriptionId, amountCents } = metadata;

  if (!creatorId) {
    return NextResponse.json(
      { error: 'Missing creatorId in metadata' },
      { status: 400 }
    );
  }

  // Get creator subscription details
  const { data: creator, error: creatorError } = await supabase
    .from('creators')
    .select('subscription_price_cents, subscription_interval')
    .eq('profile_id', creatorId)
    .single();

  if (creatorError || !creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  }

  // Calculate payment splits (includes any agency cut)
  const { creatorShare, platformShare, agencyShare, agencyProfileId } =
    await calculatePaymentSplits(amountCents, creatorId);

  // Calculate period dates
  const now = new Date();
  const periodEnds = new Date(now);
  if (creator.subscription_interval === 'month') {
    periodEnds.setMonth(periodEnds.getMonth() + 1);
  } else {
    periodEnds.setFullYear(periodEnds.getFullYear() + 1);
  }

  // Create or update subscription
  let subscription;
  if (subscriptionId) {
    // Update existing subscription
    const { data: updatedSubscription, error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_ends_at: periodEnds.toISOString(),
        payment_provider: 'epoch',
        canceled_at: null,
      })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating subscription:', updateError);
    } else {
      subscription = updatedSubscription;
    }
  } else {
    // Create new subscription
    const { data: newSubscription, error: createError } = await supabase
      .from('subscriptions')
      .insert({
        follower_id: userId,
        following_id: creatorId,
        status: 'active',
        current_period_ends_at: periodEnds.toISOString(),
        provider_subscription_id: `epoch_${epochTransactionId}`,
        price_at_time_of_subscription_cents: creator.subscription_price_cents,
        interval_at_time_of_subscription: creator.subscription_interval,
        payment_provider: 'epoch',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating subscription:', createError);
      return NextResponse.json(
        { error: 'Failed to create subscription' },
        { status: 500 }
      );
    }
    subscription = newSubscription;
  }

  // Create subscription payment record
  const { error: paymentError } = await supabase
    .from('subscription_payments')
    .insert({
      subscription_id: subscription.id,
      user_id: userId,
      creator_profile_id: creatorId,
      amount_cents: amountCents,
      currency: 'USD',
      payment_provider: 'epoch',
      status: 'succeeded',
      provider_transaction_reference: epochTransactionId,
      provider_specific_details: providerDetails,
      period_starts_at: now.toISOString(),
      period_ends_at: periodEnds.toISOString(),
      creator_share_cents: creatorShare,
      platform_share_cents: platformShare,
      agency_share_cents: agencyShare > 0 ? agencyShare : null,
      agency_profile_id: agencyProfileId || null,
    });

  if (paymentError) {
    console.error('Error creating subscription payment:', paymentError);
    return NextResponse.json(
      { error: 'Failed to create payment record' },
      { status: 500 }
    );
  }

  // Create subscription notification for new subscriptions
  if (!subscriptionId) {
    try {
      const { data: subscriberProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();

      if (subscriberProfile?.username) {
        await createNewSubscriptionNotification({
          creatorId: creatorId,
          subscriberId: userId,
          subscriberUsername: subscriberProfile.username
        });
      }
    } catch (notificationError) {
      console.error('Failed to create subscription notification:', notificationError);
    }
  }

  return NextResponse.json({ success: true });
}

