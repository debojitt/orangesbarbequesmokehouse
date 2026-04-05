

# INARA — Digital Restaurant Menu Platform

## Design System
- **Colors**: Matte Black (`#1A1A1A`), Ghost White (`#F8F8F8`), Premium Gold (`#C9A96E`)
- **Style**: Liquid glass morphism (translucent panels with backdrop blur) with sharp corners
- **Typography**: Clean, modern sans-serif. Gold accents for badges and CTAs

---

## DATABASE TABLES (Lovable Cloud / Supabase)

1. **staff** — `id`, `name`, `pin` (hashed), `role` (admin/staff), `created_at`
2. **categories** — `id`, `name`, `display_order`, `icon`, `is_visible`, `created_at`
3. **menu_items** — `id`, `category_id`, `name`, `description`, `serving_info`, `base_price`, `is_veg`, `is_bestseller`, `is_chef_special`, `is_available`, `is_daily_special`, `created_at`
4. **item_variants** — `id`, `menu_item_id`, `name` (Half/Full/Large), `price`, `serves_count`
5. **gallery_images** — `id`, `menu_item_id` (nullable), `image_url`, `caption`, `uploaded_by`, `created_at`
6. **customers** — `id`, `name`, `phone`, `created_at`, `last_visit`
7. **loyalty_cards** — `id`, `customer_id`, `visit_count`, `created_at`, `expires_at`, `is_active`, `qr_code`
8. **loyalty_visits** — `id`, `loyalty_card_id`, `visit_number`, `reward_type`, `reward_result`, `claimed_at`, `recorded_by`
9. **loyalty_rewards_config** — `id`, `visit_number`, `reward_type` (roulette/guaranteed), `rigged_result`, `reward_description`, `max_discount_value`
10. **discounts** — `id`, `name`, `type` (percentage/combo/time-based), `value`, `applies_to` (item/category/all), `target_id`, `start_time`, `end_time`, `is_active`
11. **feedback** — `id`, `customer_id`, `rating`, `message`, `ai_response`, `created_at`
12. **item_selections** — `id`, `menu_item_id`, `selected_at` — tracks popularity for weekly analytics
13. **ai_cravings_log** — `id`, `customer_id`, `query`, `suggestions`, `created_at`

---

## PAGES & FEATURES

### 1. Customer Menu Page (`/`)
- **Top bar**: Restaurant logo "INARA" in gold on black, search bar
- **AI Craving Box**: Prominent glass-morphism card at top — "What are you craving? Tell us and we'll find the best match!" Text input + send button. AI analyzes all menu items and suggests best matches considering budget if mentioned. Shows suggested items as cards with "Add to Cart" buttons
- **Category Tabs**: Horizontally scrollable tabs (Snacks, Full Course, Main Course, Subscribers, Influencers Menu, etc.). First 4 visible, "More" button expands full list in a modal
- **Menu Items Grid**: Each item card shows — Name, Description, Price (with crossed-out original if discounted), Veg/Non-Veg badge (green/red dot), "Chef's Special"/"Bestseller" gold badges, "Add" button. Out-of-stock items greyed out with "Unavailable" label
- **Variant Selection**: When "Add" is tapped on an item with variants, a bottom sheet slides up showing options (Half/Full/Large) with prices and "Serves X" info
- **"Today's Offers"** section at top of menu with active deals highlighted in gold
- **Gallery Link**: Each item has a camera icon — tapping opens photo gallery uploaded by staff
- **Items shuffle** on every page load (randomize order within categories)
- **Footer**: "Powered by JorhatStays • Want a menu for your restaurant? Click here" → links to `https://wa.me/918474038160`

