-- Performance indexes for loyalty system to handle 1000+ cards per month efficiently

-- Customer lookup by phone (used on every login/card creation)
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

-- Active card lookup by customer (used on every loyalty page load)
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_customer_active 
  ON public.loyalty_cards(customer_id, is_active);

-- Card lookup by QR code (used on staff scan)
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_qr ON public.loyalty_cards(qr_code);

-- Visits by card (used to render the punch card)
CREATE INDEX IF NOT EXISTS idx_loyalty_visits_card 
  ON public.loyalty_visits(loyalty_card_id, visit_number);

-- Rewards config lookup by visit number
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_config_visit 
  ON public.loyalty_rewards_config(visit_number);

-- Expiry sweeps (if you ever batch-expire old cards)
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_expires 
  ON public.loyalty_cards(expires_at) WHERE is_active = true;