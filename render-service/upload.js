import "dotenv/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFile } from "fs/promises";
import { basename } from "path";

// Hetzner S3-compatible storage configuration
const s3Client = new S3Client({
    endpoint: "https://hel1.your-objectstorage.com",
    region: "hel1", // Hetzner uses location as region
    credentials: {
        accessKeyId: process.env.HETZNER_S3_ACCESS_KEY,
        secretAccessKey: process.env.HETZNER_S3_SECRET_KEY,
    },
    forcePathStyle: true, // Required for S3-compatible storage
});

const BUCKET_NAME = "moflexshare";

/**
 * Upload a file to Hetzner S3 storage
 * @param {string} filePath - Local path to the file to upload
 * @param {string} [key] - S3 object key (destination path). Defaults to filename.
 * @param {string} [contentType] - MIME type of the file
 * @returns {Promise<{url: string, key: string}>} - The public URL and key of the uploaded file
 */
export async function uploadFile(filePath, key = null, contentType = null) {
    const fileContent = await readFile(filePath);
    const objectKey = key || basename(filePath);

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectKey,
        Body: fileContent,
        ContentType: contentType || getContentType(filePath),
        ACL: "public-read", // Make file publicly accessible
    });

    await s3Client.send(command);

    const url = `https://${BUCKET_NAME}.hel1.your-objectstorage.com/${objectKey}`;

    console.log(`✓ Uploaded: ${objectKey}`);
    console.log(`  URL: ${url}`);

    return { url, key: objectKey };
}

/**
 * Get content type based on file extension
 */
function getContentType(filePath) {
    const ext = filePath.toLowerCase().split(".").pop();
    const mimeTypes = {
        mp4: "video/mp4",
        webm: "video/webm",
        mov: "video/quicktime",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        json: "application/json",
        pdf: "application/pdf",
    };
    return mimeTypes[ext] || "application/octet-stream";
}

// CLI usage: node upload.js <filepath> [key]
if (process.argv[1].endsWith("upload.js")) {
    const filePath = process.argv[2];
    const key = process.argv[3];

    if (!filePath) {
        console.error("Usage: node upload.js <filepath> [key]");
        process.exit(1);
    }

    if (!process.env.HETZNER_S3_ACCESS_KEY || !process.env.HETZNER_S3_SECRET_KEY) {
        console.error("Error: Missing HETZNER_S3_ACCESS_KEY or HETZNER_S3_SECRET_KEY in .env");
        process.exit(1);
    }

    uploadFile(filePath, key)
        .then(({ url }) => {
            console.log("\nUpload complete!");
        })
        .catch((err) => {
            console.error("Upload failed:", err.message);
            process.exit(1);
        });
}
