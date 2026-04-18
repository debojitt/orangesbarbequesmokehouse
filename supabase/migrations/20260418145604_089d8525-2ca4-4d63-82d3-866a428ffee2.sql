-- Add is_redeemed flag for guaranteed rewards
ALTER TABLE public.loyalty_cards
ADD COLUMN IF NOT EXISTS is_redeemed boolean NOT NULL DEFAULT false;

-- Speed up phone lookups
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_customer ON public.loyalty_cards(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_visits_card ON public.loyalty_visits(loyalty_card_id);

-- Refresh rewards config to match the restaurant spec
DELETE FROM public.loyalty_rewards_config;

INSERT INTO public.loyalty_rewards_config (visit_number, reward_type, rigged_result, reward_description, max_discount_value) VALUES
  (1, 'guaranteed', 'welcome', 'Welcome! First visit recorded', 0),
  (2, 'roulette', '20_percent_off', '20% OFF your bill (up to ₹300)', 300),
  (3, 'roulette', 'free_dessert', 'FREE Dessert of the Day', 0),
  (4, 'roulette', 'better_luck', 'Better Luck Next Time', 0),
  (5, 'guaranteed', 'starter_mocktail', 'FREE Starter + Mocktail Combo', 0),
  (6, 'roulette', 'better_luck', 'Better Luck Next Time', 0),
  (7, 'guaranteed', 'free_meal_for_two', 'FREE MEAL FOR TWO (up to ₹1,200)', 1200);