// After Effects Project Export Script - Layer Processors Module
// Handles different types of layers including footage, compositions, text, shape, and other layer types
// Note: Global variables 'assets' and 'clips' are defined in main-export.jsx

// Helper function to process footage items
function processFootageItem(item, parentId) {
    var mainSource = item.mainSource;
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
        isStill: mainSource ? mainSource.isStill : false,
        isSolid: mainSource ? (mainSource instanceof SolidSource) : false,
    };

    // Determine the type based on the footage characteristics
    if (footageData.isStill && !footageData.isSolid) {
        footageData.type = "image";
    } else if (footageData.isSolid && mainSource) {
        footageData.type = "solid";
        footageData.solidColor = {
            red: mainSource.color[0],
            green: mainSource.color[1],
            blue: mainSource.color[2],
        };
    } else if (!footageData.isStill && footageData.frameRate === 0) {
        footageData.type = "audio";
    } else if (!footageData.isStill && footageData.frameRate > 0) {
        footageData.type = "video";
    }

    // Add footage to assets
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

    // Add composition to assets
    assets[comp.id] = compData;

    // Process each layer in the composition
    for (var i = 1; i <= comp.layers.length; i++) {
        var clipId = comp.id + "_" + (i - 1);
        compData.clipIds.push(clipId);
        
        try {
            var layer = comp.layers[i];

            var layerData = processLayer(layer, clipId, comp.id);
            if (layerData) {
                clips[clipId] = layerData;
            }
        } catch (layerError) {
            // If an entire layer fails to process, log the error and add placeholder
            logToFile("Error processing layer " + i + " (" + (comp.layers[i] ? comp.layers[i].name : "unknown") + "): " + layerError.toString(), 1);

            clips[clipId] = {
                id: clipId,
                parentId: comp.id,
                clipName: comp.layers[i] ? comp.layers[i].name : "Layer " + i,
                index: i,
                layerType: "error",
                error: "Failed to process layer: " + layerError.toString(),
                properties: {},
            };
        }
    }

    return compData;
}

// Helper function to process a single layer
function processLayer(layer, clipId, compId) {
    var layerData = {
        id: clipId,
        parentId: compId,
        parentLayerId: layer.parent ? compId + "_" + (layer.parent.index - 1) : null,
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
        layerData.effects = processEffects(layer);
    }

    // Capture blending mode
    try {
        if (typeof layer.blendingMode !== "undefined") {
            layerData.blendingModeEnum = layer.blendingMode; // Raw AE enum value
            layerData.blendMode = mapBlendingModeToString(layer.blendingMode); // Normalized string for compositor
        }
    } catch (blendErr) {
        layerData.blendMode = "normal";
    }

    // Add source information and determine layer type
    if (layer.source) {
        layerData.sourceId = layer.source.id;
        layerData.layerType = determineLayerType(layer);
    } else {
        // Handle special layer types that don't have sources
        layerData.layerType = determineSpecialLayerType(layer);
    }

    // Add text-specific properties if it's a text layer
    if (layer instanceof TextLayer) {
        layerData.text = processTextLayer(layer);
    }

    // Add shape-specific properties if it's a shape layer
    if (layer instanceof ShapeLayer) {
        layerData.shapeContents = processShapeLayer(layer);
    }

    // Process masks if they exist
    layerData.masks = processMasks(layer);

    // Process track matte information
    layerData.trackMatte = processTrackMatte(layer, compId);

    // Process properties with error handling
    try {
        processPropertyGroup(layer, layerData.properties, layer.threeDLayer);
    } catch (propertyError) {
        // If property processing fails, add error info but continue
        layerData.propertiesError = "Failed to process properties: " + propertyError.toString();
    }

    return layerData;
}

