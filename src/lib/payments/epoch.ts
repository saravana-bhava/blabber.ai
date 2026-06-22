import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Epoch API configuration
// Note: The API endpoint might be different - check Epoch docs for correct endpoint
const EPOCH_API_URL = process.env.EPOCH_API_URL || 'https://staging.wnu.com/invoice-push';
// Shared secret key for signing JWTs (this is NOT a JWT token, it's the secret used to sign JWTs)
const EPOCH_SHARED_SECRET = process.env.EPOCH_SHARED_SECRET || '';
// The shared secret is also used as the webhook secret for epoch_digest verification
const EPOCH_WEBHOOK_SECRET = process.env.EPOCH_WEBHOOK_SECRET || EPOCH_SHARED_SECRET;
const EPOCH_REDIRECT_BASE_URL = process.env.EPOCH_REDIRECT_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://blabber.ai';
// Base URL for constructing payment links if API doesn't return one
const EPOCH_BASE_URL = process.env.EPOCH_BASE_URL || 'https://staging.wnu.com';
// Epoch client ID (master code without 'M-')
const EPOCH_CLIENT_ID = process.env.EPOCH_CLIENT_ID || '';
// Site hostname (must include www. unless subdomain)
const EPOCH_SITE = process.env.EPOCH_SITE || 'www.blabber.ai';

// Types for Epoch API
export interface EpochPaymentMetadata {
  userId: string;
  transactionType: 'tip' | 'ppv' | 'subscription' | 'credit' | 'product';
  postId?: string;
  messageId?: string;
  creatorId?: string;
  productId?: string;
  subscriptionId?: string;
  amountCents: number;
  creatorShareCents?: number;
  platformShareCents?: number;
  agencyShareCents?: number;
  agencyProfileId?: string | null;
  credits?: string; // For credit purchases
  shippingAddress?: string; // For product purchases
  [key: string]: any; // Allow additional metadata
}

export interface EpochPaymentLinkParams {
  amount: number; // Amount in dollars (not cents)
  currency?: string;
  metadata: EpochPaymentMetadata;
  redirectUrl?: string;
  noUserPass?: boolean;
  recurring?: {
    interval: 'month' | 'year';
    intervalCount?: number;
  };
}

export interface EpochPostbackData {
  ans?: string; // Answer parameter
  transaction_id?: string;
  amount?: string;
  currency?: string;
  status?: string;
  [key: string]: any; // Additional postback fields
}

/**
 * Generate JWT token for Epoch Dynamic Pricing API
 * Based on Epoch Dynamic Pricing v54.3 documentation
 * Returns both the JWT token and the payload (payload may need to be sent in request body)
 */
