-- Add payment address columns to creators table
ALTER TABLE public.creators
ADD COLUMN IF NOT EXISTS solana_address text NULL,
ADD COLUMN IF NOT EXISTS ethereum_address text NULL,
ADD COLUMN IF NOT EXISTS polygon_address text NULL,
ADD COLUMN IF NOT EXISTS bitcoin_address text NULL,
ADD COLUMN IF NOT EXISTS bank_account_number text NULL,
ADD COLUMN IF NOT EXISTS bank_routing_number text NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.creators.solana_address IS 'Solana wallet address for receiving payments';
COMMENT ON COLUMN public.creators.ethereum_address IS 'Ethereum wallet address for receiving payments';
COMMENT ON COLUMN public.creators.polygon_address IS 'Polygon wallet address for receiving payments';
COMMENT ON COLUMN public.creators.bitcoin_address IS 'Bitcoin wallet address for receiving payments';
COMMENT ON COLUMN public.creators.bank_account_number IS 'Bank account number for receiving payments';
COMMENT ON COLUMN public.creators.bank_routing_number IS 'Bank routing number for receiving payments';

