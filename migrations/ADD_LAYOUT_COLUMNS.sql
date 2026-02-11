-- Add layout columns to user_dashboard_preferences
ALTER TABLE user_dashboard_preferences
ADD COLUMN x INT DEFAULT 0,
ADD COLUMN y INT DEFAULT 0,
ADD COLUMN w INT DEFAULT 12, -- Default full width for mobile safety, desktop usually 4-8
ADD COLUMN h INT DEFAULT 4;  -- Default height

-- Optional: Update defaults for existing cards to reasonable starter layout
-- This logic might be complex in SQL, better handled in app code migration logic
