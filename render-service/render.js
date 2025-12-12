import puppeteer from "puppeteer";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const OUTPUT_DIR = "output";

function cleanOutputDirectory() {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR);
        return;
    }

    // Read all files in the output directory
    const files = fs.readdirSync(OUTPUT_DIR);

    // Delete each file
    for (const file of files) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
}

async function generateVideo(videoPath, fps, preset = "mp4") {
    return new Promise((resolve, reject) => {
        const command = ffmpeg().input(`${OUTPUT_DIR}/frame_%04d.png`).inputFPS(fps).output(videoPath).outputFPS(fps);

        switch (preset) {
            case "prores4444alpha":
                // ProRes 4444 with alpha channel support (.mov)
                command.videoCodec("prores_ks").addOption("-profile:v", "4444").addOption("-pix_fmt", "yuva444p10le");
                break;
            case "VP9alpha":
                // VP9 with alpha channel support (.webm)
                command.videoCodec("libvpx-vp9").addOption("-pix_fmt", "yuva420p").addOption("-b:v", "10000k");
                break;
            case "mp4":
            default:
                // H.264 without alpha (.mp4)
                command
                    .videoCodec("h264_videotoolbox") //libx264
                    .addOption("-color_primaries", "bt709")
                    .addOption("-color_trc", "bt709")
                    .addOption("-colorspace", "bt709")
                    .addOption("-color_range", "tv")
                    .addOption("-pix_fmt", "yuv444p") //yuv420p yuv444p
                    .addOption("-b:v", "10000k");
                break;
        }

        command
            .on("end", () => {
                console.log("Video generation completed");
                resolve();
            })
            .on("error", (err) => {
                console.error("Error generating video:", err);
                reject(err);
            })
            .run();
    });
}

// File extensions for each preset
const PRESET_EXTENSIONS = {
    mp4: ".mp4",
    prores4444alpha: ".mov",
    VP9alpha: ".webm",
};

/**
 * Render a video for the given template
 * @param {string} templateId - The template ID to render
 * @param {Object} data - Optional data to update editable fields (e.g., { Headline: "Hello", Left: -500 })
 * @param {string} preset - Video encoding preset: "mp4", "prores4444alpha", or "VP9alpha"
 * @returns {Promise<{videoPath: string, outputDir: string}>} - Paths for cleanup
 */
export async function renderVideo(templateId, data = null, preset = "mp4") {
    let browser;
    try {
        // Clean output directory before starting
        cleanOutputDirectory();

        const startTime = Date.now();

        // Generate UUID for video filename with appropriate extension
        const videoId = crypto.randomUUID();
        const videoPath = `${videoId}${PRESET_EXTENSIONS[preset] || ".mp4"}`;

        // Launch the browser
        browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        // Create a new page
        const page = await browser.newPage();

        // Set viewport size for the page
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 2,
        });

        // Navigate to the URL with increased timeout
        let url = `http://localhost:4000/renderpage/${templateId}`;
        const params = new URLSearchParams();
        if (data) {
            params.set("data", Buffer.from(JSON.stringify(data)).toString("base64"));
        }
        if (preset !== "mp4") {
            params.set("preset", preset);
        }
        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        console.log(`Loading page for template: ${templateId}...`);
        await page.goto(url, {
            waitUntil: ["networkidle0", "domcontentloaded"],
            timeout: 60000,
        });

        console.log("Page loaded successfully");

        // Get maxTime and frameRate from the page
        const endTime = await page.evaluate(() => window.maxTime);
        const fps = await page.evaluate(() => window.frameRate);
        console.log(`Using maxTime: ${endTime}s, frameRate: ${fps}fps`);

        const totalFrames = Math.round(endTime * fps) - 1;

        // Capture frames
        for (let frame = 0; frame <= totalFrames; frame++) {
            const currentTime = frame / fps;

            await page.evaluate((time) => {
                window.setTime(time);
            }, currentTime);

            // Capture frame directly from WebGL canvas
            const base64Data = await page.evaluate(() => window.captureFrame());
            if (!base64Data) {
                throw new Error(`Failed to capture frame ${frame}`);
            }

            // Write base64 PNG data to file
            const framePath = `${OUTPUT_DIR}/frame_${String(frame).padStart(4, "0")}.png`;
            fs.writeFileSync(framePath, Buffer.from(base64Data, "base64"));

            console.log(`Captured frame ${frame}/${totalFrames} at time ${currentTime.toFixed(3)}s`);
        }

        console.log("All frames captured successfully!");

        // Close the browser
        await browser.close();
        browser = null;

        // Generate video from frames
        console.log("Starting video generation...");
        await generateVideo(videoPath, fps, preset);

        const totalTimeSec = (Date.now() - startTime) / 1000;
        const frameCount = totalFrames + 1;
        const avgTimePerFrameSec = totalTimeSec / frameCount;

        console.log(`Process completed! Total time: ${totalTimeSec.toFixed(2)} seconds`);
        console.log(`Rendered ${frameCount} frames, avg ${avgTimePerFrameSec.toFixed(3)}s per frame`);

        return {
            videoPath,
            outputDir: OUTPUT_DIR,
            stats: {
                totalTimeSec: parseFloat(totalTimeSec.toFixed(2)),
                frameCount,
                fps,
                avgTimePerFrameSec: parseFloat(avgTimePerFrameSec.toFixed(3)),
            },
        };
    } catch (error) {
        // Try to close the browser if it exists
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error("Error closing browser:", e);
            }
        }
        throw error;
    }
}
