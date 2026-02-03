-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               8.0.30 - MySQL Community Server - GPL
-- Server OS:                    Win64
-- HeidiSQL Version:             12.1.0.6537
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for e-connect_db
CREATE DATABASE IF NOT EXISTS `e-connect_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `e-connect_db`;

-- Dumping structure for view e-connect_db.active_trucks
-- Creating temporary table to overcome VIEW dependency errors
CREATE TABLE `active_trucks` (
	`id` INT(10) NOT NULL,
	`license_plate` VARCHAR(50) NULL COLLATE 'utf8mb4_unicode_ci',
	`driver_name` VARCHAR(100) NULL COLLATE 'utf8mb4_unicode_ci',
	`destination` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`status` ENUM('scheduled','checked_in','loading','loaded','checked_out','cancelled') NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`priority` ENUM('low','normal','high','urgent') NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`scheduled_time` DATETIME NOT NULL,
	`check_in_time` DATETIME NULL,
	`dock_number` VARCHAR(20) NULL COLLATE 'utf8mb4_unicode_ci',
	`cargo_type` VARCHAR(100) NULL COLLATE 'utf8mb4_unicode_ci',
	`cargo_weight` DECIMAL(10,2) NULL,
	`current_duration` BIGINT(19) NULL,
	`notes` TEXT NULL COLLATE 'utf8mb4_unicode_ci',
	`special_instructions` TEXT NULL COLLATE 'utf8mb4_unicode_ci',
	`created_by_name` VARCHAR(100) NULL COLLATE 'utf8mb4_unicode_ci'
) ENGINE=MyISAM;

-- Dumping structure for table e-connect_db.activity_logs
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `table_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` int DEFAULT NULL,
  `old_values` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'JSON format old values',
  `new_values` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'JSON format new values',
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_table_name` (`table_name`),
  KEY `idx_record_id` (`record_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.attendance_code
CREATE TABLE IF NOT EXISTS `attendance_code` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code_id` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `detail` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` int DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `code` (`code_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.attendance_employee_shift
CREATE TABLE IF NOT EXISTS `attendance_employee_shift` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `shift_id` int NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `shift_id` (`shift_id`),
  CONSTRAINT `attendance_employee_shift_ibfk_1` FOREIGN KEY (`shift_id`) REFERENCES `attendance_shifts` (`shift_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.attendance_settings
CREATE TABLE IF NOT EXISTS `attendance_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.attendance_shifts
CREATE TABLE IF NOT EXISTS `attendance_shifts` (
  `shift_id` int NOT NULL AUTO_INCREMENT,
  `shift_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `shift_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `break_start` time DEFAULT NULL,
  `break_end` time DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` int DEFAULT NULL,
  PRIMARY KEY (`shift_id`),
  UNIQUE KEY `shift_code` (`shift_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.attendance_shift_rules
CREATE TABLE IF NOT EXISTS `attendance_shift_rules` (
  `rule_id` int NOT NULL AUTO_INCREMENT,
  `shift_id` int NOT NULL,
  `late_tolerance_minutes` int DEFAULT '0',
  `max_late_minutes` int DEFAULT '120',
  `early_leave_tolerance_minutes` int DEFAULT '0',
  `halfday_min_work_minutes` int DEFAULT '240',
  `ot_start_after_minutes` int DEFAULT '30',
  `max_ot_per_day` int DEFAULT '240',
  `required_check_in` int DEFAULT '1',
  `required_check_out` int DEFAULT '1',
  `incomplete_checkclock_rule` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'warning',
  `grace_period_start` time DEFAULT NULL,
  `grace_period_end` time DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` int DEFAULT NULL,
  PRIMARY KEY (`rule_id`),
  KEY `shift_id` (`shift_id`),
  CONSTRAINT `attendance_shift_rules_ibfk_1` FOREIGN KEY (`shift_id`) REFERENCES `attendance_shifts` (`shift_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.branches
CREATE TABLE IF NOT EXISTS `branches` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `branch_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_desc` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `branches_branch_name_unique` (`branch_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.calendar_event_types
CREATE TABLE IF NOT EXISTS `calendar_event_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `category` varchar(50) DEFAULT 'General',
  `color` varchar(20) DEFAULT '#3B82F6',
  `description` text,
  `auto_target_type` varchar(50) DEFAULT NULL,
  `auto_target_value` text,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.dashboard_cards
CREATE TABLE IF NOT EXISTS `dashboard_cards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `card_key` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Unique identifier for the card (e.g., tracked_hours, upcoming_events)',
  `card_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Display name of the card',
  `card_description` text COLLATE utf8mb4_unicode_ci COMMENT 'Description of what the card shows',
  `card_category` enum('fixed','optional') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'optional' COMMENT 'Whether card is always shown or optional',
  `default_visible` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Default visibility for new users',
  `display_order` int NOT NULL DEFAULT '0' COMMENT 'Default display order',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `card_key` (`card_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for view e-connect_db.dashboard_summary
-- Creating temporary table to overcome VIEW dependency errors
CREATE TABLE `dashboard_summary` (
	`total_trucks` BIGINT(19) NOT NULL,
	`scheduled_count` DECIMAL(23,0) NULL,
	`checked_in_count` DECIMAL(23,0) NULL,
	`loading_count` DECIMAL(23,0) NULL,
	`loaded_count` DECIMAL(23,0) NULL,
	`checked_out_count` DECIMAL(23,0) NULL,
	`cancelled_count` DECIMAL(23,0) NULL,
	`avg_duration_minutes` DECIMAL(13,2) NULL,
	`today_trucks` DECIMAL(23,0) NULL
) ENGINE=MyISAM;

-- Dumping structure for table e-connect_db.departments
CREATE TABLE IF NOT EXISTS `departments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `branch_id` bigint unsigned NOT NULL,
  `dept_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `dept_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` bigint unsigned DEFAULT NULL,
  `location` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `departments_branch_id_foreign` (`branch_id`),
  KEY `departments_parent_id_foreign` (`parent_id`),
  CONSTRAINT `departments_branch_id_foreign` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `departments_parent_id_foreign` FOREIGN KEY (`parent_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for view e-connect_db.departments_view
-- Creating temporary table to overcome VIEW dependency errors
CREATE TABLE `departments_view` (
	`department_id` BIGINT(20) UNSIGNED NOT NULL,
	`branch_id` BIGINT(20) UNSIGNED NOT NULL,
	`dept_name` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`dept_code` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`parent_id` BIGINT(20) UNSIGNED NULL,
	`location` INT(10) NULL,
	`branch_name` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`branch_desc` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`parent_name` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`office_name` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`office_address` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci'
) ENGINE=MyISAM;

-- Dumping structure for table e-connect_db.employees
CREATE TABLE IF NOT EXISTS `employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `picture` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nik` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `barcode` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` bigint unsigned NOT NULL,
  `department_id` bigint unsigned DEFAULT NULL,
  `position_id` bigint unsigned NOT NULL,
  `title_id` bigint unsigned NOT NULL,
  `employee_status` enum('Contract','Intern','Permanent','Probationary','Resign','Terminated','Temporary') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contract_count` int NOT NULL DEFAULT '0',
  `join_date` date DEFAULT NULL,
  `effective_date` date DEFAULT NULL,
  `end_effective_date` date DEFAULT NULL,
  `resign_date_rehire` date DEFAULT NULL,
  `religion` enum('Buddhist','Catholic','Christian','Hindu','Moslem') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gender` enum('Female','Male') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `marital_status` enum('Divorced','Married','Single','Widow','Widower') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `place_of_birth` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `office_email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `personal_email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `npwp` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bpjs_tk` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bpjs_health` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ktp_number` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rfid_number` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employees_nik_unique` (`nik`),
  UNIQUE KEY `employees_barcode_unique` (`barcode`),
  UNIQUE KEY `employees_office_email_unique` (`office_email`),
  UNIQUE KEY `employees_personal_email_unique` (`personal_email`),
  UNIQUE KEY `employees_npwp_unique` (`npwp`),
  UNIQUE KEY `employees_bpjs_tk_unique` (`bpjs_tk`),
  UNIQUE KEY `employees_bpjs_health_unique` (`bpjs_health`),
  UNIQUE KEY `employees_ktp_number_unique` (`ktp_number`),
  UNIQUE KEY `employees_rfid_number_unique` (`rfid_number`),
  KEY `employees_user_id_foreign` (`user_id`),
  KEY `employees_branch_id_foreign` (`branch_id`),
  KEY `employees_department_id_foreign` (`department_id`),
  KEY `employees_position_id_foreign` (`position_id`),
  KEY `employees_title_id_foreign` (`title_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.event_colors
CREATE TABLE IF NOT EXISTS `event_colors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_type` enum('company_anniversary','replacement_workday','replacement_holiday','sto_audit','national_holiday','cuti_bersama','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `event_type` (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.location
CREATE TABLE IF NOT EXISTS `location` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `office_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `office_address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.migration_history
CREATE TABLE IF NOT EXISTS `migration_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `executed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.national_holidays_cache
CREATE TABLE IF NOT EXISTS `national_holidays_cache` (
  `id` int NOT NULL AUTO_INCREMENT,
  `year` int NOT NULL,
  `date` date NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_national_holiday` tinyint(1) DEFAULT '1',
  `is_cuti_bersama` tinyint(1) DEFAULT '0',
  `fetched_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_year_date` (`year`,`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.news
CREATE TABLE IF NOT EXISTS `news` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cover_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('draft','published','archived') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `publish_at` datetime DEFAULT NULL,
  `close_date` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `allow_comments` tinyint(1) DEFAULT '0',
  `pin_top` tinyint(1) DEFAULT '0',
  `priority` enum('normal','high','urgent') COLLATE utf8mb4_unicode_ci DEFAULT 'normal',
  `view_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `news_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.news_comments
CREATE TABLE IF NOT EXISTS `news_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `news_id` char(36) NOT NULL,
  `user_id` int DEFAULT NULL,
  `comment` text NOT NULL,
  `parent_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_news_id` (`news_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `news_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.news_files
CREATE TABLE IF NOT EXISTS `news_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `news_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_type` enum('image','attachment') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_news_files_news` (`news_id`),
  CONSTRAINT `fk_news_files_news` FOREIGN KEY (`news_id`) REFERENCES `news` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.news_read
CREATE TABLE IF NOT EXISTS `news_read` (
  `id` int NOT NULL AUTO_INCREMENT,
  `news_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `read_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_read` (`news_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `fk_news_read_news` FOREIGN KEY (`news_id`) REFERENCES `news` (`id`) ON DELETE CASCADE,
  CONSTRAINT `news_read_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.news_targets
CREATE TABLE IF NOT EXISTS `news_targets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `news_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_type` enum('all','user','department','role','branch','position') COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_value` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_news_targets_news` (`news_id`),
  CONSTRAINT `fk_news_targets_news` FOREIGN KEY (`news_id`) REFERENCES `news` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.positions
CREATE TABLE IF NOT EXISTS `positions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `branch_id` bigint unsigned NOT NULL,
  `position_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` bigint unsigned DEFAULT NULL,
  `location` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `positions_branch_id_foreign` (`branch_id`),
  KEY `positions_parent_id_foreign` (`parent_id`),
  CONSTRAINT `positions_branch_id_foreign` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `positions_parent_id_foreign` FOREIGN KEY (`parent_id`) REFERENCES `positions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.rfid_loq
CREATE TABLE IF NOT EXISTS `rfid_loq` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rfid_id` int DEFAULT NULL,
  `mode` enum('EMPLOYEES','GUEST') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nik` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `barcode` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clock_in` date DEFAULT NULL,
  `clock_out` date DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rfid_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `rfid_id` (`rfid_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for view e-connect_db.testing_view
-- Creating temporary table to overcome VIEW dependency errors
CREATE TABLE `testing_view` (
	`id` INT(10) NOT NULL,
	`user_id` CHAR(36) NULL COLLATE 'utf8mb4_unicode_ci',
	`full_name` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`picture` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`nik` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`barcode` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`branch_id` BIGINT(20) UNSIGNED NOT NULL,
	`department_id` BIGINT(20) UNSIGNED NULL,
	`position_id` BIGINT(20) UNSIGNED NOT NULL,
	`title_id` BIGINT(20) UNSIGNED NOT NULL,
	`employee_status` ENUM('Contract','Intern','Permanent','Probationary','Resign','Terminated','Temporary') NULL COLLATE 'utf8mb4_unicode_ci',
	`contract_count` INT(10) NOT NULL,
	`join_date` DATE NULL,
	`effective_date` DATE NULL,
	`end_effective_date` DATE NULL,
	`resign_date_rehire` DATE NULL,
	`religion` ENUM('Buddhist','Catholic','Christian','Hindu','Moslem') NULL COLLATE 'utf8mb4_unicode_ci',
	`gender` ENUM('Female','Male') NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`marital_status` ENUM('Divorced','Married','Single','Widow','Widower') NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`place_of_birth` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`date_of_birth` DATE NULL,
	`address` TEXT NULL COLLATE 'utf8mb4_unicode_ci',
	`phone` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`office_email` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`personal_email` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`npwp` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`bpjs_tk` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`bpjs_health` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`ktp_number` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`rfid_number` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`created_at` TIMESTAMP NULL,
	`updated_at` TIMESTAMP NULL,
	`deleted_at` TIMESTAMP NULL,
	`is_deleted` INT(10) NULL,
	`department_name` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`position_name` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`title_name` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci',
	`branch_name` VARCHAR(255) NULL COLLATE 'utf8mb4_unicode_ci'
) ENGINE=MyISAM;

-- Dumping structure for table e-connect_db.titles
CREATE TABLE IF NOT EXISTS `titles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title_level` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `titles_title_name_unique` (`title_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.trucks
CREATE TABLE IF NOT EXISTS `trucks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `license_plate` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `driver_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `driver_phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `driver_license` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `truck_asal` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `destination` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cargo_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cargo_weight` decimal(10,2) DEFAULT NULL,
  `status` enum('scheduled','checked_in','loading','loaded','checked_out','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'scheduled',
  `priority` enum('low','normal','high','urgent') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `scheduled_time` datetime NOT NULL,
  `check_in_time` datetime DEFAULT NULL,
  `loading_start_time` datetime DEFAULT NULL,
  `loading_end_time` datetime DEFAULT NULL,
  `check_out_time` datetime DEFAULT NULL,
  `duration_minutes` int DEFAULT NULL,
  `truck_photos` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'JSON array of truck photo paths',
  `document_photos` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'JSON array of document photo paths',
  `other_photos` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'JSON array of other photo paths',
  `photo_path` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `special_instructions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `dock_number` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estimated_duration` int DEFAULT '1' COMMENT 'Estimated duration in minutes',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` int NOT NULL DEFAULT '0',
  `deleted_at` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancelled_time` datetime DEFAULT NULL,
  `cancellation_reason` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `document_number_out` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `truck_photos_out` text COLLATE utf8mb4_unicode_ci,
  `document_photos_out` text COLLATE utf8mb4_unicode_ci,
  `other_photos_out` text COLLATE utf8mb4_unicode_ci,
  `notes_out` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `idx_license_plate` (`license_plate`),
  KEY `idx_driver_name` (`driver_name`),
  KEY `idx_status` (`status`),
  KEY `idx_priority` (`priority`),
  KEY `idx_scheduled_time` (`scheduled_time`),
  KEY `idx_check_in_time` (`check_in_time`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_destination` (`destination`),
  KEY `idx_dock_number` (`dock_number`),
  KEY `created_by` (`created_by`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `trucks_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `trucks_ibfk_2` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `menu_groups` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `menu_access` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `menu_permissions` json DEFAULT NULL,
  `full_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_online` tinyint(1) DEFAULT '0',
  `last_activity` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `last_login` datetime DEFAULT NULL,
  `login_attempts` int DEFAULT '0',
  `locked_until` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_username` (`username`),
  KEY `idx_role` (`role`),
  KEY `idx_email` (`email`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.users_role
CREATE TABLE IF NOT EXISTS `users_role` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `menu_groups` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `menu_access` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `menu_permissions` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` int DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `username` (`role_id`) USING BTREE,
  KEY `idx_is_active` (`is_active`) USING BTREE,
  KEY `idx_username` (`role_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.user_dashboard_preferences
CREATE TABLE IF NOT EXISTS `user_dashboard_preferences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT 'Reference to users table',
  `card_id` int NOT NULL COMMENT 'Reference to dashboard_cards table',
  `is_visible` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Whether user wants to see this card',
  `display_order` int NOT NULL DEFAULT '0' COMMENT 'User custom order for this card',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_card` (`user_id`,`card_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_card_id` (`card_id`),
  CONSTRAINT `user_dashboard_preferences_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_dashboard_preferences_ibfk_2` FOREIGN KEY (`card_id`) REFERENCES `dashboard_cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table e-connect_db.work_calendar
CREATE TABLE IF NOT EXISTS `work_calendar` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `type` enum('company_anniversary','replacement_workday','replacement_holiday','sto_audit','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `respons` text COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `target_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'all',
  `target_value` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `work_calendar_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for view e-connect_db.active_trucks
-- Removing temporary table and create final VIEW structure
DROP TABLE IF EXISTS `active_trucks`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `active_trucks` AS select `t`.`id` AS `id`,`t`.`license_plate` AS `license_plate`,`t`.`driver_name` AS `driver_name`,`t`.`destination` AS `destination`,`t`.`status` AS `status`,`t`.`priority` AS `priority`,`t`.`scheduled_time` AS `scheduled_time`,`t`.`check_in_time` AS `check_in_time`,`t`.`dock_number` AS `dock_number`,`t`.`cargo_type` AS `cargo_type`,`t`.`cargo_weight` AS `cargo_weight`,(case when ((`t`.`status` = 'checked_in') or (`t`.`status` = 'loading') or (`t`.`status` = 'loaded')) then timestampdiff(MINUTE,`t`.`check_in_time`,now()) when (`t`.`status` = 'checked_out') then `t`.`duration_minutes` else NULL end) AS `current_duration`,`t`.`notes` AS `notes`,`t`.`special_instructions` AS `special_instructions`,`u`.`full_name` AS `created_by_name` from (`trucks` `t` left join `users` `u` on((`t`.`created_by` = `u`.`id`))) where (`t`.`status` in ('scheduled','checked_in','loading','loaded')) order by (case `t`.`priority` when 'urgent' then 1 when 'high' then 2 when 'normal' then 3 when 'low' then 4 end),`t`.`scheduled_time`;

-- Dumping structure for view e-connect_db.dashboard_summary
-- Removing temporary table and create final VIEW structure
DROP TABLE IF EXISTS `dashboard_summary`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `dashboard_summary` AS select count(0) AS `total_trucks`,sum((case when (`trucks`.`status` = 'scheduled') then 1 else 0 end)) AS `scheduled_count`,sum((case when (`trucks`.`status` = 'checked_in') then 1 else 0 end)) AS `checked_in_count`,sum((case when (`trucks`.`status` = 'loading') then 1 else 0 end)) AS `loading_count`,sum((case when (`trucks`.`status` = 'loaded') then 1 else 0 end)) AS `loaded_count`,sum((case when (`trucks`.`status` = 'checked_out') then 1 else 0 end)) AS `checked_out_count`,sum((case when (`trucks`.`status` = 'cancelled') then 1 else 0 end)) AS `cancelled_count`,round(avg(`trucks`.`duration_minutes`),2) AS `avg_duration_minutes`,sum((case when (cast(`trucks`.`scheduled_time` as date) = curdate()) then 1 else 0 end)) AS `today_trucks` from `trucks`;

-- Dumping structure for view e-connect_db.departments_view
-- Removing temporary table and create final VIEW structure
DROP TABLE IF EXISTS `departments_view`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `departments_view` AS select `d`.`id` AS `department_id`,`d`.`branch_id` AS `branch_id`,`d`.`dept_name` AS `dept_name`,`d`.`dept_code` AS `dept_code`,`d`.`parent_id` AS `parent_id`,`d`.`location` AS `location`,`b`.`branch_name` AS `branch_name`,`b`.`branch_desc` AS `branch_desc`,`p`.`dept_name` AS `parent_name`,`l`.`office_name` AS `office_name`,`l`.`office_address` AS `office_address` from (((`departments` `d` left join `branches` `b` on((`d`.`branch_id` = `b`.`id`))) left join `departments` `p` on((`d`.`parent_id` = `p`.`id`))) left join `location` `l` on((`d`.`location` = `l`.`id`))) where (`d`.`deleted_at` is null);

-- Dumping structure for view e-connect_db.testing_view
-- Removing temporary table and create final VIEW structure
DROP TABLE IF EXISTS `testing_view`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `testing_view` AS select `e`.`id` AS `id`,`e`.`user_id` AS `user_id`,`e`.`full_name` AS `full_name`,`e`.`picture` AS `picture`,`e`.`nik` AS `nik`,`e`.`barcode` AS `barcode`,`e`.`branch_id` AS `branch_id`,`e`.`department_id` AS `department_id`,`e`.`position_id` AS `position_id`,`e`.`title_id` AS `title_id`,`e`.`employee_status` AS `employee_status`,`e`.`contract_count` AS `contract_count`,`e`.`join_date` AS `join_date`,`e`.`effective_date` AS `effective_date`,`e`.`end_effective_date` AS `end_effective_date`,`e`.`resign_date_rehire` AS `resign_date_rehire`,`e`.`religion` AS `religion`,`e`.`gender` AS `gender`,`e`.`marital_status` AS `marital_status`,`e`.`place_of_birth` AS `place_of_birth`,`e`.`date_of_birth` AS `date_of_birth`,`e`.`address` AS `address`,`e`.`phone` AS `phone`,`e`.`office_email` AS `office_email`,`e`.`personal_email` AS `personal_email`,`e`.`npwp` AS `npwp`,`e`.`bpjs_tk` AS `bpjs_tk`,`e`.`bpjs_health` AS `bpjs_health`,`e`.`ktp_number` AS `ktp_number`,`e`.`rfid_number` AS `rfid_number`,`e`.`created_at` AS `created_at`,`e`.`updated_at` AS `updated_at`,`e`.`deleted_at` AS `deleted_at`,`e`.`is_deleted` AS `is_deleted`,`d`.`dept_name` AS `department_name`,`p`.`position_name` AS `position_name`,`t`.`title_name` AS `title_name`,`b`.`branch_name` AS `branch_name` from ((((`employees` `e` left join `departments` `d` on((`e`.`department_id` = `d`.`id`))) left join `positions` `p` on((`e`.`position_id` = `p`.`id`))) left join `titles` `t` on((`e`.`title_id` = `t`.`id`))) left join `branches` `b` on((`e`.`branch_id` = `b`.`id`))) where (`e`.`deleted_at` is null) order by `e`.`full_name`;

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
