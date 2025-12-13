import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const FIGMA_TOKEN = process.env.FIGMA_ACCESS_TOKEN;

/**
 * Extract file key from various Figma URL formats
 */
function extractFileKey(input) {
    if (!input) return null;

    // If it's already just a key (no slashes or dots suggesting URL)
    if (!input.includes("/") && !input.includes(".")) {
        return input;
    }

    // Match file key from URL patterns
    const patterns = [/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/, /figma\.com\/proto\/([a-zA-Z0-9]+)/];

    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) return match[1];
    }

    return null;
}

/**
 * Fetch Figma file data from API
 */
async function fetchFigmaFile(fileKey) {
    const url = `https://api.figma.com/v1/files/${fileKey}`;

    const response = await fetch(url, {
        headers: {
            "X-Figma-Token": FIGMA_TOKEN,
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Figma API error (${response.status}): ${error}`);
    }

    return response.json();
}

/**
 * Fetch image fills (images used as backgrounds/fills in shapes)
 */
async function fetchImageFills(fileKey) {
    const url = `https://api.figma.com/v1/files/${fileKey}/images`;

    const response = await fetch(url, {
        headers: {
            "X-Figma-Token": FIGMA_TOKEN,
        },
    });

    if (!response.ok) {
        console.warn("Could not fetch image fills:", response.status);
        return null;
    }

    return response.json();
}

/**
 * Fetch component sets and styles
 */
async function fetchStyles(fileKey) {
    const url = `https://api.figma.com/v1/files/${fileKey}/styles`;

    const response = await fetch(url, {
        headers: {
            "X-Figma-Token": FIGMA_TOKEN,
        },
    });

    if (!response.ok) {
        console.warn("Could not fetch styles:", response.status);
        return null;
    }

    return response.json();
}

/**
 * Request image exports for specific node IDs
 */
async function fetchNodeImages(fileKey, nodeIds, format = "png", scale = 2) {
    if (!nodeIds.length) return {};

    const url = new URL(`https://api.figma.com/v1/images/${fileKey}`);
    url.searchParams.set("ids", nodeIds.join(","));
    url.searchParams.set("format", format);
    url.searchParams.set("scale", scale.toString());

    const response = await fetch(url.toString(), {
        headers: {
            "X-Figma-Token": FIGMA_TOKEN,
        },
    });

    if (!response.ok) {
        console.warn("Could not fetch node images:", response.status);
        return {};
    }

    const data = await response.json();
    return data.images || {};
}

/**
 * Download an image from URL and save to disk
 */
async function downloadImage(imageUrl, outputPath) {
    const response = await fetch(imageUrl);

    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
}

/**
 * Recursively find all nodes that are images or have image fills
 */
function findImageNodes(node, results = { imageNodes: [], imageFillRefs: [] }) {
    // Check if node has image fills
    if (node.fills && Array.isArray(node.fills)) {
        for (const fill of node.fills) {
            if (fill.type === "IMAGE" && fill.imageRef) {
                results.imageFillRefs.push({
                    nodeId: node.id,
                    nodeName: node.name,
                    imageRef: fill.imageRef,
                });
            }
        }
    }

    // Check if node is an exportable type (frames, components, etc.)
    const exportableTypes = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "GROUP", "VECTOR", "RECTANGLE", "ELLIPSE", "POLYGON", "STAR", "LINE", "TEXT"];
    if (exportableTypes.includes(node.type)) {
        results.imageNodes.push({
            id: node.id,
            name: node.name,
            type: node.type,
        });
    }

    // Recurse into children
    if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
            findImageNodes(child, results);
        }
    }

    return results;
}

/**
 * Find top-level frames (pages > frames) for export
 */
function findTopLevelFrames(document) {
    const frames = [];

    if (document.children) {
        for (const page of document.children) {
            if (page.children) {
                for (const node of page.children) {
                    if (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
                        frames.push({
                            id: node.id,
                            name: node.name,
                            type: node.type,
                            pageName: page.name,
                        });
                    }
                }
            }
        }
    }

    return frames;
}

