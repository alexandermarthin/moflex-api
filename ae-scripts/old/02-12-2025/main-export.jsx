// After Effects Project Export Script - Main Module
// This is the main entry point that orchestrates the entire export process

// Include all the necessary modules
#include "utils.jsx"
#include "shape-processors.jsx"
#include "mask-processors.jsx"
#include "property-processors.jsx"
#include "layer-processors.jsx"

// Global variables for data collection
var assets = {};
var clips = {};

// Polyfill for Object.keys since After Effects doesn't support it
if (typeof Object.keys === "undefined") {
    Object.keys = function(obj) {
        var keys = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                keys.push(key);
            }
        }
        return keys;
    };
}

// Test log entry to confirm logging is working
logToFile("=== SCRIPT STARTED - LOGGING IS WORKING ===");
logToFile("=== NEW SCRIPT RUN ===");

// Basic error handling wrapper
try {
    logToFile("Checking if After Effects is available...");

    if (typeof app === "undefined") {
        logToFile("ERROR: After Effects app object is not available");
        throw new Error("After Effects app object is not available");
    }

    if (typeof app.project === "undefined") {
        logToFile("ERROR: After Effects project is not available");
        throw new Error("After Effects project is not available");
    }

    logToFile("After Effects is available, project has " + app.project.numItems + " items");

    // Test basic functions
    logToFile("Testing basic functions...");
    try {
        var testObj = { test: "value" };
        var testJson = stringify(testObj);
        logToFile("JSON.stringify test passed: " + testJson);

        // Test if we can parse it back
        try {
            var parsed = JSON.parse(testJson);
            if (parsed.test === "value") {
                logToFile("JSON.parse test also passed");
            } else {
                logToFile("JSON.parse test failed - parsed value doesn't match");
            }
        } catch (parseError) {
            logToFile("JSON.parse test failed: " + parseError.toString());
        }
    } catch (jsonError) {
        logToFile("ERROR: JSON.stringify test failed: " + jsonError.toString());
    }
} catch (initialError) {
    logToFile("ERROR in initial setup: " + initialError.toString());
    throw initialError;
}

// Main script
function exportProject() {
    // Clear previous data
    assets = {};
    clips = {};
    
    logToFile("Starting exportProject - assets and clips cleared");
    logToFile("Initial clips count: " + Object.keys(clips).length);

    // Process all root items in the project
    for (var projectIndex = 1; projectIndex <= app.project.numItems; projectIndex++) {
        try {
            var item = app.project.item(projectIndex);
            if (item.parentFolder === app.project.rootFolder) {
                logToFile("Processing root item " + projectIndex + ": " + item.name + " (type: " + item.constructor.name + ")");
                var processedItem = processItem(item, 0);
                if (processedItem) {
                    logToFile("Processed asset " + item.id + " (already added to assets)");
                }
            }
        } catch (itemError) {
            // If an item fails to process, log the error and continue
            logToFile("Error processing project item " + projectIndex + ": " + itemError.toString());
            continue;
        }
    }

    logToFile("After processing all items:");
    logToFile("Assets count: " + Object.keys(assets).length);
    logToFile("Clips count: " + Object.keys(clips).length);
    
    // Debug: Log all clip IDs and track matte information
    var clipIds = Object.keys(clips);
    var trackMatteCount = 0;
    for (var i = 0; i < clipIds.length; i++) {
        var clip = clips[clipIds[i]];
        logToFile("Clip " + i + ": " + clipIds[i] + " - " + (clip ? clip.clipName : "null"));
        
        // Count track mattes
        if (clip && clip.trackMatte && !clip.trackMatte.error) {
            trackMatteCount++;
            logToFile("  Track matte: " + clip.trackMatte.mode + (clip.trackMatte.inverted ? " (inverted)" : "") + " -> Layer " + clip.trackMatte.matteLayerId);
        }
    }
    
    logToFile("Total track mattes found: " + trackMatteCount);

    // Process Essential Graphics for the active composition
    var essentialGraphicsData = null;
    try {
        if (app.project.activeItem && app.project.activeItem instanceof CompItem) {
            logToFile("Processing Essential Graphics for active comp: " + app.project.activeItem.name);
            essentialGraphicsData = processEssentialGraphics(app.project.activeItem);
            if (essentialGraphicsData && !essentialGraphicsData.error) {
                logToFile("Essential Graphics data exported successfully");
            } else if (essentialGraphicsData && essentialGraphicsData.error) {
                logToFile("Essential Graphics processing had errors: " + essentialGraphicsData.error);
            } else {
                logToFile("No Essential Graphics data found for active composition");
            }
        } else {
            logToFile("No active composition or active item is not a CompItem");
        }
    } catch (egError) {
        logToFile("Error processing Essential Graphics: " + egError.toString());
        essentialGraphicsData = {
            error: "Failed to process Essential Graphics: " + egError.toString()
        };
    }

    // Create the final output object
    var outputData = {
        projectName: app.project.file ? app.project.file.name : "Untitled Project",
        assets: assets,
        clips: clips,
        activeCompId: app.project.activeItem ? app.project.activeItem.id : null,
        essentialGraphics: essentialGraphicsData
    };

    // Convert to JSON and save
    var json = stringify(outputData);
    saveToFile(json);
    
    logToFile("Project export completed successfully!");
    logToFile("Exported " + Object.keys(assets).length + " assets and " + Object.keys(clips).length + " clips");
}

// Start the export process
app.beginUndoGroup("Export Project to JSON");
try {
    logToFile("Starting exportProject function...");
    exportProject();
} catch (exportError) {
    logToFile("Error during project export: " + exportError.toString());
    logToFile("Stack trace: " + exportError.stack);

    // Try to get more error details
    try {
        logToFile("Error name: " + exportError.name);
        logToFile("Error message: " + exportError.message);
        if (exportError.lineNumber) {
            logToFile("Error line: " + exportError.lineNumber);
        }
    } catch (detailError) {
        logToFile("Could not get detailed error info: " + detailError.toString());
    }
}
app.endUndoGroup();
