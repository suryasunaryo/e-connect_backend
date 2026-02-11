-- ============================================================================
-- ADD NEW WIDGETS: Stats, Task Stats, Star Employee
-- ============================================================================

INSERT INTO dashboard_cards (card_key, card_name, card_description, card_category, default_visible, display_order)
VALUES 
('stats_row', 'Quick Stats', 'Display key metrics like Total Employee, Present, Late', 'fixed', 1, 1),
('task_statistics', 'Task Statistics', 'Donut chart of task statuses', 'fixed', 1, 2),
('star_employee', 'Star Employee', 'List of top performing employees', 'fixed', 1, 3)
ON DUPLICATE KEY UPDATE 
card_name = VALUES(card_name),
display_order = VALUES(display_order);

-- Re-order existing cards to make room/flow better
UPDATE dashboard_cards SET display_order = 10 WHERE card_key = 'welcome_banner'; 
-- Actually, let's just make sure they exist. The layout order is handled in frontend mainly, 
-- but display_order helps with the default list.

-- Insert into user_dashboard_preferences for ALL users
INSERT INTO user_dashboard_preferences (user_id, card_id, is_visible, display_order)
SELECT u.id, dc.id, dc.default_visible, dc.display_order
FROM users u
CROSS JOIN dashboard_cards dc
WHERE dc.card_key IN ('stats_row', 'task_statistics', 'star_employee')
  AND NOT EXISTS (
    SELECT 1 
    FROM user_dashboard_preferences udp 
    WHERE udp.user_id = u.id 
      AND udp.card_id = dc.id
);
