/** Request body for POST /api/credits/spend (client + server safe). */
export type CreditSpendRequest =
  | { kind: 'ppv'; postId?: string; messageId?: string }
  | { kind: 'tip'; amountCents: number; postId?: string; creatorId?: string }
  | { kind: 'subscription'; creatorId: string; subscriptionId?: string | null }
  | {
      kind: 'product';
      productId: string;
      amountCents: number;
      shippingAddress: Record<string, unknown>;
    };
