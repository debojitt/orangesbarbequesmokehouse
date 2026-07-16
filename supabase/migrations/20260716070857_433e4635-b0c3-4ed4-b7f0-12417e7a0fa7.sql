
-- Game tables for BBQ Runner
CREATE TABLE public.game_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.game_scores TO anon, authenticated;
GRANT ALL ON public.game_scores TO service_role;
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view scores" ON public.game_scores FOR SELECT USING (true);
CREATE POLICY "Anyone can insert scores" ON public.game_scores FOR INSERT WITH CHECK (true);
CREATE INDEX idx_game_scores_score_desc ON public.game_scores (score DESC, created_at DESC);
CREATE INDEX idx_game_scores_created ON public.game_scores (created_at DESC);

CREATE TABLE public.game_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  threshold INTEGER NOT NULL,
  reward_label TEXT NOT NULL,
  is_claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, threshold)
);
GRANT SELECT, INSERT, UPDATE ON public.game_rewards TO anon, authenticated;
GRANT ALL ON public.game_rewards TO service_role;
ALTER TABLE public.game_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view rewards" ON public.game_rewards FOR SELECT USING (true);
CREATE POLICY "Anyone can insert rewards" ON public.game_rewards FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update rewards" ON public.game_rewards FOR UPDATE USING (true) WITH CHECK (true);
CREATE INDEX idx_game_rewards_customer ON public.game_rewards (customer_id);
