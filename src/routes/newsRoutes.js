import express from "express";
import {
  createNews,
  getAllNews,
  getNewsById,
  updateNews,
  deleteNews,
  markAsRead,
  getCommentsForNews,
  postCommentForNews,
  deleteNewsFile,
} from "../controllers/newsController.js";

import { authenticateToken } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Multer Setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "uploads/news/";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
    fieldSize: 50 * 1024 * 1024, // 50MB limit for text fields
  },
});

// Routes
const cpUpload = upload.fields([
  { name: "cover_image", maxCount: 1 },
  { name: "files", maxCount: 20 },
]);

router.post("/", authenticateToken, cpUpload, createNews);
router.get("/", authenticateToken, getAllNews);
router.get("/:id", authenticateToken, getNewsById);

// Note: accept multipart on PUT as well (files may be sent during edit)
router.put("/:id", authenticateToken, cpUpload, updateNews);

router.delete("/:id", authenticateToken, deleteNews);
router.post("/:id/read", authenticateToken, markAsRead);

// Comment endpoints
router.get("/:id/comments", authenticateToken, getCommentsForNews);
router.post("/:id/comments", authenticateToken, postCommentForNews);

// Delete Attachment
router.delete("/files/:fileId", authenticateToken, deleteNewsFile);

// Upload Image for Rich Text Editor
router.post(
  "/upload-image",
  authenticateToken,
  upload.single("image"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }
    const imageUrl = `/uploads/news/${req.file.filename}`;
    res.json({ url: imageUrl });
  },
);

export default router;
