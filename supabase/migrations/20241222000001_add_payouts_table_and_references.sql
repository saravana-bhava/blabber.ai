-- Create payouts table
CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  creator_profile_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  currency character(3) NOT NULL DEFAULT 'usd'::bpchar,
  status text NOT NULL DEFAULT 'pending'::text,
  payout_method text NULL,
  -- Payment method addresses
  solana_address text NULL,
  ethereum_address text NULL,
  polygon_address text NULL,
  bitcoin_address text NULL,
  bank_account_number text NULL,
  bank_routing_number text NULL,
  -- Provider details
  provider_transaction_reference text NULL,
  provider_specific_details jsonb NULL,
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at timestamp with time zone NULL,
  -- Constraints
  CONSTRAINT payouts_pkey PRIMARY KEY (id),
  CONSTRAINT payouts_creator_profile_id_fkey FOREIGN KEY (creator_profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
  CONSTRAINT chk_payout_amount_positive CHECK ((amount_cents > 0)),
  CONSTRAINT chk_payout_method_required CHECK (
    (status = 'pending' OR payout_method IS NOT NULL)
  )
) TABLESPACE pg_default;

-- Create indexes for payouts table
CREATE INDEX IF NOT EXISTS idx_payouts_creator_profile_id ON public.payouts USING btree (creator_profile_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts USING btree (status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON public.payouts USING btree (created_at DESC) TABLESPACE pg_default;

-- Add payout_id column to call_transactions
ALTER TABLE public.call_transactions
ADD COLUMN IF NOT EXISTS payout_id uuid NULL;

-- Add foreign key constraint for call_transactions
ALTER TABLE public.call_transactions
ADD CONSTRAINT call_transactions_payout_id_fkey 
FOREIGN KEY (payout_id) REFERENCES public.payouts (id) ON DELETE SET NULL;

-- Create index for call_transactions payout_id
CREATE INDEX IF NOT EXISTS idx_call_transactions_payout_id ON public.call_transactions USING btree (payout_id) TABLESPACE pg_default;

-- Add payout_id column to creator_product_transactions
ALTER TABLE public.creator_product_transactions
ADD COLUMN IF NOT EXISTS payout_id uuid NULL;

-- Add foreign key constraint for creator_product_transactions
ALTER TABLE public.creator_product_transactions
ADD CONSTRAINT creator_product_transactions_payout_id_fkey 
FOREIGN KEY (payout_id) REFERENCES public.payouts (id) ON DELETE SET NULL;

-- Create index for creator_product_transactions payout_id
CREATE INDEX IF NOT EXISTS idx_creator_product_transactions_payout_id ON public.creator_product_transactions USING btree (payout_id) TABLESPACE pg_default;

-- Add payout_id column to ppv_transactions
ALTER TABLE public.ppv_transactions
ADD COLUMN IF NOT EXISTS payout_id uuid NULL;

-- Add foreign key constraint for ppv_transactions
ALTER TABLE public.ppv_transactions
ADD CONSTRAINT ppv_transactions_payout_id_fkey 
FOREIGN KEY (payout_id) REFERENCES public.payouts (id) ON DELETE SET NULL;

-- Create index for ppv_transactions payout_id
CREATE INDEX IF NOT EXISTS idx_ppv_transactions_payout_id ON public.ppv_transactions USING btree (payout_id) TABLESPACE pg_default;

-- Add payout_id column to tip_transactions
ALTER TABLE public.tip_transactions
ADD COLUMN IF NOT EXISTS payout_id uuid NULL;

-- Add foreign key constraint for tip_transactions
ALTER TABLE public.tip_transactions
ADD CONSTRAINT tip_transactions_payout_id_fkey 
FOREIGN KEY (payout_id) REFERENCES public.payouts (id) ON DELETE SET NULL;

-- Create index for tip_transactions payout_id
CREATE INDEX IF NOT EXISTS idx_tip_transactions_payout_id ON public.tip_transactions USING btree (payout_id) TABLESPACE pg_default;

-- Add payout_id column to subscription_payments
ALTER TABLE public.subscription_payments
ADD COLUMN IF NOT EXISTS payout_id uuid NULL;

-- Add foreign key constraint for subscription_payments
ALTER TABLE public.subscription_payments
ADD CONSTRAINT subscription_payments_payout_id_fkey 
FOREIGN KEY (payout_id) REFERENCES public.payouts (id) ON DELETE SET NULL;

-- Create index for subscription_payments payout_id
CREATE INDEX IF NOT EXISTS idx_subscription_payments_payout_id ON public.subscription_payments USING btree (payout_id) TABLESPACE pg_default;

-- Add comments for documentation
COMMENT ON TABLE public.payouts IS 'Records of payouts made to creators';
COMMENT ON COLUMN public.payouts.creator_profile_id IS 'The creator receiving this payout';
COMMENT ON COLUMN public.payouts.amount_cents IS 'Total payout amount in cents';
COMMENT ON COLUMN public.payouts.status IS 'Payout status: pending, processing, completed, failed';
COMMENT ON COLUMN public.payouts.payout_method IS 'The method used for payout: solana, ethereum, polygon, bitcoin, bank';
COMMENT ON COLUMN public.payouts.provider_transaction_reference IS 'External transaction reference from the payout provider';
COMMENT ON COLUMN public.payouts.completed_at IS 'Timestamp when the payout was completed';

