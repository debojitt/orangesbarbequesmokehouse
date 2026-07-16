# Orange's Barbeque Smoke House — Full Rebrand + Arcade Game

## 1. Rebrand INARA → Orange's Barbeque Smoke House

- Update brand name everywhere: `index.html` (title, meta, OG), header, splash/shimmer, footer, staff portal, loyalty pages, review page.
- Refresh color accents to a warm smoky orange + charcoal palette (kept as design tokens in `index.css` and `tailwind.config.ts`), preserving the existing light iOS aesthetic and frosted-glass nav.
- Update the shimmer/loading text on `Index.tsx` from "INARA" to "ORANGE'S BBQ".
- Update `Powered by JorhatStays` footer wording stays (per memory rule).

## 2. Menu wipe + re-seed from the PDF

- Migration: `DELETE FROM gallery_images; DELETE FROM item_variants; DELETE FROM menu_items; DELETE FROM categories;` (in that order to respect FKs), then insert fresh data.
- New categories: Pasta, Soups, Starters, Pizzas & Burgers, Seafood, Signature Platters & Combos, Buffet, Mocktails & Drinks.
- Insert all ~35 items from PDF with exact prices, descriptions, veg/non-veg flags.
- Items with dual pricing (Veg/Chicken, Reg/Lrg) will use `item_variants` (already in schema).
- Loyalty rewards config unchanged in logic, but the "free item at visit N" labels updated to BBQ-appropriate rewards (e.g. free Virgin Mojito, free Garlic Bread).

## 3. Admin PIN → 7777

- Update `ADMIN_PIN` secret to `7777` via `set_secret`.
- Also insert/update a staff row so PIN login (`StaffLogin.tsx` → `staff` table) accepts `7777` with admin role.

## 4. AI craving search — keep the existing free stack

- Existing `ai-craving` edge function already uses Lovable AI Gateway (free tier, Google Gemini) with a smart keyword fallback and Pollinations.ai (open-source, no key) for image generation. This already satisfies "open source / free" — no key changes needed. Only the menu content changes.

## 5. Arcade mini-game — "BBQ Runner"

New route `/game` and a floating "🎮 Play & Earn" button on `Cart.tsx` (so guests can play while waiting for orders).

**Gameplay (mobile-first, rigid, smooth):**
- Chrome-dino style side-scroller on HTML `<canvas>`, 60fps with `requestAnimationFrame`.
- Character = a running chef; obstacles = fire flames, knives, chilli peppers; collectibles = coins (score) and food pickups.
- Controls: tap anywhere to jump, swipe down to duck. Desktop: Space/↑ to jump, ↓ to duck.
- Rigid mobile UI: full-viewport `100dvh`, safe-area insets, no zoom, haptic buzz on jump/hit (uses existing `haptics.ts`).
- States: **Menu → Playing → Game Over** with buttons: Play, Play Again, Back to Menu, View Leaderboard, View Rewards. All modal-style with the app's glass panel styling.
- Difficulty ramps: speed + obstacle frequency scale with score.

**Rewards ladder (persistent per customer via `customers.phone`):**
- 100 pts → Free Dessert coupon
- 250 pts → Free Garlic Bread
- 500 pts → Free Mocktail (Virgin Mojito)
- 1000 pts → 10% off next visit
- Reward auto-unlocked once high score crosses threshold; shown as a coupon QR on `/loyalty` page.

**Leaderboard with Assamese names:**
- New table `game_scores(id, customer_id nullable, display_name, score, created_at)` with public read + insert.
- Top 10 all-time + top 10 this week.
- Seed leaderboard with authentic Assamese names (Anindita, Bhaskar, Chayanika, Dhritiman, Eeshan, Gitanjali, Hirakjyoti, Jonaki, Kaustav, Manashi, Nabajit, Pallabi, Rituraj, Simanta, Trishna, etc.).
- Player prompted for display name on first score submit (autofilled from loyalty card name if available).

**Reward claim flow:**
- On threshold cross, in-game popup: "You unlocked a Free Mocktail!" → auto-saved as coupon on their customer profile → staff verifies at counter via PIN.

## 6. Files touched

**New:**
- `src/pages/Game.tsx` — game host + menu/gameover modals + leaderboard/rewards tabs
- `src/components/game/BBQRunner.tsx` — canvas engine
- `src/components/game/GameLeaderboard.tsx`
- `src/components/game/GameRewards.tsx`
- `src/lib/game-rewards.ts` — reward thresholds + unlock logic
- Migrations: menu wipe/reseed, `game_scores`, `game_rewards` tables

**Edited:**
- `index.html` — title, meta, brand
- `src/index.css`, `tailwind.config.ts` — orange/smoke tokens
- `src/pages/Index.tsx` — shimmer text, brand
- `src/components/MenuHeader.tsx`, footer, staff pages — brand
- `src/pages/Cart.tsx` — "Play & Earn while you wait" CTA
- `src/App.tsx` — `/game` route

## 7. Order of execution

1. Approve plan → apply migrations (menu wipe + reseed, game tables).
2. Set `ADMIN_PIN=7777` + upsert staff row.
3. Rebrand text/colors.
4. Build game (canvas + UI).
5. Kick off image generation for new menu items via the existing `ai-craving` bulk endpoint (runs async in background).

## Notes

- Image generation for ~35 items runs in the background after code ships; each image takes ~5s so total ≈3 min. Users see items instantly with placeholder illustrations; images fill in as they generate.
- Loyalty QR / roulette / staff dashboards keep working — only branding + reward labels change.
- Cart approximate-total and ₹150 surcharge >₹800 rules preserved.