### 2. Cart & Approximate Bill (`/cart`)
- List of added items with quantity controls (+/-)
- **Approximate Bill**: Subtotal shown. If total > ₹800, silently add ₹150 to the displayed "Approximate Total" (this extra is NOT on the physical bill — it's to make customers feel the real bill is a pleasant surprise)
- Active loyalty discount auto-applied with clear label
- Note: "This is an approximate estimate. Your final bill may vary."

### 3. Review Interceptor (`/review`)
- Accessible via a prominent "Review Us ⭐" button on menu
- Shows 5 star rating selector
- **If rating ≥ 5 stars**: Redirects to Google Review page (URL configurable by staff)
- **If rating < 4 stars**: Intercepts — shows a form "We're sorry! May we know what went wrong?" Customer types feedback → AI analyzes the complaint and generates a clever, empathetic response acknowledging the issue. Feedback saved to database and shown on staff dashboard

### 4. Customer Loyalty Page (`/loyalty`)
- Requires phone login (OTP or simple phone entry)
- Shows: Guest name, phone, card ID, QR code
- **Visual 7-step progress tracker** with current position highlighted in gold
- Milestones listed:
  - Before claiming: Mystery text "Win up to a FREE MEAL — depends on your luck! 🍀"
  - After claiming: Actual reward shown (e.g., "✓ Won 30% OFF")
- **"Try Your Luck" Button**: Golden pulsing button appears ONLY on visits 2, 3, 4, 6
  - Opens the **Blinking Roulette**: Vertical list of all offers rapidly cycling/highlighting. Smooth deceleration landing on the rigged result. Celebration animation on win
- **Guaranteed Rewards** (visits 5, 7): Instant celebration popup with confetti
- Card expiry date shown (3 months from creation)

### 5. Staff Login (`/staff/login`)
- PIN-based login (4-6 digit PIN)
- Persistent session — no re-login needed until manual logout
- "Lock" button on dashboard — requires PIN to unlock (for stepping away)

### 6. Staff Dashboard (`/staff/dashboard`)
- **Glass-morphism panels on dark background**
- **Analytics Cards**: Total guests, visits this week, rewards redeemed this month, most selected items (weekly)
- **Feedback Feed**: All intercepted reviews with customer message, AI response, rating, timestamp
- **AI Monitoring Alerts**: AI-generated insights about menu performance sent to dashboard (trending items, items losing popularity, etc.)

### 7. Staff Menu Management (`/staff/menu`)
- **Add/Edit/Delete** menu items with form: Name, description, price, category, veg/non-veg, variants (with serves count), bestseller/chef's special toggles
- **Mark items as Out of Stock** (toggle)
- **Set Daily Specials** (auto-highlighted on customer menu)
- **Category Management**: Create, edit, reorder (drag-and-drop), hide categories
- **Gallery Upload**: Upload food photos per item or general gallery

### 8. Staff Offer Management (`/staff/offers`)
- Create percentage discounts on items/categories
- Create time-based offers (Happy Hour with start/end times)
- Create combo deals with custom pricing
- Enable/disable offers
- Configure Google Review URL

### 9. Staff Loyalty Management (`/staff/loyalty`)
- **Guest List**: Searchable/sortable by name, phone, visit count, last visit, card status
- **Quick Actions**: +Visit (one-tap), View Card, Send WhatsApp Reminder, Restart Card
- **QR Scanner**: Use device camera to scan guest QR code
- **Add New Guest**: Name + phone form
- **Edit Reward Configuration**: Modify what each visit reward gives (the rigged results, discount values, etc.)
- **Visit History**: Full log per guest

### 10. AI Features (Lovable AI powered)
- **Craving Matcher**: Takes customer's description of what they want + optional budget → searches all menu items → suggests best matches and combos within budget
- **Review Responder**: Analyzes negative feedback → generates empathetic, solution-oriented response
- **Menu Monitor**: Periodic analysis of selection data → generates insights for staff dashboard (trending items, underperforming items, suggested combos)

---

## KEY LOGIC

- **Menu shuffle**: On each customer page load, items within each category are randomly ordered
- **Bill inflation**: Cart total > ₹800 → display total + ₹150 as "Approximate Total"
- **Review routing**: Rating ≥ 5 → Google redirect; < 4 → internal AI feedback loop
- **Loyalty roulette**: Predetermined results per visit number, animation is purely visual
- **Persistent customer session**: Phone number stored locally, auto-login on return
- **Staff session**: PIN auth with persistent session, lock/unlock feature

