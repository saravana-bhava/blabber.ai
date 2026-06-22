-- Create creator_products table
CREATE TABLE public.creator_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  creator_profile_id uuid NOT NULL,
  product_name text NOT NULL,
  description text,
  price_cents integer NOT NULL,
  shipping_price_cents integer,
  main_photo text,
  secondary_photo text,
  tertiary_photo text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT creator_products_pkey PRIMARY KEY (id),
  CONSTRAINT creator_products_creator_profile_id_fkey FOREIGN KEY (creator_profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT chk_creator_product_price_positive CHECK (price_cents > 0),
  CONSTRAINT chk_creator_product_shipping_price_positive CHECK (shipping_price_cents IS NULL OR shipping_price_cents >= 0)
) TABLESPACE pg_default;

-- Create indexes for creator_products
CREATE INDEX IF NOT EXISTS idx_creator_products_creator_profile_id ON public.creator_products USING btree (creator_profile_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_creator_products_is_active ON public.creator_products USING btree (is_active) TABLESPACE pg_default;

-- Create creator_product_transactions table (mimicking tip_transactions structure)
CREATE TABLE public.creator_product_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  creator_product_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  currency character(3) NOT NULL DEFAULT 'usd'::bpchar,
  payment_provider text NULL,
  payment_intent_id text NULL,
  status text NOT NULL DEFAULT 'succeeded'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  provider_transaction_reference text NULL,
  provider_specific_details jsonb NULL,
  creator_share_cents integer,
  platform_share_cents integer,
  shipping_address jsonb NULL,
  CONSTRAINT creator_product_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT creator_product_transactions_payment_intent_id_key UNIQUE (payment_intent_id),
  CONSTRAINT creator_product_transactions_creator_product_id_fkey FOREIGN KEY (creator_product_id) REFERENCES creator_products(id) ON DELETE CASCADE,
  CONSTRAINT creator_product_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT chk_creator_product_shares_match_amount CHECK (creator_share_cents + platform_share_cents = amount_cents),
  CONSTRAINT chk_creator_product_amount_positive CHECK (amount_cents > 0)
) TABLESPACE pg_default;

-- Create indexes for creator_product_transactions
CREATE INDEX IF NOT EXISTS idx_creator_product_transactions_user_id ON public.creator_product_transactions USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_creator_product_transactions_creator_product_id ON public.creator_product_transactions USING btree (creator_product_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_creator_product_transactions_payment_intent_id ON public.creator_product_transactions USING btree (payment_intent_id) TABLESPACE pg_default;

-- Create creator_product_orders table
CREATE TABLE public.creator_product_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  creator_product_id uuid NOT NULL,
  user_id uuid NOT NULL,
  creator_product_transaction_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  order_status text NOT NULL DEFAULT 'pending'::text,
  shipping_address jsonb NULL,
  tracking_number text NULL,
  estimated_delivery_date date NULL,
  actual_delivery_date date NULL,
  notes text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT creator_product_orders_pkey PRIMARY KEY (id),
  CONSTRAINT creator_product_orders_creator_product_id_fkey FOREIGN KEY (creator_product_id) REFERENCES creator_products(id) ON DELETE CASCADE,
  CONSTRAINT creator_product_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT creator_product_orders_transaction_id_fkey FOREIGN KEY (creator_product_transaction_id) REFERENCES creator_product_transactions(id) ON DELETE CASCADE,
  CONSTRAINT chk_creator_product_order_quantity_positive CHECK (quantity > 0)
) TABLESPACE pg_default;

-- Create indexes for creator_product_orders
CREATE INDEX IF NOT EXISTS idx_creator_product_orders_creator_product_id ON public.creator_product_orders USING btree (creator_product_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_creator_product_orders_user_id ON public.creator_product_orders USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_creator_product_orders_transaction_id ON public.creator_product_orders USING btree (creator_product_transaction_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_creator_product_orders_status ON public.creator_product_orders USING btree (order_status) TABLESPACE pg_default;

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Create storage policy for product images (allow authenticated users to upload)
CREATE POLICY "Allow authenticated users to upload product images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- Create storage policy for product images (allow public read access)
CREATE POLICY "Allow public read access to product images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

-- Create storage policy for product images (allow users to update their own images)
CREATE POLICY "Allow users to update their own product images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage policy for product images (allow users to delete their own images)
CREATE POLICY "Allow users to delete their own product images" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]); 