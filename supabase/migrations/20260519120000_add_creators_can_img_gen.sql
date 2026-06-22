ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS can_img_gen boolean NOT NULL DEFAULT false;
