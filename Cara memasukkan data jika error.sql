/* Query untuk memasukan data jika ada error, biasanya karena pembacaan urutan data yang tidak sama dengan urutan sistem
/* makanya perlu di disable dulu FK Check nya

/* 1. Disable FK Checks */
SET FOREIGN_KEY_CHECKS = 0;

/* 2. Clear old data */
DELETE FROM `positions`;

/* 3. Insert new data (Order doesn't matter now) */
INSERT INTO `positions` ([id](cci:1://file:///c:/project/e-connect/Development/frontend/src/services/api.ts:799:2-801:3), `branch_id`, `position_name`, `parent_id`, `location`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 1, 'President Director', NULL, 1, '2024-12-19 12:56:44', '2024-12-19 12:56:44', NULL),
(2, 1, 'Director', 1, 1, '2024-12-19 12:56:44', '2024-12-19 12:56:44', NULL),
/* ... paste your full list of values here ... */
(127, 2, 'GA Section Head', 28, 1, '2025-05-05 06:50:36', '2025-05-05 06:50:46', NULL);

/* 4. Re-enable FK Checks */
SET FOREIGN_KEY_CHECKS = 1;