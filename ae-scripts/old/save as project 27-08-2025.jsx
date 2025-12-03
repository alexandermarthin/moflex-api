// Polyfill for JSON.stringify (basic implementation for ExtendScript)
function stringify(obj) {
    // Use our custom implementation instead of JSON.stringify
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

// Helper function to log to file instead of console
function logToFile(message) {
    try {
        var logFile = File("/Users/lumafilm/Documents/code/system/apps/files-api/TheBucket/632ab2e9-70fb-429e-a682-a3542fcc9cd8/log.txt");
        logFile.open("a"); // Append mode

        // Create a simple timestamp
        var now = new Date();
        var timestamp = now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate() + " " + now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();

        logFile.writeln(timestamp + " - " + message);
        logFile.close();
    } catch (e) {
        // If logging fails, we can't do much about it
    }
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
    } catch (jsonError) {
        logToFile("ERROR: JSON.stringify test failed: " + jsonError.toString());
    }
} catch (initialError) {
    logToFile("ERROR in initial setup: " + initialError.toString());
    throw initialError;
}

// Polyfill for checking if a variable is an array
function isArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
}

// Save JSON to a fixed location
function saveToFile(text) {
    var saveFile = File("/Users/lumafilm/Documents/code/system/apps/files-api/TheBucket/632ab2e9-70fb-429e-a682-a3542fcc9cd8/project.json");
    saveFile.open("w");
    saveFile.write(text);
    saveFile.close();
}

function getInterpolationType(type) {
    switch (type) {
        case 6612:
            return "LINEAR";
        case 6613:
            return "BEZIER";
        case 6614:
            return "HOLD";

        default:
            return "UNKNOWN";
    }
}

