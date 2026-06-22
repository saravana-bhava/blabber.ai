import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { isWebhookSignatureValid, processVeriffDecision, parseFullAutoWebhook, getVeriffConfig } from '@/lib/veriff-api';

export async function POST(request: Request) {
  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  );

  try {
    const rawBody = await request.text();

    const veriffConfig = getVeriffConfig();

    const signatureHeader = request.headers.get('x-hmac-signature');
    const authClientHeader = request.headers.get('x-auth-client');

    if (!signatureHeader || !authClientHeader) {
      console.error('Missing Veriff webhook headers');
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      );
    }

    if (authClientHeader !== veriffConfig.apiKey) {
      console.error('Invalid Veriff API key in webhook');
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    if (!isWebhookSignatureValid(signatureHeader, veriffConfig.sharedSecretKey, rawBody)) {
      console.error('Invalid Veriff webhook HMAC signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = JSON.parse(rawBody);

    const isFullAuto = event.eventType === 'fullauto';

    let sessionId: string;
    let status: string;
    let code: number;
    let estimatedAge: number | null;
    let dateOfBirth: string | null;
    let rawResults: any;

    if (isFullAuto) {
      const fa = parseFullAutoWebhook(event);
      sessionId = fa.sessionId;
      status = fa.status;
      code = fa.code;
      estimatedAge = fa.estimatedAge;
      dateOfBirth = fa.dateOfBirth;
      rawResults = fa.rawEvent;

    } else {
      const verification = event.verification;
      if (!verification?.id) {
        console.error('Received unknown Veriff webhook format:', JSON.stringify(event).slice(0, 500));
        return NextResponse.json(
          { error: 'Missing verification ID' },
          { status: 400 }
        );
      }

      sessionId = verification.id;
      status = verification.status;
      code = verification.code;
      estimatedAge = verification.additionalVerifiedData?.estimatedAge ?? null;
      dateOfBirth = verification.person?.dateOfBirth ?? null;
      rawResults = verification;

    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session ID' },
        { status: 400 }
      );
    }

    const { data: creator, error: fetchError } = await supabaseAdmin
      .from('creators')
      .select('*')
      .eq('veriff_session_id', sessionId)
      .maybeSingle();

    let agency: any = null;
    if (!creator) {
      const { data: agencyRow, error: agencyError } = await supabaseAdmin
        .from('agencies')
        .select('*')
        .eq('veriff_session_id', sessionId)
        .maybeSingle();
      if (agencyError) {
        console.error('Error looking up agency for Veriff session:', sessionId, agencyError);
      }
      agency = agencyRow ?? null;
    }

    if ((fetchError && !agency) || (!creator && !agency)) {
      console.error('No creator or agency found for Veriff session:', sessionId, fetchError);
      return NextResponse.json(
        { error: 'Account not found for session' },
        { status: 404 }
      );
    }

    const targetProfileId: string = (creator?.profile_id ?? agency?.profile_id) as string;

    // Persist identity record for audit/compliance (best-effort, don't block the webhook)
    try {
      let identityRecord: Record<string, any>;

      if (isFullAuto) {
        const person = event.data?.verification?.person || {};
        const doc = event.data?.verification?.document || {};
        const v = (field: any) => (typeof field === 'object' ? field?.value ?? null : field ?? null);

        identityRecord = {
          profile_id: targetProfileId,
          veriff_session_id: sessionId,
          attempt_id: event.attemptId ?? null,
          event_type: 'fullauto',
          decision: status,
          decision_code: code || null,
          decision_score: event.data?.verification?.decisionScore ?? null,
          first_name: v(person.firstName),
          last_name: v(person.lastName),
          date_of_birth: v(person.dateOfBirth),
          year_of_birth: v(person.yearOfBirth),
          gender: v(person.gender),
          nationality: v(person.nationality),
          citizenship: v(person.citizenship),
          id_number: v(person.idNumber),
          place_of_birth: v(person.placeOfBirth),
          estimated_age: estimatedAge,
          document_type: v(doc.type),
          document_number: v(doc.number),
          document_country: v(doc.country),
          document_valid_from: v(doc.validFrom),
          document_valid_until: v(doc.validUntil),
          document_state: v(doc.state),
          acceptance_time: event.acceptanceTime ?? null,
          submission_time: null,
          decision_time: event.time ?? null,
          raw_payload: event,
        };
      } else {
        const verification = event.verification || {};
        const person = verification.person || {};
        const doc = verification.document || {};

        identityRecord = {
          profile_id: targetProfileId,
          veriff_session_id: sessionId,
          attempt_id: verification.attemptId ?? null,
          event_type: 'decision',
          decision: status,
          decision_code: code || null,
          decision_score: null,
          first_name: person.firstName ?? null,
          last_name: person.lastName ?? null,
          date_of_birth: person.dateOfBirth ?? null,
          year_of_birth: person.yearOfBirth ?? null,
          gender: person.gender ?? null,
          nationality: person.nationality ?? null,
          citizenship: person.citizenship ?? null,
          id_number: person.idNumber ?? null,
          place_of_birth: person.placeOfBirth ?? null,
          estimated_age: verification.additionalVerifiedData?.estimatedAge ?? estimatedAge,
          document_type: doc.type ?? null,
          document_number: doc.number ?? null,
          document_country: doc.country ?? null,
          document_valid_from: doc.validFrom ?? null,
          document_valid_until: doc.validUntil ?? null,
          document_state: doc.state ?? null,
          acceptance_time: verification.acceptanceTime ?? null,
          submission_time: verification.submissionTime ?? null,
          decision_time: verification.decisionTime ?? null,
          raw_payload: event,
        };
      }

      const { error: auditError } = await supabaseAdmin
        .from('veriff_identity_records')
        .insert(identityRecord);

      if (auditError) {
        console.error('Failed to insert veriff_identity_record (non-fatal):', auditError);
      }
    } catch (auditErr) {
      console.error('Error writing identity audit record (non-fatal):', auditErr);
    }

    const results = processVeriffDecision({
      status,
      code,
      estimatedAge,
      dateOfBirth,
    });

    const baseUpdate: Record<string, any> = {
      veriff_verification_status: results.verificationStatus,
      updated_at: new Date().toISOString(),
      veriff_estimated_age: results.resolvedAge ?? estimatedAge,
      veriff_verification_results: rawResults,
    };

    if (creator) {
      const updateData = {
        ...baseUpdate,
        can_monetize: results.canMonetize,
      };

      const { error: updateError } = await supabaseAdmin
        .from('creators')
        .update(updateData)
        .eq('profile_id', creator.profile_id);

      if (updateError) {
        console.error('Error updating creator verification status:', updateError);
        return NextResponse.json(
          { error: 'Failed to update creator status' },
          { status: 500 }
        );
      }

    } else if (agency) {
      const { error: updateError } = await supabaseAdmin
        .from('agencies')
        .update(baseUpdate)
        .eq('profile_id', agency.profile_id);

      if (updateError) {
        console.error('Error updating agency verification status:', updateError);
        return NextResponse.json(
          { error: 'Failed to update agency status' },
          { status: 500 }
        );
      }

    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error processing Veriff webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
