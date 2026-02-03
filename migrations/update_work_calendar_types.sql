-- Migration script to update work_calendar table with new event types
-- Run this SQL script in your MySQL database

-- Step 1: Drop the unique constraint temporarily
ALTER TABLE work_calendar DROP INDEX unique_date;

-- Step 2: Modify the ENUM column to include new types
ALTER TABLE work_calendar 
MODIFY COLUMN type ENUM(
  'company_anniversary', 
  'replacement_workday', 
  'replacement_holiday', 
  'sto_audit',
  'other'
) NOT NULL;

-- Step 3: Re-add the unique constraint
ALTER TABLE work_calendar ADD UNIQUE KEY unique_date (date);

-- Step 4: Verify the change
SHOW COLUMNS FROM work_calendar LIKE 'type';

-- Step 5: Check if event_colors table exists, if not create it
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

-- Step 6: Insert default colors (will skip if already exists due to UNIQUE constraint)
INSERT IGNORE INTO event_colors (event_type, color) VALUES
('company_anniversary', '#8B5CF6'),
('replacement_workday', '#3B82F6'),
('replacement_holiday', '#F59E0B'),
('sto_audit', '#10B981'),
('national_holiday', '#EF4444'),
('cuti_bersama', '#F97316'),
('other', '#F97316');

-- Step 7: Verify event_colors
SELECT * FROM event_colors;
