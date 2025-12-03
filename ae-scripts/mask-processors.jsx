// After Effects Project Export Script - Mask Processors Module
// Handles mask processing including paths, feathering, opacity, and expansion

// Process masks for a layer
function processMasks(layer) {
    try {
        var masks = [];

        // First try direct mask access
        if (layer.mask && layer.mask.numMasks > 0) {
            for (var maskIndex = 1; maskIndex <= layer.mask.numMasks; maskIndex++) {
                try {
                    var mask = layer.mask(maskIndex);
                    var maskData = processSingleMask(mask, maskIndex);
                    if (maskData) {
                        masks.push(maskData);
                    }
                } catch (maskError) {
                    logToFile("Error processing mask " + maskIndex + ": " + maskError.toString(), 1);
                    masks.push({
                        name: "Mask " + maskIndex,
                        index: maskIndex,
                        error: "Failed to process mask: " + maskError.toString(),
                    });
                }
            }
            return masks;
        }

        // If no masks found via direct access, try property group access
        try {
            var masksGroup = layer.property("Masks");
            if (masksGroup && masksGroup.numProperties > 0) {
                for (var maskIndex = 1; maskIndex <= masksGroup.numProperties; maskIndex++) {
                    try {
                        var maskGroup = masksGroup.property(maskIndex);
                        if (maskGroup && maskGroup.name && maskGroup.name.indexOf("Mask") !== -1) {
                            var maskData = processMaskGroup(maskGroup, maskIndex);
                            if (maskData) {
                                masks.push(maskData);
                            }
                        }
                    } catch (maskGroupError) {
                        logToFile("Error processing mask group " + maskIndex + ": " + maskGroupError.toString(), 1);
                    }
                }
            }
        } catch (masksGroupError) {
            // Masks property group not accessible - that's fine
        }

        return masks;
    } catch (error) {
        logToFile("Error processing masks: " + error.toString(), 1);
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

            if (maskPath.numKeys > 0) {
                maskData.keyframes.maskPath = extractMaskPathKeyframes(maskPath);
            }
        }
    } catch (e) {
        // Path not available
    }

    // Process mask feather
    try {
        var maskFeather = mask.property("Mask Feather");
        if (maskFeather) {
            maskData.maskFeather = maskFeather.value;
            if (maskFeather.numKeys > 0) {
                maskData.keyframes.maskFeather = extractSimpleKeyframes(maskFeather);
            }
        }
    } catch (e) {
        // Feather not available
    }

    // Process mask opacity
    try {
        var maskOpacity = mask.property("Mask Opacity");
        if (maskOpacity) {
            maskData.maskOpacity = maskOpacity.value;
            if (maskOpacity.numKeys > 0) {
                maskData.keyframes.maskOpacity = extractSimpleKeyframes(maskOpacity);
            }
        }
    } catch (e) {
        // Opacity not available
    }

    // Process mask expansion
    try {
        var maskExpansion = mask.property("Mask Expansion");
        if (maskExpansion) {
            maskData.maskExpansion = maskExpansion.value;
            if (maskExpansion.numKeys > 0) {
                maskData.keyframes.maskExpansion = extractSimpleKeyframes(maskExpansion);
            }
        }
    } catch (e) {
        // Expansion not available
    }

    return maskData;
}

// Process a mask via property group access
function processMaskGroup(maskGroup, maskIndex) {
    var maskData = {
        name: maskGroup.name,
        index: maskIndex,
        inverted: false,
        maskPath: null,
        maskFeather: null,
        maskOpacity: null,
        maskExpansion: null,
        keyframes: {},
    };

    // Process mask properties from the group
    for (var propIndex = 1; propIndex <= maskGroup.numProperties; propIndex++) {
        try {
            var maskProp = maskGroup.property(propIndex);
            if (!maskProp) continue;

            // Mask path
            if (maskProp.name === "Mask Path" || maskProp.name === "Path" || maskProp.name === "Shape" || maskProp.matchName === "ADBE Mask Shape") {
                try {
                    var pathValue = maskProp.value;
                    maskData.maskPath = {
                        closed: pathValue ? pathValue.closed : null,
                        vertices: pathValue && pathValue.vertices ? pathValue.vertices : null,
                        inTangents: pathValue && pathValue.inTangents ? pathValue.inTangents : null,
                        outTangents: pathValue && pathValue.outTangents ? pathValue.outTangents : null,
                    };

                    if (maskProp.numKeys > 0) {
                        maskData.keyframes.maskPath = extractMaskPathKeyframes(maskProp);
                    }
                } catch (e) {
                    maskData.maskPath = { closed: null, vertices: null, inTangents: null, outTangents: null };
                }
            } else if (maskProp.name === "Mask Feather") {
                maskData.maskFeather = maskProp.value;
                if (maskProp.numKeys > 0) {
                    maskData.keyframes.maskFeather = extractSimpleKeyframes(maskProp);
                }
            } else if (maskProp.name === "Mask Opacity") {
                maskData.maskOpacity = maskProp.value;
                if (maskProp.numKeys > 0) {
                    maskData.keyframes.maskOpacity = extractSimpleKeyframes(maskProp);
                }
            } else if (maskProp.name === "Mask Expansion") {
                maskData.maskExpansion = maskProp.value;
                if (maskProp.numKeys > 0) {
                    maskData.keyframes.maskExpansion = extractSimpleKeyframes(maskProp);
                }
            }
        } catch (e) {
            // Skip problematic properties
        }
    }

    return maskData;
}

// Extract keyframes for mask path properties (path-specific structure)
function extractMaskPathKeyframes(property) {
    var keyframes = [];
    if (!property || !property.numKeys) return keyframes;
    
    for (var k = 1; k <= property.numKeys; k++) {
        try {
            var kv = property.keyValue(k);
            keyframes.push({
                time: property.keyTime(k),
                value: {
                    closed: kv.closed,
                    vertices: kv.vertices,
                    inTangents: kv.inTangents,
                    outTangents: kv.outTangents,
                },
            });
        } catch (e) {
            // Skip problematic keyframes
        }
    }
    return keyframes;
}

// Extract simple keyframes - uses the generic helper from utils.jsx
function extractSimpleKeyframes(property) {
    return extractKeyframes(property, false);
}
