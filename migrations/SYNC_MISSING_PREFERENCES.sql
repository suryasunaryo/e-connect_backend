-- ============================================================================
-- SYNC: Insert Missing Dashboard Cards for All Users
-- ============================================================================
-- This script ensures that when we add NEW cards (like welcome_banner), 
-- existing users who already have preferences still get these new cards added 
-- to their preferences with default settings.
-- ============================================================================

INSERT INTO user_dashboard_preferences (user_id, card_id, is_visible, display_order)
SELECT u.id, dc.id, dc.default_visible, dc.display_order
FROM users u
CROSS JOIN dashboard_cards dc
WHERE NOT EXISTS (
    SELECT 1 
    FROM user_dashboard_preferences udp 
    WHERE udp.user_id = u.id 
      AND udp.card_id = dc.id
);

-- Output verification
SELECT 
    u.username, 
    COUNT(udp.id) as total_widgets
FROM users u
JOIN user_dashboard_preferences udp ON u.id = udp.user_id
GROUP BY u.username;
