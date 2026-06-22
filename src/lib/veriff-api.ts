import crypto from 'crypto';

const VERIFF_API_BASE = 'https://stationapi.veriff.com';

interface VeriffApiConfig {
  apiKey: string;
  sharedSecretKey: string;
}

function generateHmacSignature(sharedSecretKey: string, payload: string): string {
  return crypto
    .createHmac('sha256', sharedSecretKey)
    .update(Buffer.from(payload, 'utf8'))
    .digest('hex')
    .toLowerCase();
}

export function isWebhookSignatureValid(
  signature: string,
  sharedSecretKey: string,
  payload: string | object
): boolean {
  const body = typeof payload === 'object' ? JSON.stringify(payload) : payload;
  const digest = generateHmacSignature(sharedSecretKey, body);
  return digest === signature.toLowerCase();
}

async function veriffRequest(
  config: VeriffApiConfig,
  method: 'POST' | 'GET' | 'PATCH' | 'DELETE',
  endpoint: string,
  body?: any
): Promise<any> {
  const url = `${VERIFF_API_BASE}${endpoint}`;

  let signaturePayload: string;
  if (method === 'POST' || method === 'PATCH') {
    signaturePayload = body ? JSON.stringify(body) : '';
  } else {
    const sessionIdMatch = endpoint.match(/\/sessions\/([^/]+)/);
    signaturePayload = sessionIdMatch ? sessionIdMatch[1] : '';
  }

  const signature = generateHmacSignature(config.sharedSecretKey, signaturePayload);

  const headers: Record<string, string> = {
    'X-AUTH-CLIENT': config.apiKey,
    'X-HMAC-SIGNATURE': signature,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Veriff API error:', response.status, errorText);
    throw new Error(`Veriff API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function createVeriffSession(
  config: VeriffApiConfig,
  options: {
    userId: string;
    callbackUrl?: string;
  }
): Promise<{
  sessionId: string;
  sessionUrl: string;
  sessionToken: string;
}> {
  const sessionSpec: any = {
    verification: {
      vendorData: options.userId,
    },
  };

  if (options.callbackUrl) {
    sessionSpec.verification.callback = options.callbackUrl;
  }

  const response = await veriffRequest(config, 'POST', '/v1/sessions', sessionSpec);

  return {
    sessionId: response.verification.id,
    sessionUrl: response.verification.url,
    sessionToken: response.verification.sessionToken,
  };
}

export interface VeriffDecisionResult {
  status: string;
  code: number;
  reason: string | null;
  reasonCode: number | null;
  estimatedAge: number | null;
  dateOfBirth: string | null;
  vendorData: string | null;
  decisionTime: string | null;
  rawVerification: any;
  rawResponse: any;
}

const FULLAUTO_DECISION_TO_CODE: Record<string, number> = {
  approved: 9001,
  declined: 9102,
  resubmission_requested: 9103,
  expired: 9104,
  abandoned: 9121,
};

export async function getVeriffDecision(
  config: VeriffApiConfig,
  sessionId: string
): Promise<VeriffDecisionResult> {
  const response = await veriffRequest(config, 'GET', `/v1/sessions/${sessionId}/decision`);

  const verification = response.verification;

  if (!verification) {
    return {
      status: 'pending',
      code: 0,
      reason: null,
      reasonCode: null,
      estimatedAge: null,
      dateOfBirth: null,
      vendorData: null,
      decisionTime: null,
      rawVerification: null,
      rawResponse: response,
    };
  }

  let dateOfBirth: string | null = verification.person?.dateOfBirth ?? null;

  if (!dateOfBirth && verification.status === 'approved') {
    try {
      const personResponse = await veriffRequest(config, 'GET', `/v1/sessions/${sessionId}/person`);
      dateOfBirth = personResponse?.person?.dateOfBirth ?? null;
    } catch (e) {
    }
  }

  return {
    status: verification.status || 'unknown',
    code: verification.code || 0,
    reason: verification.reason || null,
    reasonCode: verification.reasonCode || null,
    estimatedAge: verification.additionalVerifiedData?.estimatedAge ?? null,
    dateOfBirth,
    vendorData: verification.vendorData || null,
    decisionTime: verification.decisionTime || null,
    rawVerification: verification,
    rawResponse: response,
  };
}

/**
 * Normalize a Full Auto webhook payload into the same shape as a decision webhook.
 * Full Auto payloads have a different structure:
 *   - Session ID at event.sessionId (not event.verification.id)
 *   - Decision at event.data.verification.decision (not event.verification.status)
 *   - No decision codes — we map decision strings to synthetic codes
 *   - Person fields are nested objects with .value (not plain strings)
 */
export function parseFullAutoWebhook(event: any): {
  sessionId: string;
  vendorData: string | null;
  status: string;
  code: number;
  dateOfBirth: string | null;
  estimatedAge: number | null;
  decisionScore: number | null;
  rawEvent: any;
} {
  const verification = event.data?.verification || {};
  const decision = verification.decision || 'unknown';
  const person = verification.person || {};

  const dobField = person.dateOfBirth;
  const dateOfBirth: string | null = typeof dobField === 'object' ? (dobField?.value ?? null) : (dobField ?? null);

  const estimatedAgeField = person.estimatedAge;
  const estimatedAge: number | null = typeof estimatedAgeField === 'object'
    ? (estimatedAgeField?.value != null ? Number(estimatedAgeField.value) : null)
    : (estimatedAgeField ?? null);

  return {
    sessionId: event.sessionId,
    vendorData: event.vendorData ?? null,
    status: decision,
    code: FULLAUTO_DECISION_TO_CODE[decision] ?? 0,
    dateOfBirth,
    estimatedAge,
    decisionScore: verification.decisionScore ?? null,
    rawEvent: event,
  };
}

function calculateAgeFromDOB(dateOfBirth: string): number | null {
  try {
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  } catch {
    return null;
  }
}

/**
 * Process a Veriff decision (from webhook or polling) into our internal status format.
 * Supports both Decision webhook (status + code) and Full Auto webhook (decision string mapped to code).
 *
 * Age is determined from either:
 * 1. estimatedAge (Age Estimation product — selfie only)
 * 2. dateOfBirth (standard ID verification — extracted from document)
 *
 * Approved (code 9001) with age >= 18 -> completed + canMonetize
 * Approved but under 18 -> rejected (underage)
 * Approved but no age data available -> completed (ID was verified, age couldn't be extracted)
 * Resubmission requested (code 9103) -> in_progress
 * Declined (code 9102) -> rejected
 * Anything else -> in_progress
 */
export function processVeriffDecision(verification: {
  status: string;
  code: number;
  estimatedAge: number | null;
  dateOfBirth?: string | null;
}): {
  verificationStatus: 'in_progress' | 'completed' | 'rejected';
  canMonetize: boolean;
  isOver18: boolean;
  resolvedAge: number | null;
} {
  const isApproved = verification.status === 'approved' && (verification.code === 9001 || verification.code === 0);

  if (isApproved) {
    let resolvedAge: number | null = verification.estimatedAge;

    if (resolvedAge === null && verification.dateOfBirth) {
      resolvedAge = calculateAgeFromDOB(verification.dateOfBirth);
    }

    if (resolvedAge !== null) {
      const isOver18 = resolvedAge >= 18;
      return {
        verificationStatus: isOver18 ? 'completed' : 'rejected',
        canMonetize: isOver18,
        isOver18,
        resolvedAge,
      };
    }

    return {
      verificationStatus: 'completed',
      canMonetize: true,
      isOver18: true,
      resolvedAge: null,
    };
  }

  if (verification.status === 'resubmission_requested') {
    return { verificationStatus: 'in_progress', canMonetize: false, isOver18: false, resolvedAge: null };
  }

  if (verification.status === 'declined' || verification.code === 9102) {
    return { verificationStatus: 'rejected', canMonetize: false, isOver18: false, resolvedAge: null };
  }

  if (verification.status === 'expired' || verification.status === 'abandoned') {
    return { verificationStatus: 'rejected', canMonetize: false, isOver18: false, resolvedAge: null };
  }

  return { verificationStatus: 'in_progress', canMonetize: false, isOver18: false, resolvedAge: null };
}

export function getVeriffConfig(): VeriffApiConfig {
  const apiKey = process.env.VERIFF_API_KEY;
  const sharedSecretKey = process.env.VERIFF_SHARED_SECRET_KEY;

  if (!apiKey) {
    throw new Error('VERIFF_API_KEY is not configured');
  }

  if (!sharedSecretKey) {
    throw new Error('VERIFF_SHARED_SECRET_KEY is not configured');
  }

  return { apiKey, sharedSecretKey };
}
