import puppeteer from "puppeteer";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";

function cleanOutputDirectory() {
    const outputDir = "output";

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
        return;
    }

    // Read all files in the output directory
    const files = fs.readdirSync(outputDir);

    // Delete each file
    for (const file of files) {
        fs.unlinkSync(path.join(outputDir, file));
    }
}

async function generateVideo() {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input("output/frame_%04d.jpg")
            .inputFPS(25)
            .output("animation.mp4")
            .videoCodec("h264_videotoolbox") //libx264
            .outputFPS(25)
            .addOption("-color_primaries", "bt709")
            .addOption("-color_trc", "bt709")
            .addOption("-colorspace", "bt709")
            .addOption("-color_range", "tv")
            .addOption("-pix_fmt", "yuv444p") //yuv420p yuv444p
            // .addOption("-crf", "10")
            .addOption("-b:v", "10000k")
            // .addOption("-maxrate", "50M")
            // .addOption("-bufsize", "50M")
            // Add QuickTime compatibility options
            // .addOption("-movflags", "+faststart")
            // .addOption("-profile:v", "baseline")
            // .addOption("-level", "3.0")
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

async function captureScreenshots() {
    let browser;
    try {
        // Clean output directory before starting
        cleanOutputDirectory();

        const startTime = Date.now();

        const fps = 25; // 25 frames per second

        // Launch the browser
        browser = await puppeteer.launch({
            headless: "new", // Use new headless mode
            args: ["--no-sandbox", "--disable-setuid-sandbox"], // Add additional args for stability
        });

        // Create a new page
        const page = await browser.newPage();

        // Set viewport size for the page
        await page.setViewport({
            width: 1920,
            height: 1080,
        });

        // Navigate to the URL with increased timeout
        const templateId = "template1";
        const url = `http://localhost:4000/renderpage/${templateId}`;

        console.log("Loading page...");
        await page.goto(url, {
            waitUntil: ["networkidle0", "domcontentloaded"], // Wait for both conditions
            timeout: 60000, // Increase timeout to 60 seconds
        });

        // Additional wait to ensure page is fully loaded
        // await new Promise((resolve) => setTimeout(resolve, 2000));
        console.log("Page loaded successfully");

        // Get maxTime from the page
        const endTime = await page.evaluate(() => window.maxTime);
        console.log(`Using maxTime from page: ${endTime} seconds`);

        const totalFrames = endTime * fps - 1;

        // Capture frames
        for (let frame = 0; frame <= totalFrames; frame++) {
            // Calculate current time
            const currentTime = frame / fps;

            // Set the animation time
            await page.evaluate((time) => {
                window.setTime(time);
            }, currentTime);

            // Wait for a short moment to ensure animation update
            // await new Promise((resolve) => setTimeout(resolve, 50));

            // Take a screenshot with frame number in filename
            await page.screenshot({
                path: `output/frame_${String(frame).padStart(4, "0")}.jpg`,
                type: "jpeg",
                quality: 100,
                fullPage: true,
            });

            console.log(`Captured frame ${frame}/${totalFrames} at time ${currentTime.toFixed(3)}s`);
        }

        console.log("All frames captured successfully!");

        // Close the browser
        await browser.close();

        // Generate video from frames
        console.log("Starting video generation...");
        await generateVideo();

        const totalTime = (Date.now() - startTime) / 1000; // Convert to seconds
        console.log(`Process completed! Total time: ${totalTime.toFixed(2)} seconds`);
    } catch (error) {
        console.error("Error in process:", error);
        // Try to close the browser if it exists
        try {
            if (browser) await browser.close();
        } catch (e) {
            console.error("Error closing browser:", e);
        }
        process.exit(1); // Exit with error code
    }
}

// Run the screenshot capture
captureScreenshots();
