-- Fix employees table: Add AUTO_INCREMENT to id column
-- Run this SQL script in your MySQL client or phpMyAdmin

-- First, check current structure
SHOW CREATE TABLE employees;

-- Fix: Modify id column to be AUTO_INCREMENT
ALTER TABLE employees 
MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;

-- Verify the fix
SHOW CREATE TABLE employees;

-- Test: Try inserting a record (this should work now)
-- DELETE FROM employees WHERE nik = 'TEST001'; -- cleanup if exists
-- INSERT INTO employees (
--   full_name, nik, barcode, branch_id, position_id, title_id, gender, marital_status
-- ) VALUES (
--   'Test Employee', 'TEST001', 'BC001', 1, 1, 1, 'M', 'Single'
-- );
