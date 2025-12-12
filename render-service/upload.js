import "dotenv/config";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream, statSync } from "fs";
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
 * Upload a file to Hetzner S3 storage using multipart streaming upload
 * @param {string} filePath - Local path to the file to upload
 * @param {string} [key] - S3 object key (destination path). Defaults to filename.
 * @param {string} [contentType] - MIME type of the file
 * @returns {Promise<{url: string, key: string, uploadStats: object}>} - The public URL, key, and upload stats
 */
export async function uploadFile(filePath, key = null, contentType = null) {
    const objectKey = key || basename(filePath);
    const fileStats = statSync(filePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);

    const startTime = Date.now();

    // Use multipart streaming upload for better performance with large files
    const upload = new Upload({
        client: s3Client,
        params: {
            Bucket: BUCKET_NAME,
            Key: objectKey,
            Body: createReadStream(filePath),
            ContentType: contentType || getContentType(filePath),
            ACL: "public-read", // Make file publicly accessible
        },
        // Multipart upload configuration
        queueSize: 4, // Number of concurrent uploads
        partSize: 10 * 1024 * 1024, // 10MB chunks
        leavePartsOnError: false,
    });

    // Track progress
    upload.on("httpUploadProgress", (progress) => {
        const percent = progress.loaded && progress.total ? Math.round((progress.loaded / progress.total) * 100) : 0;
        process.stdout.write(`\rUploading: ${percent}% (${(progress.loaded / (1024 * 1024)).toFixed(1)}MB / ${fileSizeMB.toFixed(1)}MB)`);
    });

    await upload.done();

    const durationSec = (Date.now() - startTime) / 1000;
    const uploadSpeedMBps = fileSizeMB / durationSec;

    const url = `https://${BUCKET_NAME}.hel1.your-objectstorage.com/${objectKey}`;

    console.log(`\n✓ Uploaded: ${objectKey}`);
    console.log(`  Size: ${fileSizeMB.toFixed(2)} MB`);
    console.log(`  Duration: ${durationSec.toFixed(2)}s`);
    console.log(`  Speed: ${uploadSpeedMBps.toFixed(2)} MB/s`);
    console.log(`  URL: ${url}`);

    return {
        url,
        key: objectKey,
        uploadStats: {
            fileSizeMB: parseFloat(fileSizeMB.toFixed(2)),
            durationSec: parseFloat(durationSec.toFixed(2)),
            speedMBps: parseFloat(uploadSpeedMBps.toFixed(2)),
        },
    };
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
