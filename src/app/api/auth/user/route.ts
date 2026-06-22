import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    // Get the current user's session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile information
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, full_name')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }

    return NextResponse.json({ 
      user: {
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name
      }
    });
  } catch (error) {
    console.error('Error in /api/auth/user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 