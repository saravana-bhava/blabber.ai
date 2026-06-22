import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes — platform settings change rarely
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
