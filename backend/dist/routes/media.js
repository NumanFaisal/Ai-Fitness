"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const cloudinary_1 = require("../services/cloudinary");
exports.mediaRouter = (0, express_1.Router)();
// Configure multer memory storage (stores file in memory buffer for Cloudinary stream)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        }
        else {
            cb(new Error("Only image files are allowed."));
        }
    },
});
exports.mediaRouter.use(auth_1.authMiddleware);
/**
 * Check Cloudinary status
 */
exports.mediaRouter.get("/status", (_req, res) => {
    res.json({
        provider: "Cloudinary",
        configured: cloudinary_1.isCloudinaryConfigured,
    });
});
/**
 * POST /media/upload
 * Supports:
 * 1. Multipart form-data with field name "photo" or "file"
 * 2. JSON body with base64 string: { imageBase64: "data:image/jpeg;base64,..." }
 */
exports.mediaRouter.post("/upload", upload.single("photo"), async (req, res) => {
    try {
        const folder = req.body.folder || "fitness-app/user-photos";
        // Case 1: Upload via multipart file buffer
        if (req.file) {
            const result = await (0, cloudinary_1.uploadToCloudinary)(req.file.buffer, folder);
            return res.status(201).json({
                message: "Upload successful",
                ...result,
            });
        }
        // Case 2: Upload via JSON base64 string
        const base64Data = req.body.imageBase64 || req.body.image;
        if (base64Data && typeof base64Data === "string") {
            const result = await (0, cloudinary_1.uploadToCloudinary)(base64Data, folder);
            return res.status(201).json({
                message: "Upload successful",
                ...result,
            });
        }
        return res.status(400).json({
            message: "No image provided. Please upload a file (field: 'photo') or provide 'imageBase64'.",
        });
    }
    catch (err) {
        console.error("Upload error:", err);
        return res.status(500).json({
            message: "Failed to upload image to Cloudinary.",
            error: err.message,
        });
    }
});
