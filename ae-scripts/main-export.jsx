// After Effects Project Export Script - Main Module
// This is the main entry point that orchestrates the entire export process

// =============================================================================
// CONFIGURATION - Edit these paths for your environment
// =============================================================================
var CONFIG = {
    outputPath: "/Users/lumafilm/Documents/code/moflex-api/editor/public/project.json",
    logPath: "/Users/lumafilm/Documents/code/moflex-api/editor/public/log.txt",
    logLevel: 1  // 0=off, 1=errors+milestones only, 2=verbose debug
};

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

// Startup validation
logToFile("=== Export Script Started ===", 1);

if (typeof app === "undefined") {
    logToFile("ERROR: After Effects app object is not available", 1);
    throw new Error("After Effects app object is not available");
}

if (typeof app.project === "undefined") {
    logToFile("ERROR: After Effects project is not available", 1);
    throw new Error("After Effects project is not available");
}

// Main script
function exportProject() {
    // Clear previous data
    assets = {};
    clips = {};

    // Process all root items in the project
    for (var projectIndex = 1; projectIndex <= app.project.numItems; projectIndex++) {
        try {
            var item = app.project.item(projectIndex);
            if (item.parentFolder === app.project.rootFolder) {
                processItem(item, 0);
            }
        } catch (itemError) {
            logToFile("Error processing project item " + projectIndex + ": " + itemError.toString(), 1);
            continue;
        }
    }

    // Process Essential Graphics for the active composition
    var essentialGraphicsData = null;
    try {
        if (app.project.activeItem && app.project.activeItem instanceof CompItem) {
            essentialGraphicsData = processEssentialGraphics(app.project.activeItem);
            if (essentialGraphicsData && essentialGraphicsData.error) {
                logToFile("Essential Graphics error: " + essentialGraphicsData.error, 1);
            }
        }
    } catch (egError) {
        logToFile("Error processing Essential Graphics: " + egError.toString(), 1);
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
    
    logToFile("Export complete: " + Object.keys(assets).length + " assets, " + Object.keys(clips).length + " clips", 1);
}

// Start the export process
app.beginUndoGroup("Export Project to JSON");
try {
    exportProject();
} catch (exportError) {
    logToFile("ERROR: Export failed - " + exportError.toString(), 1);
    if (exportError.line) {
        logToFile("  at line: " + exportError.line, 1);
    }
}
app.endUndoGroup();
