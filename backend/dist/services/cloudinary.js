"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCloudinaryConfigured = void 0;
exports.uploadToCloudinary = uploadToCloudinary;
exports.deleteFromCloudinary = deleteFromCloudinary;
const cloudinary_1 = require("cloudinary");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
exports.isCloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret);
if (exports.isCloudinaryConfigured) {
    cloudinary_1.v2.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });
}
/**
 * Uploads a file buffer or base64 data to Cloudinary.
 * If credentials are not configured, returns a development fallback object.
 */
async function uploadToCloudinary(fileBufferOrBase64, folder = "fitness-app/uploads") {
    if (!exports.isCloudinaryConfigured) {
        const mockId = `dev-${Date.now()}`;
        return {
            url: `https://res.cloudinary.com/demo/image/upload/${mockId}.jpg`,
            secureUrl: `https://res.cloudinary.com/demo/image/upload/${mockId}.jpg`,
            publicId: mockId,
        };
    }
    return new Promise((resolve, reject) => {
        if (typeof fileBufferOrBase64 === "string") {
            cloudinary_1.v2.uploader.upload(fileBufferOrBase64, {
                folder,
                resource_type: "auto",
            }, (error, result) => {
                if (error || !result)
                    return reject(error || new Error("Cloudinary upload failed"));
                resolve({
                    url: result.url,
                    secureUrl: result.secure_url,
                    publicId: result.public_id,
                    format: result.format,
                    width: result.width,
                    height: result.height,
                });
            });
        }
        else {
            const uploadStream = cloudinary_1.v2.uploader.upload_stream({
                folder,
                resource_type: "auto",
            }, (error, result) => {
                if (error || !result)
                    return reject(error || new Error("Cloudinary stream upload failed"));
                resolve({
                    url: result.url,
                    secureUrl: result.secure_url,
                    publicId: result.public_id,
                    format: result.format,
                    width: result.width,
                    height: result.height,
                });
            });
            uploadStream.end(fileBufferOrBase64);
        }
    });
}
/**
 * Delete an asset from Cloudinary by public ID.
 */
async function deleteFromCloudinary(publicId) {
    if (!exports.isCloudinaryConfigured)
        return true;
    try {
        const result = await cloudinary_1.v2.uploader.destroy(publicId);
        return result.result === "ok";
    }
    catch (err) {
        console.error("Cloudinary delete error:", err);
        return false;
    }
}
