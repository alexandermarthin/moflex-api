// After Effects Project Export Script - Mask Processors Module
// Handles mask processing including paths, feathering, opacity, and expansion

// Process masks for a layer
function processMasks(layer) {
    try {
        var masksFound = false;
        var masks = [];

        // First try direct mask access
        if (layer.mask && layer.mask.numMasks > 0) {
            logToFile("Found " + layer.mask.numMasks + " masks via direct access on layer: " + layer.name);
            masksFound = true;

            for (var maskIndex = 1; maskIndex <= layer.mask.numMasks; maskIndex++) {
                try {
                    var mask = layer.mask(maskIndex);
                    logToFile("Processing mask " + maskIndex + ": " + mask.name);

                    var maskData = processSingleMask(mask, maskIndex);
                    if (maskData) {
                        masks.push(maskData);
                        logToFile("Successfully processed mask " + maskIndex + ": " + mask.name);
                    }
                } catch (maskError) {
                    logToFile("Error processing mask " + maskIndex + ": " + maskError.toString());
                    // Add error placeholder for failed mask
                    masks.push({
                        name: "Mask " + maskIndex,
                        index: maskIndex,
                        error: "Failed to process mask: " + maskError.toString(),
                    });
                }
            }
            logToFile("Processed " + masks.length + " masks for layer: " + layer.name);
        }

        // If no masks found via direct access, try property group access
        if (!masksFound) {
            try {
                var masksGroup = layer.property("Masks");
                if (masksGroup && masksGroup.numProperties > 0) {
                    logToFile("Found " + masksGroup.numProperties + " masks via property group on layer: " + layer.name);
                    masksFound = true;

                    for (var maskIndex = 1; maskIndex <= masksGroup.numProperties; maskIndex++) {
                        try {
                            var maskGroup = masksGroup.property(maskIndex);
                            if (maskGroup && maskGroup.name && maskGroup.name.indexOf("Mask") !== -1) {
                                logToFile("Processing mask group " + maskIndex + ": " + maskGroup.name);

                                var maskData = processMaskGroup(maskGroup, maskIndex);
                                if (maskData) {
                                    masks.push(maskData);
                                    logToFile("Successfully processed mask group " + maskIndex + ": " + maskGroup.name);
                                }
                            }
                        } catch (maskGroupError) {
                            logToFile("Error processing mask group " + maskIndex + ": " + maskGroupError.toString());
                        }
                    }

                    if (masks.length > 0) {
                        logToFile("Processed " + masks.length + " masks via property groups for layer: " + layer.name);
                    }
                }
            } catch (masksGroupError) {
                logToFile("Error accessing Masks property group: " + masksGroupError.toString());
            }
        }

        if (!masksFound) {
            logToFile("No masks found on layer: " + layer.name);
        }

        return masks;
    } catch (maskGroupError) {
        logToFile("Error processing mask group for layer " + layer.name + ": " + maskGroupError.toString());
        return [];
    }
}

