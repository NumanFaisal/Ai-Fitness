import { Router, Response } from "express";
import multer from "multer";
import { AuthRequest } from "../types";
import { authMiddleware } from "../middleware/auth";
import { uploadToCloudinary, isCloudinaryConfigured } from "../services/cloudinary";

export const mediaRouter = Router();

// Configure multer memory storage (stores file in memory buffer for Cloudinary stream)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."));
    }
  },
});

mediaRouter.use(authMiddleware);

/**
 * Check Cloudinary status
 */
mediaRouter.get("/status", (_req, res: Response) => {
  res.json({
    provider: "Cloudinary",
    configured: isCloudinaryConfigured,
  });
});

/**
 * POST /media/upload
 * Supports:
 * 1. Multipart form-data with field name "photo" or "file"
 * 2. JSON body with base64 string: { imageBase64: "data:image/jpeg;base64,..." }
 */
mediaRouter.post(
  "/upload",
  upload.single("photo"),
  async (req: AuthRequest, res: Response) => {
    try {
      const folder = (req.body.folder as string) || "fitness-app/user-photos";

      // Case 1: Upload via multipart file buffer
      if (req.file) {
        const result = await uploadToCloudinary(req.file.buffer, folder);
        return res.status(201).json({
          message: "Upload successful",
          ...result,
        });
      }

      // Case 2: Upload via JSON base64 string
      const base64Data = req.body.imageBase64 || req.body.image;
      if (base64Data && typeof base64Data === "string") {
        const result = await uploadToCloudinary(base64Data, folder);
        return res.status(201).json({
          message: "Upload successful",
          ...result,
        });
      }

      return res.status(400).json({
        message: "No image provided. Please upload a file (field: 'photo') or provide 'imageBase64'.",
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      return res.status(500).json({
        message: "Failed to upload image to Cloudinary.",
        error: err.message,
      });
    }
  }
);
