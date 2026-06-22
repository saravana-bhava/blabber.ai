import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    // Get the current user's session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get MFA factors
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      return NextResponse.json({ error: factorsError.message }, { status: 400 });
    }

    const totpFactor = factors.totp.find(factor => factor.status === 'verified');
    
    return NextResponse.json({ 
      mfaEnabled: !!totpFactor,
      factors: factors
    });
  } catch (error) {
    console.error('Error getting MFA status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { action, factorId, code } = await request.json();
    
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    // Get the current user's session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (action === 'enroll') {
      // Enroll in TOTP MFA
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp'
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ 
        success: true,
        data: data
      });
    }

    if (action === 'unenroll' && factorId) {
      // Unenroll MFA factor
      const { error } = await supabase.auth.mfa.unenroll({
        factorId
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ 
        success: true,
        message: 'MFA disabled successfully'
      });
    }

    if (action === 'challenge' && factorId && code) {
      
      try {
        // Use regular client for MFA challenge (needs user context)
        
        // According to Supabase docs, the challenge API takes factorId and code
        const { data, error } = await supabase.auth.mfa.challenge({
          factorId,
          code
        } as any);

        if (error) {
          console.error('MFA challenge error:', error);
          return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ 
          success: true,
          data: data,
          message: 'MFA verification successful'
        });
      } catch (challengeError: any) {
        console.error('MFA challenge exception:', challengeError);
        return NextResponse.json({ 
          error: challengeError.message || 'MFA verification failed' 
        }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in MFA operation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 