// Process a single mask via direct access
function processSingleMask(mask, maskIndex) {
    var maskData = {
        name: mask.name,
        index: maskIndex,
        inverted: mask.inverted,
        maskPath: null,
        maskFeather: null,
        maskOpacity: null,
        maskExpansion: null,
        keyframes: {},
    };

    // Process mask path
    try {
        var maskPath = mask.property("Mask Path");
        if (maskPath) {
            maskData.maskPath = {
                closed: maskPath.closed,
                vertices: maskPath.vertices,
                inTangents: maskPath.inTangents,
                outTangents: maskPath.outTangents,
            };

            // Process keyframes for mask path
            if (maskPath.numKeys > 0) {
                maskData.keyframes.maskPath = [];
                for (var k = 1; k <= maskPath.numKeys; k++) {
                    try {
                        var keyframe = {
                            time: maskPath.keyTime(k),
                            value: {
                                closed: maskPath.keyValue(k).closed,
                                vertices: maskPath.keyValue(k).vertices,
                                inTangents: maskPath.keyValue(k).inTangents,
                                outTangents: maskPath.keyValue(k).outTangents,
                            },
                        };
                        maskData.keyframes.maskPath.push(keyframe);
                    } catch (kfError) {
                        logToFile("Error processing mask path keyframe: " + kfError.toString());
                    }
                }
            }
        }
    } catch (pathError) {
        logToFile("Error processing mask path: " + pathError.toString());
    }

    // Process other mask properties
    try {
        var maskFeather = mask.property("Mask Feather");
        if (maskFeather) {
            maskData.maskFeather = maskFeather.value;
            if (maskFeather.numKeys > 0) {
                maskData.keyframes.maskFeather = [];
                for (var k = 1; k <= maskFeather.numKeys; k++) {
                    try {
                        var keyframe = {
                            time: maskFeather.keyTime(k),
                            value: maskFeather.keyValue(k),
                        };
                        maskData.keyframes.maskFeather.push(keyframe);
                    } catch (kfError) {
                        logToFile("Error processing mask feather keyframe: " + kfError.toString());
                    }
                }
            }
        }
    } catch (featherError) {
        logToFile("Error processing mask feather: " + featherError.toString());
    }

    try {
        var maskOpacity = mask.property("Mask Opacity");
        if (maskOpacity) {
            maskData.maskOpacity = maskOpacity.value;
            if (maskOpacity.numKeys > 0) {
                maskData.keyframes.maskOpacity = [];
                for (var k = 1; k <= maskOpacity.numKeys; k++) {
                    try {
                        var keyframe = {
                            time: maskOpacity.keyTime(k),
                            value: maskOpacity.keyValue(k),
                        };
                        maskData.keyframes.maskOpacity.push(keyframe);
                    } catch (kfError) {
                        logToFile("Error processing mask opacity keyframe: " + kfError.toString());
                    }
                }
            }
        }
    } catch (opacityError) {
        logToFile("Error processing mask opacity: " + opacityError.toString());
    }

    try {
        var maskExpansion = mask.property("Mask Expansion");
        if (maskExpansion) {
            maskData.maskExpansion = maskExpansion.value;
            if (maskExpansion.numKeys > 0) {
                maskData.keyframes.maskExpansion = [];
                for (var k = 1; k <= maskExpansion.numKeys; k++) {
                    try {
                        var keyframe = {
                            time: maskExpansion.keyTime(k),
                            value: maskExpansion.keyValue(k),
                        };
                        maskData.keyframes.maskExpansion.push(keyframe);
                    } catch (kfError) {
                        logToFile("Error processing mask expansion keyframe: " + kfError.toString());
                    }
                }
            }
        }
    } catch (expansionError) {
        logToFile("Error processing mask expansion: " + expansionError.toString());
    }

    return maskData;
}

