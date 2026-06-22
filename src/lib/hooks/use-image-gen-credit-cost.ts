import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { parseImageGenCreditCost } from '@/lib/schemas/platform-settings';
import { queryKeys } from '@/lib/query/keys';

async function fetchImageGenCreditCost(): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase
    .from('platform_settings')
    .select('key, value')
    .eq('key', 'image_gen_credit_cost');
  return parseImageGenCreditCost(data ?? []);
}

export function useImageGenCreditCost(when: boolean) {
  const { data = 10 } = useQuery({
    queryKey: queryKeys.platformSettings.imageGenCreditCost(),
    queryFn: fetchImageGenCreditCost,
    enabled: when,
    staleTime: 5 * 60 * 1000,
  });

  return data;
}
