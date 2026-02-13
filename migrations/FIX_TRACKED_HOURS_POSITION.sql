-- ============================================================================
-- FIX: Adjust TrackedHours Widget Position
-- ============================================================================
-- This script fixes the overlapping issue between TrackedHours and StatsRow
-- by adjusting the default Y position of TrackedHours widget
-- ============================================================================

-- Step 1: View current layout positions
SELECT card_key, card_name, default_x, default_y, default_w, default_h
FROM dashboard_cards
WHERE card_key IN ('tracked_hours', 'stats_row', 'quick_stats')
ORDER BY default_y, default_x;

-- Step 2: Update TrackedHours position to be below StatsRow
-- Assuming StatsRow is at Y=1 with height 2, we'll place TrackedHours at Y=3
UPDATE dashboard_cards
SET 
    default_x = 0,
    default_y = 3,
    default_w = 4,
    default_h = 4,
    default_visible = TRUE
WHERE card_key = 'tracked_hours';

-- Step 3: Also update StatsRow/QuickStats to ensure it's at the top
UPDATE dashboard_cards
SET 
    default_x = 0,
    default_y = 1,
    default_w = 12,
    default_h = 2
WHERE card_key IN ('stats_row', 'quick_stats');

-- Step 4: Update existing user preferences to match new positions
-- This will move TrackedHours down for all users who have it visible
UPDATE user_dashboard_preferences udp
JOIN dashboard_cards dc ON udp.card_id = dc.id
SET 
    udp.y = 3,
    udp.x = 0,
    udp.w = 4,
    udp.h = 4
WHERE dc.card_key = 'tracked_hours';

-- Step 5: Update StatsRow positions for existing users
UPDATE user_dashboard_preferences udp
JOIN dashboard_cards dc ON udp.card_id = dc.id
SET 
    udp.y = 1,
    udp.x = 0,
    udp.w = 12,
    udp.h = 2
WHERE dc.card_key IN ('stats_row', 'quick_stats');

-- Step 6: Verify the changes
SELECT 
    dc.card_key, 
    dc.card_name, 
    dc.default_x, 
    dc.default_y, 
    dc.default_w, 
    dc.default_h,
    dc.default_visible
FROM dashboard_cards dc
WHERE dc.card_key IN ('tracked_hours', 'stats_row', 'quick_stats', 'welcome_banner')
ORDER BY dc.default_y, dc.default_x;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Changes made:
-- 1. Moved TrackedHours to Y=3 (below StatsRow)
-- 2. Ensured StatsRow is at Y=1 with full width (12 columns)
-- 3. Updated all existing user preferences to match new positions
-- ============================================================================
