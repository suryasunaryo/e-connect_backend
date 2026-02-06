-- Migration: Create user_favorite_apps table
-- Date: 2026-02-06
-- Description: Store user's favorite portal apps for cross-device sync

CREATE TABLE IF NOT EXISTS user_favorite_apps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  portal_app_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (portal_app_id) REFERENCES portal_settings(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_app (user_id, portal_app_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