// Main script
function exportProject() {
    var assets = {};
    var clips = {};

    // Helper function to process footage items
    function processFootageItem(item, parentId) {
        var footageData = {
            id: item.id,
            name: item.name,
            parentId: parentId,
            width: item.width,
            height: item.height,
            duration: item.duration,
            frameRate: item.frameRate,
            file: item.file ? item.file.fsName.replace(/\\/g, "/") : "",
            url: item.file ? item.file.fsName.split(/[\/\\]/).pop() : "",
            isStill: item.mainSource.isStill,
            isSolid: item.mainSource instanceof SolidSource,
        };

        // Determine the type based on the footage characteristics
        if (footageData.isStill && !footageData.isSolid) {
            footageData.type = "image";
        } else if (footageData.isSolid) {
            footageData.type = "solid";
            footageData.solidColor = {
                red: item.mainSource.color[0],
                green: item.mainSource.color[1],
                blue: item.mainSource.color[2],
            };
        } else if (!footageData.isStill && footageData.frameRate === 0) {
            footageData.type = "audio";
        } else if (!footageData.isStill && footageData.frameRate > 0) {
            footageData.type = "video";
        }

        assets[item.id] = footageData;
        return footageData;
    }

    // Helper function to process composition
    function processComposition(comp, parentId) {
        var compData = {
            id: comp.id,
            name: comp.name,
            type: "composition",
            parentId: parentId,
            width: comp.width,
            height: comp.height,
            duration: comp.duration,
            frameRate: comp.frameRate,
            backgroundColor: {
                red: comp.bgColor[0],
                green: comp.bgColor[1],
                blue: comp.bgColor[2],
            },
            clipIds: [],
        };

        assets[comp.id] = compData;

        // Debug output for composition processing
        logToFile("Processing composition: " + comp.name + " with " + comp.layers.length + " layers");

        // Log all layers first to understand the order
        for (var l = 1; l <= comp.layers.length; l++) {
            var layerInfo = comp.layers[l];
            logToFile("Layer " + l + " info: name='" + layerInfo.name + "', index=" + layerInfo.index + ", enabled=" + layerInfo.enabled + ", visible=" + layerInfo.enabled);
        }

        // Process each layer in the composition
        for (var i = 1; i <= comp.layers.length; i++) {
            try {
                logToFile("Starting to process layer " + i + " of " + comp.layers.length);

                var layer = comp.layers[i];
                var clipId = comp.id + "_" + (i - 1);

                // Debug output for layer processing
                logToFile("Processing layer " + i + ": " + layer.name + " (type: " + (layer.source ? "has source" : "no source") + ")");
                logToFile("Layer index: " + layer.index + ", enabled: " + layer.enabled);
                logToFile("Loop variable i=" + i + ", layer.name='" + layer.name + "', layer.index=" + layer.index);

                compData.clipIds.push(clipId);

                var layerData = {
                    id: clipId,
                    parentId: comp.id,
                    parentLayerId: layer.parent ? comp.id + "_" + (layer.parent.index - 1) : null,
                    clipName: layer.name,
                    index: layer.index,
                    inPoint: layer.inPoint,
                    outPoint: layer.outPoint,
                    startTime: layer.startTime,
                    enabled: layer.enabled,
                    audioEnabled: layer.audioEnabled,
                    hasAudio: false,
                    audioLevel: 0,
                    isThreeD: layer.threeDLayer,
                    effects: [],
                    properties: {},
                };

                // Check if the source footage has audio
                if (layer.source && layer.source instanceof FootageItem) {
                    try {
                        // Check if the footage has audio by looking for audio properties
                        layerData.hasAudio = layer.source.hasAudio || false;
                    } catch (e) {
                        // If hasAudio property doesn't exist, try to detect audio another way
                        try {
                            // Check if the layer has audio properties
                            var audioProperty = layer.property("Audio");
                            layerData.hasAudio = audioProperty ? true : false;
                        } catch (e2) {
                            layerData.hasAudio = false;
                        }
                    }
                }

                // Get audio level property
                try {
                    var audioProperty = layer.property("Audio");
                    if (audioProperty) {
                        var audioLevelsProperty = audioProperty.property("Audio Levels");
                        if (audioLevelsProperty) {
                            layerData.audioLevel = audioLevelsProperty.value;
                        }
                    }
                } catch (e) {
                    // Audio properties not available for this layer type
                    layerData.audioLevel = 0;
                }

                // Process effects if they exist
                if (layer.effect) {
                    for (var e = 1; e <= layer.effect.numProperties; e++) {
                        try {
                            var effect = layer.effect(e);
                            var effectData = {
                                name: effect.name,
                                matchName: effect.matchName,
                                enabled: effect.enabled,
                                parameters: [],
                            };

                            // Process all parameters of the effect
                            for (var p = 1; p <= effect.numProperties; p++) {
                                try {
                                    var param = effect.property(p);
                                    if (param.propertyType === PropertyType.PROPERTY) {
                                        var paramData = {
                                            name: param.name,
                                            matchName: param.matchName,
                                            value: param.value,
                                            keyframes: [],
                                        };

                                        // Process keyframes if the parameter is animated
                                        if (param.numKeys > 0) {
                                            for (var k = 1; k <= param.numKeys; k++) {
                                                try {
                                                    var keyValue = param.keyValue(k);
                                                    var inEase = param.keyInTemporalEase(k);
                                                    var outEase = param.keyOutTemporalEase(k);

                                                    var keyframe = {
                                                        time: param.keyTime(k),
                                                        value: isArray(keyValue) ? keyValue : keyValue,
                                                        easing: {
                                                            inType: getInterpolationType(param.keyInInterpolationType(k)),
                                                            outType: getInterpolationType(param.keyOutInterpolationType(k)),
                                                            inEase: {
                                                                speed: inEase.speed,
                                                                influence: inEase.influence,
                                                            },
                                                            outEase: {
                                                                speed: outEase.speed,
                                                                influence: outEase.influence,
                                                            },
                                                            continuous: param.keyTemporalContinuous(k),
                                                            autoBezier: param.keyTemporalAutoBezier(k),
                                                        },
                                                    };
                                                    paramData.keyframes.push(keyframe);
                                                } catch (keyframeError) {
                                                    // Skip problematic keyframes
                                                    continue;
                                                }
                                            }
                                        }
                                        effectData.parameters.push(paramData);
                                    }
                                } catch (paramError) {
                                    // Skip parameters that can't be accessed
                                    continue;
                                }
                            }
                            layerData.effects.push(effectData);
                        } catch (effectError) {
                            // Skip problematic effects
                            continue;
                        }
                    }
                }

                // Add source information and determine layer type
                if (layer.source) {
                    layerData.sourceId = layer.source.id;

                    // Determine layer type
                    if (layer.source instanceof CompItem) {
                        layerData.layerType = "composition";
                    } else if (layer.source instanceof FootageItem) {
                        if (layer.source.mainSource instanceof SolidSource) {
                            layerData.layerType = "solid";
                        } else if (layer.source.mainSource.isStill) {
                            layerData.layerType = "image";
                        } else if (!layer.source.mainSource.isStill && layer.source.frameRate === 0) {
                            layerData.layerType = "audio";
                        } else {
                            layerData.layerType = "video";
                        }
                    }
                } else {
                    // Handle special layer types that don't have sources
                    if (layer instanceof TextLayer) {
                        layerData.layerType = "text";
                    } else if (layer instanceof ShapeLayer) {
                        layerData.layerType = "shape";
                    } else if (layer instanceof LightLayer) {
                        layerData.layerType = "light";
                    } else if (layer instanceof CameraLayer) {
                        layerData.layerType = "camera";
                    } else {
                        layerData.layerType = "unknown";
                    }
                }

                // Add text-specific properties if it's a text layer
                if (layer instanceof TextLayer) {
                    try {
                        var sourceTextProp = layer.property("Source Text").value;

                        // Initialize text data object with basic properties
                        layerData.text = {
                            sourceText: sourceTextProp.text,
                            font: sourceTextProp.font,
                            fontSize: sourceTextProp.fontSize,
                            fillColor: sourceTextProp.applyFill ? sourceTextProp.fillColor : null,
                            applyFill: sourceTextProp.applyFill,
                            justification: sourceTextProp.justification,
                            tracking: sourceTextProp.tracking,
                            leading: sourceTextProp.leading,
                        };

                        // Add stroke properties only if stroke is applied
                        if (sourceTextProp.applyStroke) {
                            layerData.text.applyStroke = true;
                            layerData.text.strokeColor = sourceTextProp.strokeColor;
                            layerData.text.strokeWidth = sourceTextProp.strokeWidth;
                            layerData.text.strokeOverFill = sourceTextProp.strokeOverFill;
                        } else {
                            layerData.text.applyStroke = false;
                            layerData.text.strokeColor = null;
                            layerData.text.strokeWidth = null;
                            layerData.text.strokeOverFill = null;
                        }

                        // Add box text properties only if it's box text
                        try {
                            if (sourceTextProp.boxText) {
                                layerData.text.boxText = true;
                                layerData.text.boxTextSize = sourceTextProp.boxTextSize;
                            } else {
                                layerData.text.boxText = false;
                                layerData.text.boxTextSize = null;
                            }
                        } catch (e) {
                            // If boxText property is not available
                            layerData.text.boxText = false;
                            layerData.text.boxTextSize = null;
                        }
                    } catch (textError) {
                        // If text processing fails, still mark as text layer but without content
                        layerData.text = {
                            error: "Failed to process text properties: " + textError.toString(),
                        };
                    }
                }

                // Add shape-specific properties if it's a shape layer
                if (layer instanceof ShapeLayer) {
                    try {
                        var shapeContents = layer.property("Contents");
                        if (shapeContents) {
                            layerData.shapeContents = {
                                contents: [],
                            };

                            // Process shape groups
                            for (var shapeIndex = 1; shapeIndex <= shapeContents.numProperties; shapeIndex++) {
                                try {
                                    var shapeGroup = shapeContents.property(shapeIndex);
                                    if (shapeGroup) {
                                        // Handle both indexed groups and properties
                                        // PropertyType.INDEXED_GROUP = 2, PropertyType.PROPERTY = 1, PropertyType.NAMED_GROUP = 3
                                        if (shapeGroup.propertyType === 2 || shapeGroup.propertyType === PropertyType.INDEXED_GROUP) {
                                            var groupData = processShapeGroup(shapeGroup);
                                            if (groupData) {
                                                layerData.shapeContents.contents.push(groupData);
                                            }
                                        } else if (shapeGroup.propertyType === 1 || shapeGroup.propertyType === PropertyType.PROPERTY) {
                                            // Handle direct properties in shape contents
                                            var propData = processProperty(shapeGroup);
                                            if (propData) {
                                                layerData.shapeContents.contents.push({
                                                    name: propData.name,
                                                    type: "property",
                                                    property: propData,
                                                });
                                            }
                                        } else if (shapeGroup.propertyType === 3 || shapeGroup.propertyType === PropertyType.NAMED_GROUP) {
                                            // Handle named groups
                                            var groupData = processShapeGroup(shapeGroup);
                                            if (groupData) {
                                                layerData.shapeContents.contents.push(groupData);
                                            }
                                        } else {
                                            // Unknown property type, add to debug
                                            layerData.shapeContents.contents.push({
                                                name: shapeGroup.name,
                                                type: "unknown",
                                                propertyType: shapeGroup.propertyType,
                                                matchName: shapeGroup.matchName,
                                            });
                                        }
                                    }
                                } catch (groupError) {
                                    // Skip problematic shape groups
                                    continue;
                                }
                            }

                            // If no contents were found, try alternative approach
                            if (layerData.shapeContents.contents.length === 0) {
                                // Try to access shape content differently
                                try {
                                    // Check if there are any properties directly on the shape layer
                                    var shapeProperties = [];
                                    for (var altIndex = 1; altIndex <= shapeContents.numProperties; altIndex++) {
                                        try {
                                            var prop = shapeContents.property(altIndex);
                                            if (prop) {
                                                shapeProperties.push({
                                                    name: prop.name,
                                                    matchName: prop.matchName,
                                                    propertyType: prop.propertyType,
                                                    numProperties: prop.numProperties || 0,
                                                });
                                            }
                                        } catch (e) {
                                            shapeProperties.push({
                                                index: altIndex,
                                                error: e.toString(),
                                            });
                                        }
                                    }

                                    layerData.shapeContents.debug = {
                                        numProperties: shapeContents.numProperties,
                                        propertyTypes: shapeProperties,
                                        alternative: "Tried alternative property access",
                                    };
                                } catch (debugError) {
                                    layerData.shapeContents.debug = {
                                        error: "Failed to collect debug info: " + debugError.toString(),
                                    };
                                }
                            }
                        } else {
                            layerData.shapeContents = {
                                contents: [],
                                error: "No Contents property found on shape layer",
                            };
                        }
                    } catch (shapeError) {
                        // If shape processing fails, still mark as shape layer but without content
                        layerData.shapeContents = {
                            contents: [],
                            error: "Failed to process shape contents: " + shapeError.toString(),
                        };
                    }
                }

                // Process properties with error handling
                try {
                    processPropertyGroup(layer, layerData.properties, layer.threeDLayer);
                } catch (propertyError) {
                    // If property processing fails, add error info but continue
                    layerData.propertiesError = "Failed to process properties: " + propertyError.toString();
                }

                clips[clipId] = layerData;

                // Debug output for successful layer processing
                logToFile("Successfully processed layer " + i + ": " + layer.name);
                logToFile("About to process next layer (i=" + i + ", total layers=" + comp.layers.length + ")");
                logToFile("Loop will continue to i=" + (i + 1) + " if i <= " + comp.layers.length);
            } catch (layerError) {
                // If an entire layer fails to process, log the error and continue with next layer
                logToFile("Error processing layer " + i + " (" + (comp.layers[i] ? comp.layers[i].name : "unknown") + "): " + layerError.toString());
                logToFile("Layer error details - name: " + layerError.name + ", message: " + layerError.message);

                // Add a placeholder for the failed layer
                var failedClipId = comp.id + "_" + (i - 1);
                compData.clipIds.push(failedClipId);
                clips[failedClipId] = {
                    id: failedClipId,
                    parentId: comp.id,
                    clipName: comp.layers[i] ? comp.layers[i].name : "Layer " + i,
                    index: i,
                    layerType: "error",
                    error: "Failed to process layer: " + layerError.toString(),
                    properties: {},
                };

                logToFile("Added error placeholder for layer " + i);
            }
        }

        // Debug output for composition completion
        logToFile("Completed processing composition: " + comp.name + " with " + compData.clipIds.length + " clips");
        logToFile("Expected " + comp.layers.length + " layers, processed " + compData.clipIds.length + " clips");

        return compData;
    }

    // Helper function to process shape groups
    function processShapeGroup(shapeGroup) {
        try {
            var groupData = {
                name: shapeGroup.name,
                matchName: shapeGroup.matchName,
                type: "group",
                contents: [],
            };

            // Process contents of the shape group
            for (var groupIndex = 1; groupIndex <= shapeGroup.numProperties; groupIndex++) {
                try {
                    var content = shapeGroup.property(groupIndex);
                    if (content) {
                        // PropertyType.INDEXED_GROUP = 2, PropertyType.PROPERTY = 1
                        if (content.propertyType === 2 || content.propertyType === PropertyType.INDEXED_GROUP) {
                            var contentData = processShapeContent(content);
                            if (contentData) {
                                groupData.contents.push(contentData);
                            }
                        } else if (content.propertyType === 1 || content.propertyType === PropertyType.PROPERTY) {
                            // Handle direct properties in shape groups
                            var propData = processProperty(content);
                            if (propData) {
                                groupData.contents.push({
                                    name: propData.name,
                                    type: "property",
                                    property: propData,
                                });
                            }
                        } else {
                            // Unknown property type, add to debug
                            groupData.contents.push({
                                name: content.name,
                                type: "unknown",
                                propertyType: content.propertyType,
                                matchName: content.matchName,
                            });
                        }
                    }
                } catch (contentError) {
                    // Skip problematic content
                    continue;
                }
            }

            return groupData;
        } catch (error) {
            // Return a basic group structure if processing fails
            return {
                name: shapeGroup ? shapeGroup.name : "Unknown",
                matchName: shapeGroup ? shapeGroup.matchName : "Unknown",
                type: "group",
                contents: [],
                error: "Failed to process shape group: " + error.toString(),
            };
        }
    }

    // Helper function to process shape content (paths, fills, strokes, etc.)
    function processShapeContent(content) {
        try {
            var contentData = {
                name: content.name,
                matchName: content.matchName,
                type: "unknown",
            };

            // Determine content type based on matchName
            if (content.matchName === "ADBE Vector Group" || content.matchName === "ADBE Vectors Group") {
                contentData.type = "group";
                contentData.contents = [];

                // Process nested contents
                for (var contentIndex = 1; contentIndex <= content.numProperties; contentIndex++) {
                    try {
                        var nestedContent = content.property(contentIndex);
                        if (nestedContent) {
                            // PropertyType.INDEXED_GROUP = 2, PropertyType.PROPERTY = 1
                            if (nestedContent.propertyType === 2 || nestedContent.propertyType === PropertyType.INDEXED_GROUP) {
                                var nestedData = processShapeContent(nestedContent);
                                if (nestedData) {
                                    contentData.contents.push(nestedData);
                                }
                            } else if (nestedContent.propertyType === 1 || nestedContent.propertyType === PropertyType.PROPERTY) {
                                // Handle direct properties in nested content
                                var propData = processProperty(nestedContent);
                                if (propData) {
                                    contentData.contents.push({
                                        name: propData.name,
                                        type: "property",
                                        property: propData,
                                    });
                                }
                            } else if (nestedContent.propertyType === 6213) {
                                // Handle shape elements with propertyType 6213
                                var shapeElementData = processShapeElement(nestedContent);
                                if (shapeElementData) {
                                    contentData.contents.push(shapeElementData);
                                }
                            } else {
                                // Unknown property type, add to debug
                                contentData.contents.push({
                                    name: nestedContent.name,
                                    type: "unknown",
                                    propertyType: nestedContent.propertyType,
                                    matchName: nestedContent.matchName,
                                });
                            }
                        }
                    } catch (nestedError) {
                        // Skip problematic nested content
                        continue;
                    }
                }

                // If no contents were found, add debug information
                if (contentData.contents.length === 0) {
                    contentData.debug = {
                        numProperties: content.numProperties,
                        propertyTypes: [],
                    };

                    // Collect property types for debugging
                    for (var i = 1; i <= content.numProperties; i++) {
                        try {
                            var nestedContent = content.property(i);
                            if (nestedContent) {
                                contentData.debug.propertyTypes.push({
                                    index: i,
                                    name: nestedContent.name,
                                    matchName: nestedContent.matchName,
                                    propertyType: nestedContent.propertyType,
                                    numProperties: nestedContent.numProperties || 0,
                                });
                            }
                        } catch (e) {
                            contentData.debug.propertyTypes.push({
                                index: i,
                                error: e.toString(),
                            });
                        }
                    }
                }
            } else if (content.matchName === "ADBE Vector Shape - Rect" || content.matchName === "ADBE Vector Shape - Rectangle") {
                contentData.type = "rectangle";
                contentData.rectData = processRectangleData(content);
            } else if (content.matchName === "ADBE Vector Shape - Ellipse" || content.matchName === "ADBE Vector Shape - Circle") {
                contentData.type = "ellipse";
                contentData.ellipseData = processEllipseData(content);
            } else if (content.matchName === "ADBE Vector Shape - Group" || content.matchName === "ADBE Vector Shape - Path") {
                contentData.type = "path";
                contentData.pathData = processPathData(content);
            } else if (content.matchName === "ADBE Vector Graphic - Fill") {
                contentData.type = "fill";
                contentData.fillData = processFillData(content);
            } else if (content.matchName === "ADBE Vector Graphic - Stroke") {
                contentData.type = "stroke";
                contentData.strokeData = processStrokeData(content);
            } else if (content.matchName === "ADBE Vector Filter - Merge") {
                contentData.type = "merge";
                contentData.mergeData = processMergeData(content);
            } else if (content.matchName === "ADBE Vector Filter - Trim") {
                contentData.type = "trim";
                contentData.trimData = processTrimData(content);
            } else if (content.matchName === "ADBE Vector Filter - Repeater") {
                contentData.type = "repeater";
                contentData.repeaterData = processRepeaterData(content);
            } else if (content.matchName === "ADBE Vector Shape - Star") {
                contentData.type = "star";
                contentData.starData = processStarData(content);
            } else if (content.matchName === "ADBE Vector Shape - Polystar") {
                contentData.type = "polystar";
                contentData.polystarData = processPolystarData(content);
            } else {
                // Handle other shape content types - including those with propertyType 6213
                contentData.type = "unknown";
                contentData.properties = {};
                contentData.matchName = content.matchName; // Store the actual match name for debugging
                contentData.propertyType = content.propertyType; // Store the property type for debugging

                // Process all properties
                for (var i = 1; i <= content.numProperties; i++) {
                    try {
                        var prop = content.property(i);
                        if (prop && (prop.propertyType === 1 || prop.propertyType === PropertyType.PROPERTY)) {
                            var propData = processProperty(prop);
                            if (propData) {
                                contentData.properties[propData.name] = propData;
                            }
                        }
                    } catch (propError) {
                        // Skip problematic properties
                        continue;
                    }
                }
            }

            return contentData;
        } catch (error) {
            // Return a basic content structure if processing fails
            return {
                name: content ? content.name : "Unknown",
                matchName: content ? content.matchName : "Unknown",
                type: "unknown",
                error: "Failed to process shape content: " + error.toString(),
            };
        }
    }

    // Helper function to process shape elements with propertyType 6213
    function processShapeElement(shapeElement) {
        try {
            var elementData = {
                name: shapeElement.name,
                matchName: shapeElement.matchName,
                type: "unknown",
                properties: {},
            };

            // Determine element type based on matchName
            if (shapeElement.matchName === "ADBE Vector Shape - Group" || shapeElement.matchName === "ADBE Vector Shape - Path") {
                elementData.type = "path";
                elementData.pathData = processPathData(shapeElement);
            } else if (shapeElement.matchName === "ADBE Vector Graphic - Fill") {
                elementData.type = "fill";
                elementData.fillData = processFillData(shapeElement);
            } else if (shapeElement.matchName === "ADBE Vector Graphic - Stroke") {
                elementData.type = "stroke";
                elementData.strokeData = processStrokeData(shapeElement);
            } else if (shapeElement.matchName === "ADBE Vector Shape - Rect" || shapeElement.matchName === "ADBE Vector Shape - Rectangle") {
                elementData.type = "rectangle";
                elementData.rectData = processRectangleData(shapeElement);
            } else if (shapeElement.matchName === "ADBE Vector Shape - Ellipse" || shapeElement.matchName === "ADBE Vector Shape - Circle") {
                elementData.type = "ellipse";
                elementData.ellipseData = processEllipseData(shapeElement);
            } else {
                // Handle other shape element types
                elementData.type = "unknown";
                elementData.matchName = shapeElement.matchName;
                elementData.propertyType = shapeElement.propertyType;

                // Process all properties
                for (var elementIndex = 1; elementIndex <= shapeElement.numProperties; elementIndex++) {
                    try {
                        var prop = shapeElement.property(elementIndex);
                        if (prop && (prop.propertyType === 1 || prop.propertyType === PropertyType.PROPERTY)) {
                            var propData = processProperty(prop);
                            if (propData) {
                                elementData.properties[propData.name] = propData;
                            }
                        }
                    } catch (propError) {
                        // Skip problematic properties
                        continue;
                    }
                }
            }

            return elementData;
        } catch (error) {
            // Return a basic element structure if processing fails
            return {
                name: shapeElement ? shapeElement.name : "Unknown",
                matchName: shapeElement ? shapeElement.matchName : "Unknown",
                type: "unknown",
                propertyType: shapeElement ? shapeElement.propertyType : "Unknown",
                error: "Failed to process shape element: " + error.toString(),
            };
        }
    }

    // Helper function to process rectangle data
    function processRectangleData(rectContent) {
        try {
            var rectData = {};

            for (var rectIndex = 1; rectIndex <= rectContent.numProperties; rectIndex++) {
                try {
                    var prop = rectContent.property(rectIndex);
                    if (prop && prop.propertyType === PropertyType.PROPERTY) {
                        var propData = processProperty(prop);
                        if (propData) {
                            rectData[propData.name] = propData;
                        }
                    }
                } catch (propError) {
                    // Skip problematic properties
                    continue;
                }
            }

            return rectData;
        } catch (error) {
            return {
                error: "Failed to process rectangle data: " + error.toString(),
            };
        }
    }

    // Helper function to process ellipse data
    function processEllipseData(ellipseContent) {
        try {
            var ellipseData = {};

            for (var ellipseIndex = 1; ellipseIndex <= ellipseContent.numProperties; ellipseIndex++) {
                try {
                    var prop = ellipseContent.property(ellipseIndex);
                    if (prop && prop.propertyType === PropertyType.PROPERTY) {
                        var propData = processProperty(prop);
                        if (propData) {
                            ellipseData[propData.name] = propData;
                        }
                    }
                } catch (propError) {
                    // Skip problematic properties
                    continue;
                }
            }

            return ellipseData;
        } catch (error) {
            return {
                error: "Failed to process ellipse data: " + error.toString(),
            };
        }
    }

    // Helper function to process path data
    function processPathData(pathContent) {
        try {
            var pathData = {};

            for (var pathIndex = 1; pathIndex <= pathContent.numProperties; pathIndex++) {
                try {
                    var prop = pathContent.property(pathIndex);
                    if (prop && (prop.propertyType === 1 || prop.propertyType === PropertyType.PROPERTY)) {
                        var propData = processProperty(prop);
                        if (propData) {
                            pathData[propData.name] = propData;
                        }
                    }
                } catch (propError) {
                    // Skip problematic properties
                    continue;
                }
            }

            return pathData;
        } catch (error) {
            return {
                error: "Failed to process path data: " + error.toString(),
            };
        }
    }

    // Helper function to process fill data
    function processFillData(fillContent) {
        try {
            var fillData = {
                enabled: fillContent.enabled,
                properties: {},
            };

            for (var fillIndex = 1; fillIndex <= fillContent.numProperties; fillIndex++) {
                try {
                    var prop = fillContent.property(fillIndex);
                    if (prop && (prop.propertyType === 1 || prop.propertyType === PropertyType.PROPERTY)) {
                        var propData = processProperty(prop);
                        if (propData) {
                            fillData.properties[propData.name] = propData;
                        }
                    }
                } catch (propError) {
                    // Skip problematic properties
                    continue;
                }
            }

            return fillData;
        } catch (error) {
            return {
                enabled: false,
                properties: {},
                error: "Failed to process fill data: " + error.toString(),
            };
        }
    }

    // Helper function to process stroke data
    function processStrokeData(strokeContent) {
        try {
            var strokeData = {
                enabled: strokeContent.enabled,
                properties: {},
            };

            for (var strokeIndex = 1; strokeIndex <= strokeContent.numProperties; strokeIndex++) {
                try {
                    var prop = strokeContent.property(strokeIndex);
                    if (prop && (prop.propertyType === 1 || prop.propertyType === PropertyType.PROPERTY)) {
                        var propData = processProperty(prop);
                        if (propData) {
                            strokeData.properties[propData.name] = propData;
                        }
                    }
                } catch (propError) {
                    // Skip problematic properties
                    continue;
                }
            }

            return strokeData;
        } catch (error) {
            return {
                enabled: false,
                properties: {},
                error: "Failed to process stroke data: " + error.toString(),
            };
        }
    }

    // Helper function to process merge data
    function processMergeData(mergeContent) {
        try {
            var mergeData = {
                enabled: mergeContent.enabled,
                properties: {},
            };

            for (var mergeIndex = 1; mergeIndex <= mergeContent.numProperties; mergeIndex++) {
                try {
                    var prop = mergeContent.property(mergeIndex);
                    if (prop && prop.propertyType === PropertyType.PROPERTY) {
                        var propData = processProperty(prop);
                        if (propData) {
                            mergeData.properties[propData.name] = propData;
                        }
                    }
                } catch (propError) {
                    // Skip problematic properties
                    continue;
                }
            }

            return mergeData;
        } catch (error) {
            return {
                enabled: false,
                properties: {},
                error: "Failed to process merge data: " + error.toString(),
            };
        }
    }

    // Helper function to process trim data
    function processTrimData(trimContent) {
        try {
            var trimData = {
                enabled: trimContent.enabled,
                properties: {},
            };

            for (var trimIndex = 1; trimIndex <= trimContent.numProperties; trimIndex++) {
                try {
                    var prop = trimContent.property(trimIndex);
                    if (prop && prop.propertyType === PropertyType.PROPERTY) {
                        var propData = processProperty(prop);
                        if (propData) {
                            trimData.properties[propData.name] = propData;
                        }
                    }
                } catch (propError) {
                    // Skip problematic properties
                    continue;
                }
            }

            return trimData;
        } catch (error) {
            return {
                enabled: false,
                properties: {},
                error: "Failed to process trim data: " + error.toString(),
            };
        }
    }

    // Helper function to process repeater data
    function processRepeaterData(repeaterContent) {
        try {
            var repeaterData = {
                enabled: repeaterContent.enabled,
                properties: {},
            };

            for (var repeaterIndex = 1; repeaterIndex <= repeaterContent.numProperties; repeaterIndex++) {
                try {
                    var prop = repeaterContent.property(repeaterIndex);
                    if (prop && prop.propertyType === PropertyType.PROPERTY) {
                        var propData = processProperty(prop);
                        if (propData) {
                            repeaterData.properties[propData.name] = propData;
                        }
                    }
                } catch (propError) {
                    // Skip problematic properties
                    continue;
                }
            }

            return repeaterData;
        } catch (error) {
            return {
                enabled: false,
                properties: {},
                error: "Failed to process repeater data: " + error.toString(),
            };
        }
    }

    // Helper function to process star data
    function processStarData(starContent) {
        try {
            var starData = {};

            for (var starIndex = 1; starIndex <= starContent.numProperties; starIndex++) {
                try {
                    var prop = starContent.property(starIndex);
                    if (prop && prop.propertyType === PropertyType.PROPERTY) {
                        var propData = processProperty(prop);
                        if (propData) {
                            starData[propData.name] = propData;
                        }
                    }
                } catch (propError) {
                    // Skip problematic properties
                    continue;
                }
            }

            return starData;
        } catch (error) {
            return {
                error: "Failed to process star data: " + error.toString(),
            };
        }
    }

    // Helper function to process polystar data
    function processPolystarData(polystarContent) {
        try {
            var polystarData = {};

            for (var polystarIndex = 1; polystarIndex <= polystarContent.numProperties; polystarIndex++) {
                try {
                    var prop = polystarContent.property(polystarIndex);
                    if (prop && prop.propertyType === PropertyType.PROPERTY) {
                        var propData = processProperty(prop);
                        if (propData) {
                            polystarData[propData.name] = propData;
                        }
                    }
                } catch (propError) {
                    // Skip problematic properties
                    continue;
                }
            }

            return polystarData;
        } catch (error) {
            return {
                error: "Failed to process polystar data: " + error.toString(),
            };
        }
    }

    // Helper function to get property value at current time
    function getPropertyValue(prop) {
        if (prop.value instanceof Array) {
            return prop.value;
        }
        return prop.value;
    }

    // Helper function to process a single property
    function processProperty(property) {
        var propData = {
            name: property.name,
            propertyIndex: property.propertyIndex,
            value: getPropertyValue(property),
            keyframes: [],
        };

        if (property.isTimeVarying && property.numKeys > 0) {
            for (var k = 1; k <= property.numKeys; k++) {
                var keyValue = property.keyValue(k);
                var inEase = property.keyInTemporalEase(k)[0];
                var outEase = property.keyOutTemporalEase(k)[0];

                var keyframe = {
                    time: property.keyTime(k),
                    value: isArray(keyValue) ? keyValue : keyValue,
                    easing: {
                        inType: getInterpolationType(property.keyInInterpolationType(k)),
                        outType: getInterpolationType(property.keyOutInterpolationType(k)),
                        inEase: {
                            speed: inEase.speed,
                            influence: inEase.influence,
                        },
                        outEase: {
                            speed: outEase.speed,
                            influence: outEase.influence,
                        },
                        continuous: property.keyTemporalContinuous(k),
                        autoBezier: property.keyTemporalAutoBezier(k),
                    },
                };
                propData.keyframes.push(keyframe);
            }
        }
        return propData;
    }

    // Helper function to create keyframe data with proper easing
    function createKeyframeData(property, k, valueIndex) {
        try {
            var keyValue = property.keyValue(k);
            var inEase = property.keyInTemporalEase(k)[0];
            var outEase = property.keyOutTemporalEase(k)[0];

            return {
                time: property.keyTime(k),
                value: keyValue instanceof Array ? keyValue[valueIndex] : keyValue,
                easing: {
                    inType: getInterpolationType(property.keyInInterpolationType(k)),
                    outType: getInterpolationType(property.keyOutInterpolationType(k)),
                    inEase: {
                        speed: inEase.speed,
                        influence: inEase.influence,
                    },
                    outEase: {
                        speed: outEase.speed,
                        influence: outEase.influence,
                    },
                    continuous: property.keyTemporalContinuous(k),
                    autoBezier: property.keyTemporalAutoBezier(k),
                },
            };
        } catch (e) {
            // If there's an error accessing keyframe data, return null
            return null;
        }
    }

    // Add this new helper function after the existing createKeyframeData function
    function create3DKeyframeData(property, k, valueIndex) {
        try {
            var keyValue = property.keyValue(k);
            var inEase = property.keyInTemporalEase(k);
            var outEase = property.keyOutTemporalEase(k);

            return {
                time: property.keyTime(k),
                value: keyValue[valueIndex],
                easing: {
                    inType: getInterpolationType(property.keyInInterpolationType(k)),
                    outType: getInterpolationType(property.keyOutInterpolationType(k)),
                    inEase: {
                        speed: inEase[0].speed,
                        influence: inEase[0].influence,
                    },
                    outEase: {
                        speed: outEase[0].speed,
                        influence: outEase[0].influence,
                    },
                    continuous: property.keyTemporalContinuous(k),
                    autoBezier: property.keyTemporalAutoBezier(k),
                },
            };
        } catch (e) {
            return null;
        }
    }

    // Process a property group recursively
    function processPropertyGroup(propertyGroup, output, is3D) {
        try {
            // Debug output for property group processing
            logToFile("Processing property group: " + propertyGroup.name);

            // Always include transform properties if this is the transform group
            if (propertyGroup.name === "Transform") {
                // Define all transform properties with their separated components
                var transformIndexes = {
                    1: "Anchor Point", // Will be converted to X, Y, Z Anchor Point
                    2: "Position", // Will be converted to X, Y, Z Position
                    3: "X Position",
                    4: "Y Position",
                    5: "Z Position",
                    6: "Scale", // Will be converted to X, Y, Z Scale
                    7: "Orientation", // Will be converted to X, Y, Z Orientation
                    8: "X Rotation",
                    9: "Y Rotation",
                    10: "Z Rotation",
                    11: "Opacity",
                };

                // Process each transform property by index
                var separated = propertyGroup(2).dimensionsSeparated;

                for (var index = 1; index <= 11; index++) {
                    try {
                        var prop = propertyGroup(index);

                        if (!prop) continue; // Skip if property doesn't exist

                        // For Scale specifically, add extra validation
                        if (index === 6) {
                            if (!prop.value) continue; // Skip if no value

                            var scaleValue = prop.value;

                            try {
                                output["X Scale"] = {
                                    name: "X Scale",
                                    propertyIndex: 6,
                                    value: scaleValue[0],
                                    keyframes: [],
                                };

                                if (prop.numKeys > 0) {
                                    var xKeyframes = [];
                                    for (var k = 1; k <= prop.numKeys; k++) {
                                        var kf = createKeyframeData(prop, k, 0);
                                        if (kf) xKeyframes.push(kf);
                                    }
                                    output["X Scale"].keyframes = xKeyframes;
                                }

                                // Similar for Y Scale
                                output["Y Scale"] = {
                                    name: "Y Scale",
                                    propertyIndex: 6,
                                    value: scaleValue[1],
                                    keyframes: [],
                                };

                                if (prop.numKeys > 0) {
                                    var yKeyframes = [];
                                    for (var k = 1; k <= prop.numKeys; k++) {
                                        var kf = createKeyframeData(prop, k, 1);
                                        if (kf) yKeyframes.push(kf);
                                    }
                                    output["Y Scale"].keyframes = yKeyframes;
                                }

                                // Z Scale if available
                                if (scaleValue.length > 2) {
                                    output["Z Scale"] = {
                                        name: "Z Scale",
                                        propertyIndex: 6,
                                        value: scaleValue[2],
                                        keyframes: [],
                                    };

                                    if (prop.numKeys > 0) {
                                        var zKeyframes = [];
                                        for (var k = 1; k <= prop.numKeys; k++) {
                                            var kf = createKeyframeData(prop, k, 2);
                                            if (kf) zKeyframes.push(kf);
                                        }
                                        output["Z Scale"].keyframes = zKeyframes;
                                    }
                                }
                            } catch (scaleError) {
                                logToFile("Error processing scale: " + scaleError.toString());
                            }
                        }
                        // Handle Anchor Point (index 1)
                        if (index === 1) {
                            var anchorValue = prop.value;

                            output["X Anchor Point"] = {
                                name: "X Anchor Point",
                                propertyIndex: 1,
                                value: anchorValue[0],
                                keyframes: [],
                            };

                            if (prop.numKeys > 0) {
                                var xKeyframes = [];
                                for (var k = 1; k <= prop.numKeys; k++) {
                                    var kf = createKeyframeData(prop, k, 0);
                                    if (kf) xKeyframes.push(kf);
                                }
                                output["X Anchor Point"].keyframes = xKeyframes;
                            }

                            output["Y Anchor Point"] = {
                                name: "Y Anchor Point",
                                propertyIndex: 1,
                                value: anchorValue[1],
                                keyframes: [],
                            };

                            if (prop.numKeys > 0) {
                                var yKeyframes = [];
                                for (var k = 1; k <= prop.numKeys; k++) {
                                    var kf = createKeyframeData(prop, k, 1);
                                    if (kf) yKeyframes.push(kf);
                                }
                                output["Y Anchor Point"].keyframes = yKeyframes;
                            }

                            output["Z Anchor Point"] = {
                                name: "Z Anchor Point",
                                propertyIndex: 1,
                                value: anchorValue[2] || 0,
                                keyframes: [],
                            };

                            if (prop.numKeys > 0) {
                                var zKeyframes = [];
                                for (var k = 1; k <= prop.numKeys; k++) {
                                    var kf = createKeyframeData(prop, k, 2);
                                    if (kf) zKeyframes.push(kf);
                                }
                                output["Z Anchor Point"].keyframes = zKeyframes;
                            }
                        }
                        // Handle Position (index 2-5)
                        if (index >= 2 && index <= 5) {
                            if (separated < 1) {
                                if (index === 2) {
                                    // Position is unified so we need to split it up
                                    var posValue = prop.value;
                                    var xKeyframes = [];
                                    var yKeyframes = [];
                                    var zKeyframes = [];

                                    if (prop.numKeys > 0) {
                                        for (var k = 1; k <= prop.numKeys; k++) {
                                            var xKf = create3DKeyframeData(prop, k, 0);
                                            var yKf = create3DKeyframeData(prop, k, 1);
                                            var zKf = create3DKeyframeData(prop, k, 2);

                                            if (xKf) xKeyframes.push(xKf);
                                            if (yKf) yKeyframes.push(yKf);
                                            if (zKf) zKeyframes.push(zKf);
                                        }
                                    }

                                    output["X Position"] = {
                                        name: "X Position",
                                        propertyIndex: index,
                                        value: posValue[0],
                                        keyframes: xKeyframes,
                                    };

                                    output["Y Position"] = {
                                        name: "Y Position",
                                        propertyIndex: index,
                                        value: posValue[1],
                                        keyframes: yKeyframes,
                                    };

                                    output["Z Position"] = {
                                        name: "Z Position",
                                        propertyIndex: index,
                                        value: posValue[2],
                                        keyframes: zKeyframes,
                                    };
                                }
                            } else {
                                if (index >= 3 && index <= 5) {
                                    // Position is separated so we use it as it is
                                    var posNames = ["X Position", "Y Position", "Z Position"];
                                    var keyframes = [];

                                    if (prop.numKeys > 0) {
                                        for (var k = 1; k <= prop.numKeys; k++) {
                                            var kf = createKeyframeData(prop, k, 0);
                                            if (kf) keyframes.push(kf);
                                        }
                                    }

                                    output[posNames[index - 3]] = {
                                        name: posNames[index - 3],
                                        propertyIndex: index,
                                        value: prop.value,
                                        keyframes: keyframes,
                                    };
                                }
                            }
                        }
                        // Handle Orientation (index 7)
                        if (index === 7) {
                            var orientValue = prop.value;

                            output["X Orientation"] = {
                                name: "X Orientation",
                                propertyIndex: 7,
                                value: orientValue[0],
                                keyframes: [],
                            };

                            if (prop.numKeys > 0) {
                                var xKeyframes = [];
                                for (var k = 1; k <= prop.numKeys; k++) {
                                    var kf = createKeyframeData(prop, k, 0);
                                    if (kf) xKeyframes.push(kf);
                                }
                                output["X Orientation"].keyframes = xKeyframes;
                            }

                            output["Y Orientation"] = {
                                name: "Y Orientation",
                                propertyIndex: 7,
                                value: orientValue[1],
                                keyframes: [],
                            };

                            if (prop.numKeys > 0) {
                                var yKeyframes = [];
                                for (var k = 1; k <= prop.numKeys; k++) {
                                    var kf = createKeyframeData(prop, k, 1);
                                    if (kf) yKeyframes.push(kf);
                                }
                                output["Y Orientation"].keyframes = yKeyframes;
                            }

                            output["Z Orientation"] = {
                                name: "Z Orientation",
                                propertyIndex: 7,
                                value: orientValue[2],
                                keyframes: [],
                            };

                            if (prop.numKeys > 0) {
                                var zKeyframes = [];
                                for (var k = 1; k <= prop.numKeys; k++) {
                                    var kf = createKeyframeData(prop, k, 2);
                                    if (kf) zKeyframes.push(kf);
                                }
                                output["Z Orientation"].keyframes = zKeyframes;
                            }
                        }
                        // Handle all other properties normally (Rotation and Opacity)
                        if (index >= 8 && index != 10) {
                            var propData = processProperty(prop);
                            output[propData.name] = propData;
                        }
                        // Handle Z Rotation (index 10)
                        if (index === 10) {
                            var propData = processProperty(prop);
                            output["Z Rotation"] = propData;
                            continue; // Skip the default processing
                        }
                    } catch (e) {
                        // Property might not exist for this layer type
                        continue;
                    }
                }
            }

            // Process other properties as before
            for (var propIndex = 1; propIndex <= propertyGroup.numProperties; propIndex++) {
                var property = propertyGroup.property(propIndex);

                if (property.propertyType === PropertyType.PROPERTY) {
                    // Skip transform properties as they're handled above
                    if (propertyGroup.name === "Transform" && property.propertyIndex <= 11) {
                        continue;
                    }

                    if (property.isTimeVarying) {
                        var propData = processProperty(property);
                        output[propData.name] = propData;
                    }
                } else if (property.propertyType === PropertyType.INDEXED_GROUP || property.propertyType === PropertyType.NAMED_GROUP) {
                    processPropertyGroup(property, output, is3D);
                }
            }

            // Add this helper function to process text animators
            function processTextAnimator(animator) {
                var animatorData = {
                    name: animator.name,
                    properties: [],
                };

                // Process animator properties
                for (var animIndex = 1; animIndex <= animator.numProperties; animIndex++) {
                    var prop = animator.property(animIndex);

                    if (prop.propertyType === PropertyType.PROPERTY) {
                        var propData = processProperty(prop);
                        if (propData) {
                            animatorData.properties.push(propData);
                        }
                    } else if (prop.name === "Range Selector") {
                        var rangeData = {
                            name: "Range Selector",
                            start: prop.property("Start").value,
                            end: prop.property("End").value,
                            offset: prop.property("Offset").value,
                            mode: prop.property("Mode").value,
                            amount: prop.property("Amount").value,
                            shape: prop.property("Shape").value,
                            smoothness: prop.property("Smoothness").value,
                            easingProperties: [],
                        };

                        // Add keyframe data for animated range selector properties
                        ["Start", "End", "Offset", "Amount"].forEach(function (propName) {
                            var rangeProp = prop.property(propName);
                            if (rangeProp.numKeys > 0) {
                                var keyframes = [];
                                for (var k = 1; k <= rangeProp.numKeys; k++) {
                                    var kf = createKeyframeData(rangeProp, k, 0);
                                    if (kf) keyframes.push(kf);
                                }
                                rangeData.easingProperties.push({
                                    name: propName,
                                    keyframes: keyframes,
                                });
                            }
                        });

                        animatorData.properties.push(rangeData);
                    }
                }

                return animatorData;
            }

            // In the main property group processing loop, add handling for text animators
            if (propertyGroup.name === "Text") {
                var textAnimators = [];

                // Process all text animators
                for (var textIndex = 1; textIndex <= propertyGroup.numProperties; textIndex++) {
                    var prop = propertyGroup.property(textIndex);
                    if (prop.matchName === "ADBE Text Animator") {
                        textAnimators.push(processTextAnimator(prop));
                    }
                }

                if (textAnimators.length > 0) {
                    output["Text Animators"] = {
                        name: "Text Animators",
                        animators: textAnimators,
                    };
                }
            }
        } catch (e) {
            // If an error occurs during property group processing, log it
            logToFile("Error processing property group: " + propertyGroup.name + " - " + e.toString());
            // Optionally, you might want to re-throw or handle the error more gracefully
        }

        // Debug output for successful property group processing
        logToFile("Completed processing property group: " + propertyGroup.name);
    }

    // Helper function to process folder items
    function processFolderItem(item, parentId) {
        var folderData = {
            id: item.id,
            name: item.name,
            type: "folder",
            parentId: parentId,
        };

        assets[item.id] = folderData;

        // Process items in the folder
        for (var folderIndex = 1; folderIndex <= item.numItems; folderIndex++) {
            var subItem = item.item(folderIndex);
            processItem(subItem, item.id);
        }

        return folderData;
    }

    // Helper function to process any project item
    function processItem(item, parentId) {
        if (item instanceof FolderItem) {
            return processFolderItem(item, parentId);
        } else if (item instanceof CompItem) {
            return processComposition(item, parentId);
        } else if (item instanceof FootageItem) {
            return processFootageItem(item, parentId);
        }
        return null;
    }

    // Process all root items in the project
    for (var projectIndex = 1; projectIndex <= app.project.numItems; projectIndex++) {
        try {
            var item = app.project.item(projectIndex);
            if (item.parentFolder === app.project.rootFolder) {
                processItem(item, 0);
            }
        } catch (itemError) {
            // If an item fails to process, log the error and continue
            logToFile("Error processing project item " + projectIndex + ": " + itemError.toString());
            continue;
        }
    }

    // Create the final output object
    var outputData = {
        projectName: app.project.file ? app.project.file.name : "Untitled Project",
        assets: assets,
        clips: clips,
        activeCompId: app.project.activeItem ? app.project.activeItem.id : null,
    };

    // Convert to JSON and save
    var json = stringify(outputData);
    saveToFile(json);
}

app.beginUndoGroup("Export Project to JSON");
try {
    logToFile("Starting exportProject function...");
    exportProject();
    logToFile("Project export completed successfully!");
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
