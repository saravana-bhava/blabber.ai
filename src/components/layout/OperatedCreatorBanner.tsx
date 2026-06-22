'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/contexts/user-context';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { OPERATED_CREATOR_BAR_OFFSET_CSS } from '@/components/layout/operated-banner-layout';

export function OperatedCreatorBanner() {
  const { session, creator } = useUser();
  const supabase = createClient();
  const router = useRouter();
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [ownProfile, setOwnProfile] = useState<{ username: string | null; full_name: string | null } | null>(
    null
  );

  const isOperated = !!(creator?.is_agency_operated && creator?.agency_profile_id);

  useEffect(() => {
    if (!isOperated || !creator?.agency_profile_id || !session?.user?.id) {
      setAgencyName(null);
      setOwnProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: agencyRow }, { data: profRow }] = await Promise.all([
        supabase.from('agencies').select('name').eq('profile_id', creator.agency_profile_id).maybeSingle(),
        supabase.from('profiles').select('username, full_name').eq('id', session.user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setAgencyName(agencyRow?.name ?? null);
      setOwnProfile(profRow ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOperated, creator?.agency_profile_id, session?.user?.id, supabase]);

  if (!isOperated) return null;

  const creatorLabel =
    ownProfile?.username ? `@${ownProfile.username}` : ownProfile?.full_name ?? 'creator';

  const handleExit = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div
      className="sticky top-0 z-50 flex min-h-0 items-center justify-between gap-3 border-b border-amber-300/60 bg-amber-100 px-4 py-2 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
      style={{ minHeight: OPERATED_CREATOR_BAR_OFFSET_CSS }}
    >
      <p className="text-sm">
        Operating <span className="font-semibold">{creatorLabel}</span>
        {agencyName ? (
          <>
            {' '}
            on behalf of <span className="font-semibold">{agencyName}</span>
          </>
        ) : null}
        .
      </p>
      <Button size="sm" variant="outline" onClick={handleExit}>
        Exit
      </Button>
    </div>
  );
}
