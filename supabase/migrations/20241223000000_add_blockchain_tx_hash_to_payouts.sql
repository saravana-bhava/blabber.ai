-- Add blockchain transaction hash column to payouts table
ALTER TABLE public.payouts
ADD COLUMN IF NOT EXISTS blockchain_tx_hash text NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.payouts.blockchain_tx_hash IS 'Blockchain transaction hash/ID for viewing the transaction on a blockchain explorer';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payouts_blockchain_tx_hash ON public.payouts USING btree (blockchain_tx_hash) TABLESPACE pg_default;

