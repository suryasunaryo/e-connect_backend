-- ADD BYPASS FACT DETECTION COLUMN
-- To store per-user preference for face detection bypass

ALTER TABLE users ADD COLUMN bypass_face_detection TINYINT(1) DEFAULT 0 AFTER profile_picture;
