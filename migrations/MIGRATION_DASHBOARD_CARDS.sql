-- ============================================================================
-- MIGRATION: Dashboard Card Preferences
-- ============================================================================
-- This script creates tables for storing user dashboard card preferences
-- allowing each user to customize which cards they want to display
--
-- IMPORTANT: Run this script in your MySQL database (e.g., phpMyAdmin, MySQL Workbench)
-- ============================================================================

-- Step 1: Create dashboard_cards table (master list of available cards)
CREATE TABLE IF NOT EXISTS dashboard_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_key VARCHAR(50) NOT NULL UNIQUE COMMENT 'Unique identifier for the card (e.g., tracked_hours, upcoming_events)',
  card_name VARCHAR(100) NOT NULL COMMENT 'Display name of the card',
  card_description TEXT COMMENT 'Description of what the card shows',
  card_category ENUM('fixed', 'optional') NOT NULL DEFAULT 'optional' COMMENT 'Whether card is always shown or optional',
  default_visible BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Default visibility for new users',
  display_order INT NOT NULL DEFAULT 0 COMMENT 'Default display order',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Create user_dashboard_preferences table (user-specific card settings)
CREATE TABLE IF NOT EXISTS user_dashboard_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT 'Reference to users table',
  card_id INT NOT NULL COMMENT 'Reference to dashboard_cards table',
  is_visible BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether user wants to see this card',
  display_order INT NOT NULL DEFAULT 0 COMMENT 'User custom order for this card',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_card (user_id, card_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (card_id) REFERENCES dashboard_cards(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_card_id (card_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 3: Insert default dashboard cards
INSERT INTO dashboard_cards (card_key, card_name, card_description, card_category, default_visible, display_order) VALUES
-- Fixed cards (always shown)
('welcome_card', 'Welcome Card', 'Personalized greeting and quick actions', 'fixed', TRUE, 1),
('upcoming_holidays', 'Upcoming Holidays', 'Shows upcoming holidays and time off', 'fixed', TRUE, 2),

-- Optional cards (can be toggled)
('tracked_hours', 'Tracked Hours', 'Shows worked hours and breaks for the day', 'optional', TRUE, 3),
('team_attendance', 'Team Attendance', 'Overview of team attendance status', 'optional', TRUE, 4),
('pending_approvals', 'Pending Approvals', 'Shows pending leave or overtime approvals', 'optional', FALSE, 5),
('recent_activities', 'Recent Activities', 'Recent system activities and updates', 'optional', FALSE, 6),
('quick_stats', 'Quick Statistics', 'Key metrics and statistics overview', 'optional', TRUE, 7),
('announcements', 'Announcements', 'Company announcements and news', 'optional', TRUE, 8);

-- Step 4: Verify the tables
SHOW TABLES LIKE 'dashboard%';
SELECT * FROM dashboard_cards ORDER BY display_order;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created:
-- 1. dashboard_cards - Master list of available dashboard cards
-- 2. user_dashboard_preferences - User-specific card visibility preferences
--
-- Usage:
-- - When a user first accesses dashboard, create preferences based on defaults
-- - Users can toggle card visibility through dashboard settings
-- - Each user can have different cards visible based on their role/needs
-- ============================================================================
