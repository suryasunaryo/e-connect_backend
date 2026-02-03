-- ============================================================================
-- MIGRATION: Update Work Calendar Event Types
-- ============================================================================
-- This script updates the work_calendar table to use new event types
-- and creates the event_colors table for color customization
--
-- IMPORTANT: Run this script in your MySQL database (e.g., phpMyAdmin, MySQL Workbench)
-- ============================================================================

-- Step 1: Backup existing data (optional but recommended)
-- CREATE TABLE work_calendar_backup AS SELECT * FROM work_calendar;

-- Step 2: Soft-delete all existing records (they use old ENUM values)
UPDATE work_calendar 
SET deleted_at = CURRENT_TIMESTAMP 
WHERE deleted_at IS NULL;

-- Step 3: Drop the unique constraint temporarily
ALTER TABLE work_calendar DROP INDEX unique_date;

-- Step 4: Update the type column with new ENUM values
ALTER TABLE work_calendar 
MODIFY COLUMN type ENUM(
  'company_anniversary', 
  'replacement_workday', 
  'replacement_holiday', 
  'sto_audit',
  'other'
) NOT NULL;

-- Step 5: Re-add the unique constraint
ALTER TABLE work_calendar ADD UNIQUE KEY unique_date (date);

-- Step 6: Verify the change
SHOW COLUMNS FROM work_calendar LIKE 'type';

-- Step 7: Create event_colors table
CREATE TABLE IF NOT EXISTS event_colors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_type ENUM(
    'company_anniversary', 
    'replacement_workday', 
    'replacement_holiday', 
    'sto_audit', 
    'national_holiday', 
    'cuti_bersama',
    'other'
  ) NOT NULL UNIQUE,
  color VARCHAR(7) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Step 8: Insert default colors
INSERT IGNORE INTO event_colors (event_type, color) VALUES
('company_anniversary', '#8B5CF6'),
('replacement_workday', '#3B82F6'),
('replacement_holiday', '#F59E0B'),
('sto_audit', '#10B981'),
('national_holiday', '#EF4444'),
('cuti_bersama', '#F97316'),
('other', '#F97316');

-- Step 9: Verify event_colors
SELECT * FROM event_colors ORDER BY event_type;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- You can now use the Work Calendar with new event types!
-- Old records were soft-deleted but can be restored if needed.
-- ============================================================================