// Map AE BlendingMode enum to normalized string used by the compositor
function mapBlendingModeToString(mode) {
    var result = "normal";
    try {
        switch (mode) {
            case BlendingMode.NORMAL:
                result = "normal";
                break;
            case BlendingMode.MULTIPLY:
                result = "multiply";
                break;
            case BlendingMode.SCREEN:
                result = "screen";
                break;
            case BlendingMode.OVERLAY:
                result = "overlay";
                break;
            case BlendingMode.ADD:
                result = "add";
                break;
            case BlendingMode.DARKEN:
                result = "darken";
                break;
            case BlendingMode.LIGHTEN:
                result = "lighten";
                break;
            // Common alternates mapped to closest supported
            case BlendingMode.COLOR_BURN:
                result = "darken";
                break;
            case BlendingMode.LINEAR_BURN:
                result = "darken";
                break;
            case BlendingMode.COLOR_DODGE:
                result = "lighten";
                break;
            case BlendingMode.LINEAR_DODGE:
                result = "add";
                break;
            case BlendingMode.HARD_LIGHT:
                result = "overlay";
                break;
            case BlendingMode.SOFT_LIGHT:
                result = "overlay";
                break;
            case BlendingMode.DARKER_COLOR:
                result = "darken";
                break;
            case BlendingMode.LIGHTER_COLOR:
                result = "lighten";
                break;
            default:
                result = "normal";
                break;
        }
    } catch (e) {
        result = "normal";
    }
    return result;
}

// Process effects for a layer
function processEffects(layer) {
    var effects = [];

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
                                    var inEase = param.keyInTemporalEase(k)[0];
                                    var outEase = param.keyOutTemporalEase(k)[0];

                                    var keyframe = {
                                        time: param.keyTime(k),
                                        value: keyValue,
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
            effects.push(effectData);
        } catch (effectError) {
            // Skip problematic effects
            continue;
        }
    }

    return effects;
}

// Determine layer type based on source
function determineLayerType(layer) {
    if (layer.source instanceof CompItem) {
        return "composition";
    } else if (layer.source instanceof FootageItem) {
        var mainSource = layer.source.mainSource;
        if (!mainSource) {
            return "unknown";
        }
        if (mainSource instanceof SolidSource) {
            return "solid";
        } else if (mainSource.isStill) {
            return "image";
        } else if (!mainSource.isStill && layer.source.frameRate === 0) {
            return "audio";
        } else {
            return "video";
        }
    }
    return "unknown";
}

// Determine special layer type
function determineSpecialLayerType(layer) {
    if (layer instanceof TextLayer) {
        return "text";
    } else if (layer instanceof ShapeLayer) {
        return "shape";
    } else if (layer instanceof LightLayer) {
        return "light";
    } else if (layer instanceof CameraLayer) {
        return "camera";
    } else {
        return "unknown";
    }
}

// Process text layer properties
function processTextLayer(layer) {
    try {
        var sourceTextProp = layer.property("Source Text").value;

        // Initialize text data object with basic properties
        var textData = {
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
            textData.applyStroke = true;
            textData.strokeColor = sourceTextProp.strokeColor;
            textData.strokeWidth = sourceTextProp.strokeWidth;
            textData.strokeOverFill = sourceTextProp.strokeOverFill;
        } else {
            textData.applyStroke = false;
            textData.strokeColor = null;
            textData.strokeWidth = null;
            textData.strokeOverFill = null;
        }

        // Add box text properties only if it's box text
        try {
            if (sourceTextProp.boxText) {
                textData.boxText = true;
                textData.boxTextSize = sourceTextProp.boxTextSize;
            } else {
                textData.boxText = false;
                textData.boxTextSize = null;
            }
        } catch (e) {
            // If boxText property is not available
            textData.boxText = false;
            textData.boxTextSize = null;
        }

        return textData;
    } catch (textError) {
        // If text processing fails, still mark as text layer but without content
        return {
            error: "Failed to process text properties: " + textError.toString(),
        };
    }
}

