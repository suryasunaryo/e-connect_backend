ALTER TABLE work_calendar 
MODIFY COLUMN type ENUM('company_anniversary', 'replacement_workday', 'replacement_holiday', 'sto_audit', 'other') NOT NULL;
