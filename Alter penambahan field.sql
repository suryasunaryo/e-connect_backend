ALTER TABLE `trucks`
  ADD COLUMN `document_number_out` VARCHAR(100)
    COLLATE utf8mb4_unicode_ci
    DEFAULT NULL
    AFTER `cancellation_reason`,

  ADD COLUMN `truck_photos_out` TEXT
    COLLATE utf8mb4_unicode_ci
    AFTER `document_number_out`,

  ADD COLUMN `document_photos_out` TEXT
    COLLATE utf8mb4_unicode_ci
    AFTER `truck_photos_out`,

  ADD COLUMN `other_photos_out` TEXT
    COLLATE utf8mb4_unicode_ci
    AFTER `document_photos_out`,

  ADD COLUMN `notes_out` TEXT
    COLLATE utf8mb4_unicode_ci
    AFTER `other_photos_out`;
