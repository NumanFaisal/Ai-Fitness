import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

export const isCloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format?: string;
  width?: number;
  height?: number;
}

/**
 * Uploads a file buffer or base64 data to Cloudinary.
 * If credentials are not configured, returns a development fallback object.
 */
export async function uploadToCloudinary(
  fileBufferOrBase64: Buffer | string,
  folder = "fitness-app/uploads"
): Promise<UploadResult> {
  if (!isCloudinaryConfigured) {
    const mockId = `dev-${Date.now()}`;
    return {
      url: `https://res.cloudinary.com/demo/image/upload/${mockId}.jpg`,
      secureUrl: `https://res.cloudinary.com/demo/image/upload/${mockId}.jpg`,
      publicId: mockId,
    };
  }

  return new Promise((resolve, reject) => {
    if (typeof fileBufferOrBase64 === "string") {
      cloudinary.uploader.upload(
        fileBufferOrBase64,
        {
          folder,
          resource_type: "auto",
        },
        (error, result) => {
          if (error || !result) return reject(error || new Error("Cloudinary upload failed"));
          resolve({
            url: result.url,
            secureUrl: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
          });
        }
      );
    } else {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "auto",
        },
        (error: any, result?: UploadApiResponse) => {
          if (error || !result) return reject(error || new Error("Cloudinary stream upload failed"));
          resolve({
            url: result.url,
            secureUrl: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
          });
        }
      );
      uploadStream.end(fileBufferOrBase64);
    }
  });
}

/**
 * Delete an asset from Cloudinary by public ID.
 */
export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  if (!isCloudinaryConfigured) return true;
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === "ok";
  } catch (err) {
    console.error("Cloudinary delete error:", err);
    return false;
  }
}
