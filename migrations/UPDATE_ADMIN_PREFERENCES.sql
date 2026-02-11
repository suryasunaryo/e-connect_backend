-- ============================================================================
-- UPDATE: Reset Admin Preferences for New Layout
-- ============================================================================

-- 1. Get the admin user ID (assuming username is 'admin')
SET @admin_id = (SELECT id FROM users WHERE username = 'admin' LIMIT 1);

-- 2. Delete existing preferences for admin to force a reset to defaults
--    (The backend controller logic `getUserCardPreferences` will automatically 
--     re-populate with the new default set from dashboard_cards when they next load the dashboard)
DELETE FROM user_dashboard_preferences WHERE user_id = @admin_id;

-- Alternatively, if we want to force reset for ALL users to ensure everyone sees the new layout:
-- DELETE FROM user_dashboard_preferences; 

-- 3. Verify defaults in dashboard_cards are correct for the new layout
SELECT card_key, card_name, default_visible, display_order 
FROM dashboard_cards 
ORDER BY display_order;

-- ============================================================================
-- NOTE: After running this, the admin user just needs to refresh their dashboard.
-- The getUserCardPreferences controller will detect no prefs and insert the defaults:
-- 1. welcome_banner
-- 2. latest_news
-- 3. upcoming_schedule_events
-- 4. calendar_widget
-- 5. whos_online
-- ...
-- ============================================================================
