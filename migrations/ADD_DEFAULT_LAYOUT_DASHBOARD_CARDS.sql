-- Add default layout columns to dashboard_cards
ALTER TABLE dashboard_cards
ADD COLUMN default_x INT DEFAULT 0,
ADD COLUMN default_y INT DEFAULT 0,
ADD COLUMN default_w INT DEFAULT 12,
ADD COLUMN default_h INT DEFAULT 4;

-- Update existing defaults based on known values if possible, 
-- though it's safer to let the admin set them via the UI.
UPDATE dashboard_cards SET default_w = 8, default_h = 4 WHERE card_key IN ('welcome_banner', 'stats_row', 'whos_online');
UPDATE dashboard_cards SET default_w = 4, default_h = 4 WHERE card_key IN ('calendar_widget', 'upcoming_schedule_events', 'latest_news', 'task_statistics', 'star_employee');
