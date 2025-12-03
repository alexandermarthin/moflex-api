// Polyfill for JSON.stringify (basic implementation for ExtendScript)
function stringify(obj) {
    var json = [];
    var isArray = obj && obj.constructor === Array;

    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            var value = obj[key];
            var valueType = typeof value;

            if (valueType === "string") {
                value = '"' + value + '"';
            } else if (valueType === "object" && value !== null) {
                value = stringify(value);
            }

            json.push((isArray ? "" : '"' + key + '":') + String(value));
        }
    }

    return (isArray ? "[" : "{") + String(json) + (isArray ? "]" : "}");
}

// Save JSON to a file
function saveToFile(text) {
    var saveFile = File("/Users/lumafilm/Documents/code/editor/public/xposition.json");
    saveFile.open("w");
    saveFile.write(text);
    saveFile.close();
    alert("X position data saved successfully to /Users/lumafilm/Documents/code/editor/public/xposition.json");
}

// Get interpolation type
function getInterpolationType(type) {
    switch (type) {
        case 6612: return "LINEAR";
        case 6613: return "BEZIER";
        case 6614: return "HOLD";
        default: return "UNKNOWN";
    }
}

// Main script
function exportXPosition() {
    // Check if a layer is selected
    if (!app.project.activeItem || !(app.project.activeItem instanceof CompItem)) {
        alert("Please select a composition first!");
        return;
    }

    var comp = app.project.activeItem;
    var selectedLayers = comp.selectedLayers;

    if (selectedLayers.length === 0) {
        alert("Please select a layer!");
        return;
    }

    var layer = selectedLayers[0]; // Get the first selected layer
    var position = layer.transform.position;
    
    if (!position) {
        alert("Could not find Position property!");
        return;
    }

    // X position is the first component of the position array
    var xPosition = position.value[0];
    if (xPosition === undefined) {
        alert("Could not find X Position value!");
        return;
    }

    // Get composition frame rate and duration
    var frameRate = comp.frameRate;
    var duration = comp.duration;
    var totalFrames = Math.ceil(duration * frameRate);
    
    // Create array to store frame data
    var frameData = [];
    
    // Store current time to restore it later
    var originalTime = comp.time;
    
    // Get value for each frame
    for (var frame = 0; frame < totalFrames; frame++) {
        var time = frame / frameRate;
        comp.time = time;
        
        frameData.push({
            frame: frame,
            time: time,
            value: position.value[0] // Get X position (first component) at current time
        });
    }
    
    // Restore original time
    comp.time = originalTime;

    // Create the output object
    var outputData = {
        layerName: layer.name,
        compositionName: comp.name,
        frameRate: frameRate,
        totalFrames: totalFrames,
        xPosition: {
            frames: frameData
        }
    };

    // Convert to JSON and save
    var json = stringify(outputData);
    saveToFile(json);
}

// Run the script
app.beginUndoGroup("Export X Position");
exportXPosition();
app.endUndoGroup(); 