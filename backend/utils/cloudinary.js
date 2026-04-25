import { v2 as cloudinary } from 'cloudinary';
import config from '../config/config.js';

// Configure Cloudinary with settings from config
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

/**
 * Uploads a file buffer directly to Cloudinary
 * @param {Buffer} fileBuffer - The file buffer from multer memory storage
 * @returns {Promise<Object>} - The Cloudinary upload result object
 */
export const uploadPdfToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw', // 'raw' is used for non-image files like PDFs
        format: 'pdf',        // Force the format to be pdf
        folder: 'resumes',    // Optional: organize files into a folder
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );

    // End the stream with the buffer
    uploadStream.end(fileBuffer);
  });
};
