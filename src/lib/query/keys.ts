export const queryKeys = {
  platformSettings: {
    all: ['platformSettings'] as const,
    monetization: () => [...queryKeys.platformSettings.all, 'monetization'] as const,
    imageGenCreditCost: () => [...queryKeys.platformSettings.all, 'imageGenCreditCost'] as const,
    aiCallBilling: () => [...queryKeys.platformSettings.all, 'aiCallBilling'] as const,
  },
  creatorRow: (profileId: string) => ['creatorRow', profileId] as const,
} as const;