// Process a mask via property group access
function processMaskGroup(maskGroup, maskIndex) {
    var maskData = {
        name: maskGroup.name,
        index: maskIndex,
        inverted: false, // Will be set if available
        maskPath: null,
        maskFeather: null,
        maskOpacity: null,
        maskExpansion: null,
        keyframes: {},
    };

    // Debug: Log all available mask properties
    logToFile("Mask group '" + maskGroup.name + "' has " + maskGroup.numProperties + " properties");
    for (var debugIndex = 1; debugIndex <= maskGroup.numProperties; debugIndex++) {
        try {
            var debugProp = maskGroup.property(debugIndex);
            if (debugProp) {
                logToFile("  Property " + debugIndex + ": '" + debugProp.name + "' (type: " + debugProp.propertyType + ", matchName: '" + debugProp.matchName + "')");
                // Check for both PropertyType.PROPERTY (1) and mask-specific types (6212)
                if (debugProp.propertyType === 1 || debugProp.propertyType === 6212) {
                    try {
                        var propValue = debugProp.value;
                        if (propValue && typeof propValue === "object" && propValue.vertices) {
                            logToFile("    Has vertices: " + propValue.vertices.length + " points");
                            logToFile("    Closed: " + propValue.closed);
                        } else {
                            logToFile("    Value: " + (typeof propValue === "object" ? JSON.stringify(propValue) : propValue));
                        }
                    } catch (valueError) {
                        logToFile("    Error getting value: " + valueError.toString());
                    }
                }
            }
        } catch (debugError) {
            logToFile("    Error accessing property " + debugIndex + ": " + debugError.toString());
        }
    }

    // Process mask properties from the group
    for (var propIndex = 1; propIndex <= maskGroup.numProperties; propIndex++) {
        try {
            var maskProp = maskGroup.property(propIndex);
            if (maskProp) {
                // Try different possible names for mask path
                if (maskProp.name === "Mask Path" || maskProp.name === "Path" || maskProp.name === "Shape" || maskProp.matchName === "ADBE Mask Shape") {
                    logToFile("Processing mask path property: '" + maskProp.name + "' (matchName: '" + maskProp.matchName + "')");
                    try {
                        var pathValue = maskProp.value;
                        logToFile("Path value type: " + typeof pathValue + ", has vertices: " + (pathValue && pathValue.vertices ? pathValue.vertices.length : "no"));

                        maskData.maskPath = {
                            closed: pathValue ? pathValue.closed : null,
                            vertices: pathValue && pathValue.vertices ? pathValue.vertices : null,
                            inTangents: pathValue && pathValue.inTangents ? pathValue.inTangents : null,
                            outTangents: pathValue && pathValue.outTangents ? pathValue.outTangents : null,
                        };

                        // Debug: Log the actual path data
                        logToFile(
                            "    Path data - closed: " +
                                maskData.maskPath.closed +
                                ", vertices: " +
                                (maskData.maskPath.vertices ? maskData.maskPath.vertices.length : "null") +
                                " points, inTangents: " +
                                (maskData.maskPath.inTangents ? maskData.maskPath.inTangents.length : "null") +
                                ", outTangents: " +
                                (maskData.maskPath.outTangents ? maskData.maskPath.outTangents.length : "null")
                        );
                    } catch (pathValueError) {
                        logToFile("Error processing mask path value: " + pathValueError.toString());
                        maskData.maskPath = {
                            closed: null,
                            vertices: null,
                            inTangents: null,
                            outTangents: null,
                        };
                    }

                    // Process keyframes for mask path
                    if (maskProp.numKeys > 0) {
                        maskData.keyframes.maskPath = [];
                        for (var k = 1; k <= maskProp.numKeys; k++) {
                            try {
                                var keyframe = {
                                    time: maskProp.keyTime(k),
                                    value: {
                                        closed: maskProp.keyValue(k).closed,
                                        vertices: maskProp.keyValue(k).vertices,
                                        inTangents: maskProp.keyValue(k).inTangents,
                                        outTangents: maskProp.keyValue(k).outTangents,
                                    },
                                };
                                maskData.keyframes.maskPath.push(keyframe);
                            } catch (kfError) {
                                logToFile("Error processing mask path keyframe: " + kfError.toString());
                            }
                        }
                    }
                } else if (maskProp.name === "Mask Feather") {
                    maskData.maskFeather = maskProp.value;
                    if (maskProp.numKeys > 0) {
                        maskData.keyframes.maskFeather = [];
                        for (var k = 1; k <= maskProp.numKeys; k++) {
                            try {
                                var keyframe = {
                                    time: maskProp.keyTime(k),
                                    value: maskProp.keyValue(k),
                                };
                                maskData.keyframes.maskFeather.push(keyframe);
                            } catch (kfError) {
                                logToFile("Error processing mask feather keyframe: " + kfError.toString());
                            }
                        }
                    }
                } else if (maskProp.name === "Mask Opacity") {
                    maskData.maskOpacity = maskProp.value;
                    if (maskProp.numKeys > 0) {
                        maskData.keyframes.maskOpacity = [];
                        for (var k = 1; k <= maskProp.numKeys; k++) {
                            try {
                                var keyframe = {
                                    time: maskProp.keyTime(k),
                                    value: maskProp.keyValue(k),
                                };
                                maskData.keyframes.maskOpacity.push(keyframe);
                            } catch (kfError) {
                                logToFile("Error processing mask opacity keyframe: " + kfError.toString());
                            }
                        }
                    }
                } else if (maskProp.name === "Mask Expansion") {
                    maskData.maskExpansion = maskProp.value;
                    if (maskProp.numKeys > 0) {
                        maskData.keyframes.maskExpansion = [];
                        for (var k = 1; k <= maskProp.numKeys; k++) {
                            try {
                                var keyframe = {
                                    time: maskProp.keyTime(k),
                                    value: maskProp.keyValue(k),
                                };
                                maskData.keyframes.maskExpansion.push(keyframe);
                            } catch (kfError) {
                                logToFile("Error processing mask expansion keyframe: " + kfError.toString());
                            }
                        }
                    }
                }
            }
        } catch (propError) {
            logToFile("Error processing mask property " + propIndex + ": " + propError.toString());
        }
    }

    return maskData;
}