// Process shape layer contents
function processShapeLayer(layer) {
    try {
        var shapeContents = layer.property("Contents");
        if (shapeContents) {
            var shapeData = {
                contents: [],
            };

            // Process shape groups
            for (var shapeIndex = 1; shapeIndex <= shapeContents.numProperties; shapeIndex++) {
                try {
                    var shapeGroup = shapeContents.property(shapeIndex);
                    if (shapeGroup) {
                        // PropertyType.INDEXED_GROUP = 2, PropertyType.PROPERTY = 1, PropertyType.NAMED_GROUP = 3
                        if (shapeGroup.propertyType === PROP_TYPE.INDEXED_GROUP || shapeGroup.propertyType === PropertyType.INDEXED_GROUP) {
                            var groupData = processShapeGroup(shapeGroup);
                            if (groupData) {
                                shapeData.contents.push(groupData);
                            }
                        } else if (shapeGroup.propertyType === PROP_TYPE.PROPERTY || shapeGroup.propertyType === PropertyType.PROPERTY) {
                            // Handle direct properties in shape contents
                            var propData = processProperty(shapeGroup);
                            if (propData) {
                                shapeData.contents.push({
                                    name: propData.name,
                                    type: "property",
                                    property: propData,
                                });
                            }
                        } else if (shapeGroup.propertyType === PROP_TYPE.NAMED_GROUP || shapeGroup.propertyType === PropertyType.NAMED_GROUP) {
                            // Handle named groups
                            var groupData = processShapeGroup(shapeGroup);
                            if (groupData) {
                                shapeData.contents.push(groupData);
                            }
                        } else {
                            // Unknown property type, add to debug
                            shapeData.contents.push({
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
            if (shapeData.contents.length === 0) {
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

                    shapeData.debug = {
                        numProperties: shapeContents.numProperties,
                        propertyTypes: shapeProperties,
                        alternative: "Tried alternative property access",
                    };
                } catch (debugError) {
                    shapeData.debug = {
                        error: "Failed to collect debug info: " + debugError.toString(),
                    };
                }
            }

            return shapeData;
        } else {
            return {
                contents: [],
                error: "No Contents property found on shape layer",
            };
        }
    } catch (shapeError) {
        // If shape processing fails, still mark as shape layer but without content
        return {
            contents: [],
            error: "Failed to process shape contents: " + shapeError.toString(),
        };
    }
}

// Process track matte information for a layer
function processTrackMatte(layer, compId) {
    try {
        var trackMatteType = layer.trackMatteType;
        var trackMatteLayer = layer.trackMatteLayer;

        // TrackMatteType: 0=NONE, 1=ALPHA, 2=ALPHA_INVERTED, 3=LUMA, 4=LUMA_INVERTED
        if (trackMatteType === 0 || trackMatteType === TrackMatteType.NO_TRACK_MATTE || trackMatteType === TrackMatteType.NONE) {
            return null;
        }

        // Get the matte layer ID
        var matteLayerId = null;
        if (trackMatteLayer) {
            matteLayerId = compId + "_" + (trackMatteLayer.index - 1);
        } else if (layer.index > 1) {
            // Fallback: use the layer above
            matteLayerId = compId + "_" + (layer.index - 2);
        }

        // Map track matte mode to string
        var modeString = "";
        var inverted = false;

        switch (trackMatteType) {
            case 1:
            case TrackMatteType.ALPHA:
                modeString = "alpha";
                break;
            case 2:
            case TrackMatteType.ALPHA_INVERTED:
                modeString = "alpha";
                inverted = true;
                break;
            case 3:
            case TrackMatteType.LUMA:
                modeString = "luma";
                break;
            case 4:
            case TrackMatteType.LUMA_INVERTED:
                modeString = "luma";
                inverted = true;
                break;
            default:
                modeString = "unknown";
                break;
        }

        return {
            mode: modeString,
            inverted: inverted,
            matteLayerId: matteLayerId,
            trackMatteType: trackMatteType,
            matteLayerName: trackMatteLayer ? trackMatteLayer.name : null,
        };
    } catch (trackMatteError) {
        logToFile("Error processing track matte: " + trackMatteError.toString(), 1);
        return {
            error: "Failed to process track matte: " + trackMatteError.toString(),
        };
    }
}

// Helper function to process folder items
function processFolderItem(item, parentId) {
    var folderData = {
        id: item.id,
        name: item.name,
        type: "folder",
        parentId: parentId,
    };

    // Add folder to assets
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
