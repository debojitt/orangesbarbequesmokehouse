
-- Create staff role enum
CREATE TYPE public.staff_role AS ENUM ('admin', 'staff');

-- Create discount type enum
CREATE TYPE public.discount_type AS ENUM ('percentage', 'combo', 'time_based');

-- Create discount target enum
CREATE TYPE public.discount_target AS ENUM ('item', 'category', 'all');

-- Create reward type enum
CREATE TYPE public.reward_type AS ENUM ('roulette', 'guaranteed');

-- 1. Staff table
CREATE TABLE public.staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  role staff_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read all staff" ON public.staff FOR SELECT USING (true);

-- 2. Categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Staff can manage categories" ON public.categories FOR ALL USING (true);

-- 3. Menu items table
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  serving_info TEXT,
  base_price NUMERIC NOT NULL DEFAULT 0,
  is_veg BOOLEAN NOT NULL DEFAULT true,
  is_bestseller BOOLEAN NOT NULL DEFAULT false,
  is_chef_special BOOLEAN NOT NULL DEFAULT false,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_daily_special BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view menu items" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Staff can manage menu items" ON public.menu_items FOR ALL USING (true);

-- 4. Item variants table
CREATE TABLE public.item_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  serves_count INTEGER DEFAULT 1
);
ALTER TABLE public.item_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view variants" ON public.item_variants FOR SELECT USING (true);
CREATE POLICY "Staff can manage variants" ON public.item_variants FOR ALL USING (true);

-- 5. Gallery images table
CREATE TABLE public.gallery_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES public.staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view gallery" ON public.gallery_images FOR SELECT USING (true);
CREATE POLICY "Staff can manage gallery" ON public.gallery_images FOR ALL USING (true);

-- 6. Customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_visit TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Anyone can create customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff can manage customers" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Staff can delete customers" ON public.customers FOR DELETE USING (true);

-- 7. Loyalty cards table
CREATE TABLE public.loyalty_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  visit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '3 months'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  qr_code TEXT
);
ALTER TABLE public.loyalty_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view loyalty cards" ON public.loyalty_cards FOR SELECT USING (true);
CREATE POLICY "Anyone can create loyalty cards" ON public.loyalty_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff can manage loyalty cards" ON public.loyalty_cards FOR ALL USING (true);

-- 8. Loyalty visits table
CREATE TABLE public.loyalty_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loyalty_card_id UUID NOT NULL REFERENCES public.loyalty_cards(id) ON DELETE CASCADE,
  visit_number INTEGER NOT NULL,
  reward_type reward_type,
  reward_result TEXT,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  recorded_by UUID REFERENCES public.staff(id)
);
ALTER TABLE public.loyalty_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view loyalty visits" ON public.loyalty_visits FOR SELECT USING (true);
CREATE POLICY "Staff can manage loyalty visits" ON public.loyalty_visits FOR ALL USING (true);

-- 9. Loyalty rewards config table
CREATE TABLE public.loyalty_rewards_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_number INTEGER NOT NULL UNIQUE,
  reward_type reward_type NOT NULL,
  rigged_result TEXT NOT NULL,
  reward_description TEXT,
  max_discount_value NUMERIC DEFAULT 0
);
ALTER TABLE public.loyalty_rewards_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view rewards config" ON public.loyalty_rewards_config FOR SELECT USING (true);
CREATE POLICY "Staff can manage rewards config" ON public.loyalty_rewards_config FOR ALL USING (true);

-- 10. Discounts table
CREATE TABLE public.discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type discount_type NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  applies_to discount_target NOT NULL DEFAULT 'all',
  target_id UUID,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active discounts" ON public.discounts FOR SELECT USING (true);
CREATE POLICY "Staff can manage discounts" ON public.discounts FOR ALL USING (true);

-- 11. Feedback table
CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  message TEXT,
  ai_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view feedback" ON public.feedback FOR SELECT USING (true);
CREATE POLICY "Anyone can create feedback" ON public.feedback FOR INSERT WITH CHECK (true);

-- 12. Item selections (popularity tracking)
CREATE TABLE public.item_selections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  selected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.item_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view selections" ON public.item_selections FOR SELECT USING (true);
CREATE POLICY "Anyone can create selections" ON public.item_selections FOR INSERT WITH CHECK (true);

-- 13. AI cravings log
CREATE TABLE public.ai_cravings_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id),
  query TEXT NOT NULL,
  suggestions JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_cravings_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view cravings log" ON public.ai_cravings_log FOR SELECT USING (true);
CREATE POLICY "Anyone can create cravings log" ON public.ai_cravings_log FOR INSERT WITH CHECK (true);

-- Insert default loyalty rewards config
INSERT INTO public.loyalty_rewards_config (visit_number, reward_type, rigged_result, reward_description, max_discount_value) VALUES
(1, 'guaranteed', 'welcome', 'Welcome! First visit recorded', 0),
(2, 'roulette', '30_percent_off', '30% OFF (up to ₹400)', 400),
(3, 'roulette', '10_percent_off', '10% OFF', 0),
(4, 'roulette', 'better_luck', 'Better Luck Next Time', 0),
(5, 'guaranteed', 'combo_299', 'Any meal combo for ₹299', 299),
(6, 'roulette', 'better_luck', 'Better Luck Next Time', 0),
(7, 'guaranteed', 'free_meal', 'FREE MEAL (up to ₹500)', 500);

-- Create gallery storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('gallery', 'gallery', true);

CREATE POLICY "Anyone can view gallery images" ON storage.objects FOR SELECT USING (bucket_id = 'gallery');
CREATE POLICY "Staff can upload gallery images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'gallery');
CREATE POLICY "Staff can delete gallery images" ON storage.objects FOR DELETE USING (bucket_id = 'gallery');