export function generateEpochJWT(paymentParams: EpochPaymentLinkParams): { token: string; payload: any } {
  if (!EPOCH_SHARED_SECRET) {
    throw new Error('EPOCH_SHARED_SECRET environment variable is not set (this should be your shared secret key)');
  }
  if (!EPOCH_CLIENT_ID) {
    throw new Error('EPOCH_CLIENT_ID environment variable is not set');
  }

  // Generate invoice_id (unique reference for this purchase)
  const invoiceId = `blabber_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Build purchase object according to Epoch format
  const purchase: any = {
    site: EPOCH_SITE,
    billing: {
      initial: {
        amount: paymentParams.amount.toFixed(2), // Amount as string with 2 decimal places
      },
    },
  };

  // Add recurring billing if provided
  if (paymentParams.recurring) {
    // Map our interval format to Epoch's format
    const unit = paymentParams.recurring.interval === 'month' ? 'MONTH' : 'YEAR';
    purchase.billing.recurring = [{
      amount: paymentParams.amount.toFixed(2),
      frequency: paymentParams.recurring.intervalCount || 1,
      unit: unit,
    }];
    
    // If recurring, initial period is required (docs show as string in examples)
    purchase.billing.initial.valid_until_period = String(paymentParams.recurring.intervalCount || 1);
    purchase.billing.initial.valid_until_unit = unit;
  }

  // Build passthru object for custom metadata (Epoch requires x_ prefix)
  // Note: Epoch requires string values, especially for numeric fields like amountCents
  const passthru: any = {};
  Object.keys(paymentParams.metadata).forEach((key) => {
    const value = paymentParams.metadata[key];
    // Convert to string - Epoch requires string values (e.g., "1000" not 1000)
    passthru[`x_${key}`] = String(value);
  });

  if (Object.keys(passthru).length > 0) {
    purchase.passthru = passthru;
  }

  // Build the payload according to Epoch Dynamic Pricing API format
  // Note: redirect_url is mandatory per docs, but examples sometimes omit it
  const payload: any = {
    client_id: EPOCH_CLIENT_ID,
    invoice_id: invoiceId,
    purchases: [purchase],
    no_userpass: paymentParams.noUserPass || true,
  };

  // Add redirect_url (mandatory per docs)
  if (paymentParams.redirectUrl) {
    payload.redirect_url = paymentParams.redirectUrl;
  } else {
    payload.redirect_url = `${EPOCH_REDIRECT_BASE_URL}/epoch-callback`;
  }

  // Add postback URL to purchase object (optional but recommended)
  // Note: For local development, Epoch's servers can't reach localhost URLs
  // Postbacks are only sent on successful payments, so this won't block payments
  // For production, ensure EPOCH_POSTBACK_URL is set to a publicly accessible URL
  // Epoch requires the postback URL to include "www" in the domain
  let postbackUrl = process.env.EPOCH_POSTBACK_URL || `${EPOCH_REDIRECT_BASE_URL}/api/epoch-webhook`;
  
  // Ensure postback URL includes "www" in the domain (Epoch requirement)
  // try {
  //   const url = new URL(postbackUrl);
  //   if (!url.hostname.startsWith('www.') && !url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')) {
  //     // Add www prefix to hostname
  //     url.hostname = `www.${url.hostname}`;
  //     postbackUrl = url.toString();
  //   }
  // } catch (e) {
  //   // If URL parsing fails, try to add www manually
  //   if (!postbackUrl.includes('localhost') && !postbackUrl.includes('127.0.0.1')) {
  //     postbackUrl = postbackUrl.replace(/https?:\/\/([^\/]+)/, (match, hostname) => {
  //       if (!hostname.startsWith('www.')) {
  //         return match.replace(hostname, `www.${hostname}`);
  //       }
  //       return match;
  //     });
  //   }
  // }
  
  // Only add postback_url if it's not localhost (Epoch can't reach localhost)
  // For local dev, you can use a tunnel service (ngrok, etc.) or test without postbacks
  if (postbackUrl && !postbackUrl.includes('localhost') && !postbackUrl.includes('127.0.0.1')) {
    purchase.postback_url = postbackUrl;
  } else if (process.env.NODE_ENV === 'production') {
    // In production, warn if postback URL is not set or is localhost
    console.warn('⚠️ Epoch postback_url is localhost or not set. Postbacks will not work in production.');
  }

  // Sign JWT with the shared secret key using HS256 algorithm
  // This generates a JWT token that will be sent as Bearer token in Authorization header
  // Note: We use noTimestamp: true to prevent jwt.sign from automatically adding 'iat' (issued at)
  // and we don't use expiresIn to prevent 'exp' (expiration) from being added
  // Epoch does not accept these fields in the payload
  const token = jwt.sign(payload, EPOCH_SHARED_SECRET, {
    algorithm: 'HS256',
    noTimestamp: true, // Prevents 'iat' from being added
    // No expiresIn option - prevents 'exp' from being added
  });

  // The payload should match exactly what we signed (no iat/exp added)
  // Decode to verify, but it should be the same as our original payload
  const decoded = jwt.decode(token, { complete: true });
  const actualJwtPayload = decoded?.payload || payload;

  // Debug: log the payload that will be signed into the JWT token

  // Return the JWT token and the payload (without iat/exp)
  return { token, payload: actualJwtPayload };
}

/**
 * Create Epoch payment link
 * Based on Epoch documentation, the JWT token is used to generate a join link
 * The token can be passed as a query parameter or in the request body
 */
export async function createEpochPaymentLink(paymentParams: EpochPaymentLinkParams): Promise<string> {
  const { token: jwtToken, payload } = generateEpochJWT(paymentParams);
  
  // Epoch Dynamic Pricing API - POST to invoice-push endpoint
  // The API should return a join link URL
  // Authorization: 'Bearer token' where token is the JWT created with payload signed with shared key (HS256)
  // The payload should also be sent in the request body (Epoch compares JWT payload with body payload)
  
  // Debug: log the payload being sent in request body
  const requestBodyPayload = JSON.stringify(payload);
  
  // Extract site value from payload for comparison
  const siteValue = payload.purchases?.[0]?.site;
  
  try {
    const response = await fetch(EPOCH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
      },
      body: requestBodyPayload,
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('❌ Epoch API Error Response:');
      console.error('   Status:', response.status);
      console.error('   Response body:', responseText);
      try {
        const errorData = JSON.parse(responseText);
        console.error('   Parsed error:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.error('   Could not parse error as JSON');
      }
      throw new Error(`Epoch API returned error ${response.status}: ${responseText}`);
    }

    // Try to parse as JSON first
    // Expected response format: { "success": true, "cacheKey": "...", "redirectURL": "..." }
    try {
      const data = JSON.parse(responseText);
      
      // Check for redirectURL (the primary field from Epoch docs)
      if (data.redirectURL) {
        return data.redirectURL;
      }
      
      // Fallback: check other possible URL fields
      if (data.url || data.payment_url || data.link || data.join_url || data.join_link) {
        const paymentUrl = data.url || data.payment_url || data.link || data.join_url || data.join_link;
        if (typeof paymentUrl === 'string' && paymentUrl.startsWith('http')) {
          return paymentUrl;
        }
      }
      
      // If response is just a URL string in the data
      if (typeof data === 'string' && data.startsWith('http')) {
        return data;
      }
      
      throw new Error(`Epoch API response did not contain a valid payment URL. Response: ${JSON.stringify(data)}`);
    } catch (parseError) {
      // If response is not JSON, check if it's a URL string
      if (responseText.trim().startsWith('http')) {
        return responseText.trim();
      }
      
      throw new Error(`Failed to parse Epoch API response as JSON or URL. Response: ${responseText.substring(0, 200)}`);
    }
  } catch (error) {
    console.error('❌ Epoch API POST request failed:');
    console.error('   Error type:', error?.constructor?.name || typeof error);
    console.error('   Error message:', error instanceof Error ? error.message : String(error));
    console.error('   Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    if (error instanceof Error && 'cause' in error) {
      console.error('   Error cause:', error.cause);
    }
    throw new Error(`Failed to create Epoch payment link: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify Epoch postback using epoch_digest
 */
export function verifyEpochPostback(
  postbackData: Record<string, any>,
  epochDigest: string
): boolean {
  // Use shared secret as webhook secret if EPOCH_WEBHOOK_SECRET not set separately
  const secret = EPOCH_WEBHOOK_SECRET || EPOCH_SHARED_SECRET;
  if (!secret) {
    console.warn('EPOCH_WEBHOOK_SECRET and EPOCH_SHARED_SECRET not configured, skipping verification');
    return true; // Allow in development if secret not set
  }

  try {
    // Create a string from the postback data (excluding the digest itself)
    const dataString = Object.keys(postbackData)
      .filter(key => key !== 'epoch_digest' && key !== 'digest')
      .sort()
      .map(key => `${key}=${postbackData[key]}`)
      .join('&');

    // Calculate expected digest using the secret (shared secret or separate webhook secret)
    const secret = EPOCH_WEBHOOK_SECRET || EPOCH_SHARED_SECRET;
    const expectedDigest = crypto
      .createHmac('sha256', secret)
      .update(dataString)
      .digest('hex');

    // Compare digests
    return crypto.timingSafeEqual(
      Buffer.from(epochDigest, 'hex'),
      Buffer.from(expectedDigest, 'hex')
    );
  } catch (error) {
    console.error('Error verifying Epoch postback:', error);
    return false;
  }
}

/**
 * Verify Epoch postback by IP whitelist
 * Note: This should be done at the server/load balancer level, but we can check here too
 */
export function isEpochIPAllowed(clientIP: string): boolean {
  // In production, this should check against Epoch's IP whitelist
  // For staging: https://test.epoch.com/ip_list.php
  // For now, we'll rely on digest verification
  return true; // IP verification should be done at infrastructure level
}

/**
 * Parse metadata from Epoch postback
 */
export function parseEpochPostbackMetadata(postbackData: EpochPostbackData): EpochPaymentMetadata | null {
  // Epoch sends metadata in the postback - extract it
  // The metadata fields should match what we sent in the payment link (with x_ prefix)
  const metadata: Partial<EpochPaymentMetadata> = {};

  // Extract metadata fields (they come back with x_ prefix from Epoch)
  Object.keys(postbackData).forEach((key) => {
    if (key.startsWith('x_')) {
      const metadataKey = key.substring(2); // Remove x_ prefix
      // Convert string numbers back to numbers for amountCents
      if (metadataKey === 'amountCents' || metadataKey === 'creatorShareCents' || metadataKey === 'platformShareCents') {
        metadata[metadataKey] = parseInt(postbackData[key]) || 0;
      } else {
        metadata[metadataKey] = postbackData[key];
      }
    }
  });

  // Also check direct fields (without x_ prefix) as fallback
  if (!metadata.userId && postbackData.userId) metadata.userId = postbackData.userId;
  if (!metadata.transactionType && postbackData.transactionType) metadata.transactionType = postbackData.transactionType;
  if (!metadata.postId && postbackData.postId) metadata.postId = postbackData.postId;
  if (!metadata.creatorId && postbackData.creatorId) metadata.creatorId = postbackData.creatorId;
  if (!metadata.productId && postbackData.productId) metadata.productId = postbackData.productId;
  if (!metadata.amountCents && postbackData.amountCents) {
    metadata.amountCents = typeof postbackData.amountCents === 'string' 
      ? parseInt(postbackData.amountCents) 
      : postbackData.amountCents;
  }

  if (!metadata.userId || !metadata.transactionType || !metadata.amountCents) {
    return null;
  }

  return metadata as EpochPaymentMetadata;
}

