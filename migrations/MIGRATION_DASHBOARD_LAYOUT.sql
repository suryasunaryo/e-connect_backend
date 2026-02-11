-- ============================================================================
-- MIGRATION: Dashboard Layout Update
-- ============================================================================
-- This script updates existing dashboard cards and adds new ones for the
-- improved dashboard layout
--
-- IMPORTANT: Run this script in your MySQL database (e.g., phpMyAdmin, MySQL Workbench)
-- ============================================================================

-- Step 1: Update existing card names for clarity
UPDATE dashboard_cards 
SET card_key = 'latest_news',
    card_name = 'Latest News',
    card_description = 'Shows latest company news and announcements',
    display_order = 2
WHERE card_key = 'welcome_card';

UPDATE dashboard_cards 
SET card_key = 'upcoming_schedule_events',
    card_name = 'Upcoming Schedule Events',
    card_description = 'Shows upcoming scheduled events and holidays',
    display_order = 3
WHERE card_key = 'upcoming_holidays';

-- Step 2: Hide tracked_hours by default (no logic yet)
UPDATE dashboard_cards 
SET default_visible = FALSE,
    display_order = 10
WHERE card_key = 'tracked_hours';

-- Step 3: Add new dashboard cards
INSERT INTO dashboard_cards (card_key, card_name, card_description, card_category, default_visible, display_order) VALUES
-- Welcome Banner (full width at top)
('welcome_banner', 'Welcome Banner', 'Personalized greeting banner with user info and pending tasks', 'fixed', TRUE, 1),

-- Calendar Widget (right sidebar)
('calendar_widget', 'Calendar', 'Monthly calendar view with event indicators', 'optional', TRUE, 4),

-- Who's Online (right sidebar)
('whos_online', 'Who\'s Online', 'Real-time list of currently logged-in users', 'optional', TRUE, 5)
ON DUPLICATE KEY UPDATE
  card_name = VALUES(card_name),
  card_description = VALUES(card_description),
  card_category = VALUES(card_category),
  default_visible = VALUES(default_visible),
  display_order = VALUES(display_order);

-- Step 4: Update existing user preferences to match new card keys
-- This updates the card_id reference when card_key changes
UPDATE user_dashboard_preferences udp
JOIN dashboard_cards dc ON udp.card_id = dc.id
SET udp.card_id = (SELECT id FROM dashboard_cards WHERE card_key = 'latest_news')
WHERE dc.card_key = 'welcome_card';

UPDATE user_dashboard_preferences udp
JOIN dashboard_cards dc ON udp.card_id = dc.id
SET udp.card_id = (SELECT id FROM dashboard_cards WHERE card_key = 'upcoming_schedule_events')
WHERE dc.card_key = 'upcoming_holidays';

-- Step 5: Verify the changes
SELECT card_key, card_name, card_category, default_visible, display_order 
FROM dashboard_cards 
ORDER BY display_order;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Changes made:
-- 1. Renamed welcome_card → latest_news
-- 2. Renamed upcoming_holidays → upcoming_schedule_events
-- 3. Hidden tracked_hours by default
-- 4. Added welcome_banner, calendar_widget, whos_online
-- 5. Updated user preferences to maintain continuity
-- ============================================================================
