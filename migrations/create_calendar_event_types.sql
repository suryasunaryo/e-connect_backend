-- Create table for Dynamic Event Types
CREATE TABLE IF NOT EXISTS `calendar_event_types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL UNIQUE,
  `name` varchar(100) NOT NULL,
  `category` varchar(50) DEFAULT 'General',
  `color` varchar(20) DEFAULT '#3B82F6',
  `description` text DEFAULT NULL,
  `auto_target_type` enum('all','personal','user','department','branch','role','position') DEFAULT NULL,
  `auto_target_value` text DEFAULT NULL,
  `is_active` boolean DEFAULT TRUE,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed initial data matching existing types
INSERT INTO `calendar_event_types` (`code`, `name`, `category`, `color`, `is_active`) VALUES
('company_anniversary', 'HUT Perusahaan', 'Perusahaan', '#3B82F6', 1),
('replacement_workday', 'Hari Kerja Pengganti', 'Operasional', '#854D0E', 1),
('replacement_holiday', 'Hari Libur Pengganti', 'Operasional', '#D946EF', 1),
('sto_audit', 'Audit STO', 'Audit', '#EAB308', 1),
('other', 'Event Lainnya', 'Umum', '#22C55E', 1)
ON DUPLICATE KEY UPDATE `color`=VALUES(`color`);

-- Optional: Migrate existing custom colors if any (assuming event_colors table exists)
-- UPDATE calendar_event_types cet 
-- JOIN event_colors ec ON cet.code = ec.event_type 
-- SET cet.color = ec.color;