async function main() {
    // Get URL from command line args
    const input = process.argv[2];
    const skipImages = process.argv.includes("--skip-images");
    const exportFrames = process.argv.includes("--export-frames");

    if (!input) {
        console.error("Usage: node export.js <figma-url-or-file-key> [options]");
        console.error("");
        console.error("Options:");
        console.error("  --skip-images    Skip downloading images");
        console.error("  --export-frames  Export top-level frames as PNG images");
        console.error("");
        console.error("Examples:");
        console.error("  node export.js https://www.figma.com/file/ABC123/MyDesign");
        console.error("  node export.js ABC123 --export-frames");
        process.exit(1);
    }

    if (!FIGMA_TOKEN) {
        console.error("Error: FIGMA_ACCESS_TOKEN environment variable not set.");
        console.error("");
        console.error("To get a token:");
        console.error("1. Go to https://www.figma.com/developers/api#access-tokens");
        console.error("2. Generate a personal access token");
        console.error("3. Create a .env file with: FIGMA_ACCESS_TOKEN=your_token_here");
        process.exit(1);
    }

    const fileKey = extractFileKey(input);

    if (!fileKey) {
        console.error("Error: Could not extract file key from input:", input);
        process.exit(1);
    }

    console.log(`Fetching Figma file: ${fileKey}`);

    try {
        // Fetch all data in parallel
        const [fileData, imageFills, styles] = await Promise.all([fetchFigmaFile(fileKey), fetchImageFills(fileKey), fetchStyles(fileKey)]);

        // Create output directory
        const safeName = (fileData.name || fileKey).replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 50);
        const outputDir = path.join(__dirname, "output", safeName);
        const imagesDir = path.join(outputDir, "images");

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Track downloaded images for the JSON
        const downloadedImages = {
            fills: {},
            frames: {},
        };

        if (!skipImages) {
            // Create images directory
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
            }

            // Download image fills
            if (imageFills?.meta?.images) {
                const fillImages = imageFills.meta.images;
                const fillCount = Object.keys(fillImages).length;

                if (fillCount > 0) {
                    console.log(`\nDownloading ${fillCount} image fills...`);

                    for (const [imageRef, imageUrl] of Object.entries(fillImages)) {
                        if (!imageUrl) continue;

                        try {
                            // Determine file extension from URL or default to png
                            const urlPath = new URL(imageUrl).pathname;
                            const ext = path.extname(urlPath) || ".png";
                            const filename = `fill_${imageRef}${ext}`;
                            const filePath = path.join(imagesDir, filename);

                            await downloadImage(imageUrl, filePath);
                            downloadedImages.fills[imageRef] = `images/${filename}`;
                            console.log(`  ✓ ${filename}`);
                        } catch (err) {
                            console.warn(`  ✗ Failed to download ${imageRef}: ${err.message}`);
                        }
                    }
                }
            }

            // Export top-level frames as images
            if (exportFrames) {
                const frames = findTopLevelFrames(fileData.document);

                if (frames.length > 0) {
                    console.log(`\nExporting ${frames.length} frames as PNG...`);

                    // Figma API limits to 50 nodes per request
                    const batchSize = 50;
                    for (let i = 0; i < frames.length; i += batchSize) {
                        const batch = frames.slice(i, i + batchSize);
                        const nodeIds = batch.map((f) => f.id);

                        const imageUrls = await fetchNodeImages(fileKey, nodeIds, "png", 2);

                        for (const frame of batch) {
                            const imageUrl = imageUrls[frame.id];
                            if (!imageUrl) {
                                console.warn(`  ✗ No image URL for ${frame.name}`);
                                continue;
                            }

                            try {
                                const safeName = frame.name.replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 50);
                                const filename = `frame_${safeName}_${frame.id.replace(":", "-")}.png`;
                                const filePath = path.join(imagesDir, filename);

                                await downloadImage(imageUrl, filePath);
                                downloadedImages.frames[frame.id] = {
                                    name: frame.name,
                                    path: `images/${filename}`,
                                    type: frame.type,
                                    page: frame.pageName,
                                };
                                console.log(`  ✓ ${frame.name}`);
                            } catch (err) {
                                console.warn(`  ✗ Failed to download ${frame.name}: ${err.message}`);
                            }
                        }
                    }
                }
            }
        }

        // Combine all data
        const exportData = {
            ...fileData,
            _meta: {
                exportedAt: new Date().toISOString(),
                fileKey,
                source: input,
                imagesDownloaded: !skipImages,
            },
            _imageFills: imageFills,
            _styles: styles,
            _downloadedImages: downloadedImages,
        };

        // Write JSON file
        const jsonPath = path.join(outputDir, "project.json");
        fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2));

        console.log(`\n✓ Exported to: ${outputDir}`);
        console.log(`  Project: ${fileData.name}`);
        console.log(`  Last modified: ${fileData.lastModified}`);
        console.log(`  Version: ${fileData.version}`);

        // Print some stats
        const countNodes = (node) => {
            let count = 1;
            if (node.children) {
                for (const child of node.children) {
                    count += countNodes(child);
                }
            }
            return count;
        };

        const totalNodes = fileData.document ? countNodes(fileData.document) : 0;
        console.log(`  Total nodes: ${totalNodes}`);

        const fillsDownloaded = Object.keys(downloadedImages.fills).length;
        const framesDownloaded = Object.keys(downloadedImages.frames).length;
        if (fillsDownloaded > 0) console.log(`  Image fills downloaded: ${fillsDownloaded}`);
        if (framesDownloaded > 0) console.log(`  Frames exported: ${framesDownloaded}`);
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}

main();
