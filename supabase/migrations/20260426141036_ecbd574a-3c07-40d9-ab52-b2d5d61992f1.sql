
-- 1. App-wide settings (key/value), used for global image hide flag
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Staff can manage settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.app_settings (key, value) VALUES ('images_hidden_global', '{"value": false}'::jsonb);

-- 2. Per-item image hide
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image_hidden BOOLEAN NOT NULL DEFAULT false;

-- 3. Editable roulette prize tiles (replaces hardcoded list in OfferRoulette)
CREATE TABLE public.roulette_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  winning_label TEXT NOT NULL,
  is_better_luck BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.roulette_prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view roulette prizes" ON public.roulette_prizes FOR SELECT USING (true);
CREATE POLICY "Staff can manage roulette prizes" ON public.roulette_prizes FOR ALL USING (true) WITH CHECK (true);

-- Seed existing 6 tiles to keep current behavior
INSERT INTO public.roulette_prizes (label, winning_label, is_better_luck, display_order) VALUES
('20% OFF your bill', '20% OFF your bill (up to ₹300)', false, 1),
('FREE Dessert of the Day', 'FREE Dessert of the Day', false, 2),
('FREE Mocktail', 'FREE Mocktail', false, 3),
('₹100 OFF', '₹100 OFF', false, 4),
('Better Luck Next Time', 'Better Luck Next Time', true, 5),
('FREE Starter', 'FREE Starter', false, 6);

-- 4. Per-card override: pre-pick the next roulette outcome for a specific guest
ALTER TABLE public.loyalty_cards
  ADD COLUMN IF NOT EXISTS next_roulette_prize_id UUID REFERENCES public.roulette_prizes(id) ON DELETE SET NULL;
