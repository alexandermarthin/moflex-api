import "dotenv/config";
import Fastify from "fastify";
import fs from "fs";
import path from "path";
import { renderVideo } from "./render.js";
import { uploadFile } from "./upload.js";

const fastify = Fastify({ logger: true });

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    console.error("ERROR: API_KEY environment variable is required");
    process.exit(1);
}

// Auth hook - validates API key on every request
fastify.addHook("preHandler", async (request, reply) => {
    // Skip auth for health check
    if (request.url === "/health") return;

    const apiKey = request.headers["x-api-key"];

    if (apiKey !== API_KEY) {
        reply.status(401).send({ error: "Unauthorized: Invalid API key" });
        return;
    }
});

// Health check endpoint (public)
fastify.get("/health", async () => ({ status: "ok" }));

/**
 * Clean up local files after upload
 */
function cleanup(videoPath, outputDir) {
    try {
        // Delete the video file
        if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
            console.log(`Deleted video file: ${videoPath}`);
        }

        // Delete all frame images in output directory
        if (fs.existsSync(outputDir)) {
            const files = fs.readdirSync(outputDir);
            for (const file of files) {
                fs.unlinkSync(path.join(outputDir, file));
            }
            console.log(`Cleaned up ${files.length} files from ${outputDir}`);
        }
    } catch (error) {
        console.error("Error during cleanup:", error);
    }
}

// Valid presets for video encoding
const VALID_PRESETS = ["mp4", "prores4444alpha", "VP9alpha"];

// Render endpoint - renders video, uploads to S3, returns URL
fastify.post("/render", async (request, reply) => {
    const { templateId, data, preset = "mp4" } = request.body || {};

    if (!templateId) {
        return reply.status(400).send({ error: 'Missing "templateId" in request body' });
    }

    if (!VALID_PRESETS.includes(preset)) {
        return reply.status(400).send({ error: `Invalid preset "${preset}". Valid presets: ${VALID_PRESETS.join(", ")}` });
    }

    try {
        // Render the video
        console.log(`Starting render for template: ${templateId} (preset: ${preset})`);
        if (data) console.log(`With data:`, data);
        const { videoPath, outputDir, stats } = await renderVideo(templateId, data, preset);

        // Upload to S3
        console.log(`Uploading video to S3: ${videoPath}`);
        const { url, uploadStats } = await uploadFile(videoPath);

        // Clean up local files
        cleanup(videoPath, outputDir);

        return {
            url,
            stats: {
                totalTimeSec: stats.totalTimeSec,
                frameCount: stats.frameCount,
                fps: stats.fps,
                avgTimePerFrameSec: stats.avgTimePerFrameSec,
                upload: uploadStats,
            },
        };
    } catch (error) {
        console.error("Render failed:", error);
        return reply.status(500).send({ error: "Render failed", details: error.message });
    }
});

const start = async () => {
    try {
        await fastify.listen({ port: 3000, host: "0.0.0.0" });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
