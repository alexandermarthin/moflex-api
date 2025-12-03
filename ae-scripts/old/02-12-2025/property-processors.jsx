// After Effects Project Export Script - Property Processors Module
// Handles transform properties, text animators, and other layer properties

// Process a property group recursively
function processPropertyGroup(propertyGroup, output, is3D) {
    try {
        // Debug output for property group processing
        logToFile("Processing property group: " + propertyGroup.name);

        // Always include transform properties if this is the transform group
        if (propertyGroup.name === "Transform") {
            logToFile("Processing Transform properties for layer");
            processTransformProperties(propertyGroup, output, is3D);
        }

        // Process other properties as before
        for (var propIndex = 1; propIndex <= propertyGroup.numProperties; propIndex++) {
            var property = propertyGroup.property(propIndex);

            if (property.propertyType === PropertyType.PROPERTY) {
                // Skip transform properties as they're handled above
                if (propertyGroup.name === "Transform") {
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

        // Handle text animators
        if (propertyGroup.name === "Text") {
            processTextAnimators(propertyGroup, output);
        }

        // Debug output for successful property group processing
        logToFile("Completed processing property group: " + propertyGroup.name);
    } catch (e) {
        // If an error occurs during property group processing, log it
        logToFile("Error processing property group: " + propertyGroup.name + " - " + e.toString());
        // Optionally, you might want to re-throw or handle the error more gracefully
    }
}

// Process transform properties specifically
function processTransformProperties(propertyGroup, output, is3D) {
    // Check if position is separated
    var positionSeparated = false;
    try {
        var positionProp = propertyGroup.property(2); // Position is at index 2
        if (positionProp && positionProp.dimensionsSeparated) {
            positionSeparated = true;
            logToFile("Position properties are separated");
        }
    } catch (e) {
        logToFile("Could not determine position separation: " + e.toString());
    }

    // Transform property indexes: 1=Anchor Point, 2=Position, 3-5=X/Y/Z Position, 6=Scale, 7=Orientation, 8-10=X/Y/Z Rotation, 11=Opacity
    var transformIndexes = {
        1: "Anchor Point",
        2: "Position",
        3: "X Position",
        4: "Y Position",
        5: "Z Position",
        6: "Scale",
        7: "Orientation",
        8: "X Rotation",
        9: "Y Rotation",
        10: "Z Rotation",
        11: "Opacity",
    };

    for (var index = 1; index <= 11; index++) {
        try {
            var prop = propertyGroup.property(index);
            if (!prop) {
                logToFile("No property found at index " + index);
                continue;
            }

            var propName = transformIndexes[index];
            logToFile("Processing transform property at index " + index + ": " + propName + " (actual name: " + prop.name + ")");

            // Handle multi-dimensional properties by index
            if (index === 1) {
                // Anchor Point
                processAnchorPoint(prop, output);
            } else if (index === 2) {
                // Position
                if (!positionSeparated) {
                    processUnifiedPosition(prop, output);
                }
            } else if (index >= 3 && index <= 5) {
                // X, Y, Z Position (when separated)
                if (positionSeparated) {
                    processSeparatedPosition(prop, index, output);
                }
            } else if (index === 6) {
                // Scale
                processScale(prop, output);
            } else if (index === 7) {
                // Orientation
                processOrientation(prop, output);
            } else if (index >= 8 && index <= 11) {
                // X, Y, Z Rotation and Opacity
                var propData = processProperty(prop);
                if (propData) {
                    if (index === 10) {
                        // Z Rotation gets special naming
                        logToFile("Processing Z Rotation at index 10: " + propData.name + ", value: " + propData.value);
                        output["Z Rotation"] = propData;
                        logToFile("Z Rotation added to output with key 'Z Rotation'");
                    } else {
                        output[propData.name] = propData;
                    }
                }
            }
        } catch (e) {
            logToFile("Error processing transform property at index " + index + " (" + propName + "): " + e.toString());
            continue;
        }
    }
}

// Process anchor point property
function processAnchorPoint(prop, output) {
    var anchorValue = prop.value;
    if (anchorValue && anchorValue.length > 0) {
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
}

// Process unified position property
function processUnifiedPosition(prop, output) {
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
        propertyIndex: 2,
        value: posValue[0],
        keyframes: xKeyframes,
    };

    output["Y Position"] = {
        name: "Y Position",
        propertyIndex: 2,
        value: posValue[1],
        keyframes: yKeyframes,
    };

    output["Z Position"] = {
        name: "Z Position",
        propertyIndex: 2,
        value: posValue[2],
        keyframes: zKeyframes,
    };
}

// Process separated position properties
function processSeparatedPosition(prop, index, output) {
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

// Process scale property
function processScale(prop, output) {
    var scaleValue = prop.value;
    if (scaleValue && scaleValue.length > 0) {
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
    }
}

// Process orientation property
function processOrientation(prop, output) {
    var orientValue = prop.value;
    if (orientValue && orientValue.length > 0) {
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
}

// Process text animators
function processTextAnimators(propertyGroup, output) {
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

// Process a single text animator
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
            var rangeData = processRangeSelector(prop);
            if (rangeData) {
                animatorData.properties.push(rangeData);
            }
        }
    }

    return animatorData;
}

// Process range selector for text animators
function processRangeSelector(rangeProp) {
    try {
        var rangeData = {
            name: "Range Selector",
            start: rangeProp.property("Start").value,
            end: rangeProp.property("End").value,
            offset: rangeProp.property("Offset").value,
            mode: rangeProp.property("Mode").value,
            amount: rangeProp.property("Amount").value,
            shape: rangeProp.property("Shape").value,
            smoothness: rangeProp.property("Smoothness").value,
            easingProperties: [],
        };

        // Add keyframe data for animated range selector properties
        ["Start", "End", "Offset", "Amount"].forEach(function (propName) {
            var prop = rangeProp.property(propName);
            if (prop && prop.numKeys > 0) {
                var keyframes = [];
                for (var k = 1; k <= prop.numKeys; k++) {
                    var kf = createKeyframeData(prop, k, 0);
                    if (kf) keyframes.push(kf);
                }
                rangeData.easingProperties.push({
                    name: propName,
                    keyframes: keyframes,
                });
            }
        });

        return rangeData;
    } catch (error) {
        logToFile("Error processing range selector: " + error.toString());
        return null;
    }
}

// Process Essential Graphics (Motion Graphics Template) data from a composition
function processEssentialGraphics(comp) {
    try {
        logToFile("Starting Essential Graphics processing for comp: " + comp.name);
        
        // Check if this composition has Essential Graphics data
        if (!comp.motionGraphicsTemplateName || comp.motionGraphicsTemplateName === "") {
            logToFile("No Essential Graphics template name found for comp: " + comp.name);
            return null;
        }
        
        var egData = {
            templateName: comp.motionGraphicsTemplateName,
            compId: comp.id,
            compName: comp.name,
            properties: []
        };
        
        // Get the number of exposed properties
        var controllerCount = 0;
        try {
            if (typeof comp.motionGraphicsTemplateControllerCount !== "undefined") {
                controllerCount = comp.motionGraphicsTemplateControllerCount;
                logToFile("Essential Graphics controller count: " + controllerCount);
            } else {
                logToFile("motionGraphicsTemplateControllerCount property not available");
                egData.error = "Essential Graphics API not fully available in this After Effects version";
                return egData;
            }
        } catch (e) {
            logToFile("Could not get controller count: " + e.toString());
            egData.error = "Could not access Essential Graphics controller count: " + e.toString();
            return egData;
        }
        
        if (controllerCount === 0) {
            logToFile("No Essential Graphics controllers found for template: " + comp.motionGraphicsTemplateName);
            egData.error = "Template exists but no exposed properties found";
            return egData;
        }
        
        // Build a map of all properties that are in Essential Graphics
        // by checking each layer and their properties
        var egPropertiesMap = buildEssentialGraphicsMap(comp, controllerCount);
        logToFile("Built Essential Graphics map with " + egPropertiesMap.length + " properties");
        
        // Check if the documented API method exists
        var hasGetName = typeof comp.getMotionGraphicsTemplateControllerName === "function";
        logToFile("getMotionGraphicsTemplateControllerName method available: " + hasGetName);
        
        // Process each exposed property using the documented API
        // Note: After Effects uses 1-based indexing for controller indices
        for (var i = 1; i <= controllerCount; i++) {
            try {
                var controllerName = null;
                
                // Get the controller display name
                if (hasGetName) {
                    try {
                        controllerName = comp.getMotionGraphicsTemplateControllerName(i);
                        logToFile("Controller " + i + " name: " + controllerName);
                    } catch (nameError) {
                        logToFile("Error getting controller name at index " + i + ": " + nameError.toString());
                    }
                }
                
                if (!controllerName) {
                    logToFile("Could not get name for controller at index " + i);
                    egData.properties.push({
                        propertyIndex: i,
                        error: "Could not retrieve property name"
                    });
                    continue;
                }
                
                // Find the property in our map by controller index or name
                var foundPropertyInfo = null;
                
                // First try index matching (most reliable if map was built correctly)
                for (var m = 0; m < egPropertiesMap.length; m++) {
                    if (egPropertiesMap[m].controllerIndex === i) {
                        foundPropertyInfo = egPropertiesMap[m];
                        break;
                    }
                }
                
                // If not found by index, try searching by name in the map (if map has name info)
                if (!foundPropertyInfo) {
                    for (var m = 0; m < egPropertiesMap.length; m++) {
                        if (egPropertiesMap[m].controllerName === controllerName || 
                            egPropertiesMap[m].layerName === controllerName) {
                            foundPropertyInfo = egPropertiesMap[m];
                            break;
                        }
                    }
                }
                
                if (!foundPropertyInfo) {
                    logToFile("Could not find property for controller index " + i + " (name: " + controllerName + ")");
                    
                    // Final Hail Mary: Check if we can find a layer with this name directly
                    // This handles cases where the map building failed completely
                    var directLayer = findPropertyByName(comp, controllerName);
                    if (directLayer) {
                        logToFile("  Found layer by direct name match fallback: " + controllerName);
                        foundPropertyInfo = {
                            property: directLayer,
                            layerName: directLayer.name,
                            propertyName: directLayer.name
                        };
                    } else {
                        // Super Final Hail Mary: Map Controller Index to Layer Index
                        // This assumes that if I have Controller 1, it might map to Layer 1
                        if (i <= comp.numLayers) {
                             var fallbackLayer = comp.layer(i);
                             logToFile("  Using strict layer index fallback: Controller " + i + " -> Layer " + i + " (" + fallbackLayer.name + ")");
                             foundPropertyInfo = {
                                 property: fallbackLayer,
                                 layerName: fallbackLayer.name,
                                 propertyName: fallbackLayer.name
                             };
                        } else {
                            egData.properties.push({
                                name: controllerName,
                                propertyIndex: i,
                                error: "Property not found in composition"
                            });
                            continue;
                        }
                    }
                }
                
                logToFile("Found property for controller " + i + " - layer: " + foundPropertyInfo.layerName + ", property: " + foundPropertyInfo.propertyName);
                
                // Process the property data
                var propData = processEssentialGraphicsPropertyDirect(foundPropertyInfo.property, controllerName, i);
                if (propData) {
                    egData.properties.push(propData);
                }
                
            } catch (propError) {
                logToFile("Error processing Essential Graphics property at index " + i + ": " + propError.toString());
                egData.properties.push({
                    propertyIndex: i,
                    error: "Failed to process property: " + propError.toString()
                });
            }
        }
        
        logToFile("Completed Essential Graphics processing. Found " + egData.properties.length + " properties");
        return egData;
        
    } catch (error) {
        logToFile("Error processing Essential Graphics: " + error.toString());
        return {
            error: "Failed to process Essential Graphics: " + error.toString()
        };
    }
}

// Build a map of all properties that are in Essential Graphics
// Returns an array of objects with: {controllerIndex, property, layerName, propertyName}
function buildEssentialGraphicsMap(comp, controllerCount) {
    var egMap = [];
    
    try {
        logToFile("Building Essential Graphics map for comp: " + comp.name);
        
        // Check if the method to get controller for property exists
        var hasGetController = typeof comp.getMotionGraphicsControllerForProperty === "function";
        logToFile("getMotionGraphicsControllerForProperty method available: " + hasGetController);
        
        if (!hasGetController) {
            logToFile("Essential Graphics property mapping API not available - will use fallback strategies in main loop");
            return egMap;
        }
        
        // Iterate through all layers in the composition
        for (var layerIndex = 1; layerIndex <= comp.numLayers; layerIndex++) {
            var layer = comp.layer(layerIndex);
            logToFile("Checking layer " + layerIndex + ": " + layer.name);
            
            // Check the layer itself (entire layer can be added to EG)
            try {
                var layerController = comp.getMotionGraphicsControllerForProperty(layer);
                if (layerController > 0) {
                    logToFile("  Layer '" + layer.name + "' is in EG at controller index: " + layerController);
                    egMap.push({
                        controllerIndex: layerController,
                        property: layer,
                        layerName: layer.name,
                        propertyName: layer.name
                    });
                }
            } catch (e) {
                // Layer not in Essential Graphics, continue
            }
            
            // Check all properties in the layer recursively
            checkPropertyGroupForEG(comp, layer, layer.name, egMap);
        }
        
        logToFile("Found " + egMap.length + " properties in Essential Graphics");
        
    } catch (error) {
        logToFile("Error building Essential Graphics map: " + error.toString());
    }
    
    return egMap;
}

// Recursively check properties in a group for Essential Graphics membership
function checkPropertyGroupForEG(comp, propGroup, layerName, egMap) {
    try {
        if (!propGroup.numProperties) {
            return;
        }
        
        for (var i = 1; i <= propGroup.numProperties; i++) {
            try {
                var prop = propGroup.property(i);
                
                // Check if this property is in Essential Graphics
                try {
                    var controllerIndex = comp.getMotionGraphicsControllerForProperty(prop);
                    if (controllerIndex > 0) {
                        logToFile("  Property '" + prop.name + "' in layer '" + layerName + "' is in EG at controller index: " + controllerIndex);
                        egMap.push({
                            controllerIndex: controllerIndex,
                            property: prop,
                            layerName: layerName,
                            propertyName: prop.name
                        });
                    }
                } catch (e) {
                    // Property not in Essential Graphics
                }
                
                // If it's a group, check recursively
                if (prop.propertyType === PropertyType.INDEXED_GROUP || 
                    prop.propertyType === PropertyType.NAMED_GROUP) {
                    checkPropertyGroupForEG(comp, prop, layerName, egMap);
                }
                
            } catch (propError) {
                // Skip properties that can't be accessed
                continue;
            }
        }
    } catch (error) {
        logToFile("Error checking property group for EG: " + error.toString());
    }
}

// Helper function to find a property by name in a composition
function findPropertyByName(comp, propertyName) {
    try {
        logToFile("Searching for property: " + propertyName);
        
        // Search through all layers
        for (var layerIndex = 1; layerIndex <= comp.numLayers; layerIndex++) {
            var layer = comp.layer(layerIndex);
            var foundProp = searchPropertyInGroup(layer, propertyName);
            if (foundProp) {
                logToFile("Found property '" + propertyName + "' in layer: " + layer.name);
                return foundProp;
            }
        }
        
        logToFile("Property '" + propertyName + "' not found in any layer");
        return null;
        
    } catch (error) {
        logToFile("Error in findPropertyByName: " + error.toString());
        return null;
    }
}

// Recursively search for a property by name in a property group
function searchPropertyInGroup(propGroup, targetName) {
    try {
        // Check if this property group itself matches
        if (propGroup.name === targetName) {
            return propGroup;
        }
        
        // Search through all properties in this group
        if (propGroup.numProperties) {
            for (var i = 1; i <= propGroup.numProperties; i++) {
                try {
                    var prop = propGroup.property(i);
                    
                    // Check if this property matches
                    if (prop.name === targetName) {
                        return prop;
                    }
                    
                    // If it's a group, search recursively
                    if (prop.propertyType === PropertyType.INDEXED_GROUP || 
                        prop.propertyType === PropertyType.NAMED_GROUP) {
                        var foundProp = searchPropertyInGroup(prop, targetName);
                        if (foundProp) {
                            return foundProp;
                        }
                    }
                } catch (propError) {
                    // Skip properties that can't be accessed
                    continue;
                }
            }
        }
        
        return null;
        
    } catch (error) {
        return null;
    }
}

// Process Essential Graphics property directly from the property object
function processEssentialGraphicsPropertyDirect(property, propertyName, index) {
    try {
        var propData = {
            name: propertyName,
            propertyIndex: index,
            matchName: property.matchName
        };
        
        // Check if this is a layer itself (not a property within a layer)
        var isLayer = (property.matchName === "ADBE Text Layer" || 
                       property.matchName === "ADBE AV Layer" || 
                       property.matchName === "ADBE Camera Layer" ||
                       property.matchName === "ADBE Light Layer" ||
                       property.matchName === "ADBE Vector Layer");
        
        // Get the layer this property belongs to
        var layer = null;
        
        if (isLayer) {
            // If the property is the layer itself
            layer = property;
        } else {
            // If it's a property, get the parent layer
            try {
                layer = property.propertyGroup(property.propertyDepth);
            } catch (e) {
                // Couldn't get layer
                logToFile("Error getting parent layer: " + e.toString());
            }
        }
        
        // Set layer info and clipId
        if (layer && layer.name) {
            propData.layerName = layer.name;
            
            // Generate clipId consistent with layer-processors.jsx
            // ID Format: compID + "_" + (layerIndex - 1)
            if (layer.containingComp) {
                propData.clipId = layer.containingComp.id + "_" + (layer.index - 1);
                logToFile("Property belongs to layer: " + layer.name + " (clipId: " + propData.clipId + ")");
            }
        }
        
        // Determine property type first, as it affects how we get the value
        if (isLayer) {
            // This is an entire layer exposed in Essential Graphics
            logToFile("Property is a layer type: " + property.matchName);
            
            if (property.matchName === "ADBE Text Layer") {
                propData.propertyType = "text_layer";
                // Get the text content
                try {
                    var textProp = property.property("ADBE Text Properties").property("ADBE Text Document");
                    if (textProp) {
                        propData.value = textProp.value.text;
                        logToFile("Text layer value: " + propData.value);
                    }
                } catch (e) {
                    logToFile("Could not get text value: " + e.toString());
                    propData.value = null;
                }
            } else if (property.matchName === "ADBE AV Layer") {
                propData.propertyType = "av_layer";
                // Get the source information
                try {
                    if (property.source) {
                        propData.value = {
                            sourceName: property.source.name,
                            sourceId: property.source.id
                        };
                        logToFile("AV layer source: " + property.source.name);
                    } else {
                        propData.value = null;
                    }
                } catch (e) {
                    logToFile("Could not get AV layer source: " + e.toString());
                    propData.value = null;
                }
            } else {
                propData.propertyType = "layer";
                propData.value = null;
            }
        } else {
            // This is a regular property
            // Get current value
            try {
                propData.value = getPropertyValue(property);
                logToFile("Property value: " + propData.value);
            } catch (e) {
                logToFile("Could not get value for property: " + propertyName + " - " + e.toString());
                propData.value = null;
            }
            
            // Determine property type
            try {
                propData.propertyType = determinePropertyType(property);
            } catch (e) {
                logToFile("Could not determine property type: " + e.toString());
                propData.propertyType = "unknown";
            }
        }
        
        // Get min/max values and keyframes only for regular properties, not layers
        if (!isLayer) {
            // Get min/max values if they exist
            if (property.propertyValueType === PropertyValueType.OneD || 
                property.propertyValueType === PropertyValueType.TwoD || 
                property.propertyValueType === PropertyValueType.ThreeD) {
                
                try {
                    if (typeof property.minValue !== "undefined") {
                        propData.min = property.minValue;
                    }
                    if (typeof property.maxValue !== "undefined") {
                        propData.max = property.maxValue;
                    }
                } catch (e) {
                    // Min/max not available
                }
            }
            
            // Get keyframes if the property is animated
            if (property.isTimeVarying && property.numKeys > 0) {
                propData.keyframes = [];
                
                for (var k = 1; k <= property.numKeys; k++) {
                    try {
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
                                    influence: inEase.influence
                                },
                                outEase: {
                                    speed: outEase.speed,
                                    influence: outEase.influence
                                },
                                continuous: property.keyTemporalContinuous(k),
                                autoBezier: property.keyTemporalAutoBezier(k)
                            }
                        };
                        propData.keyframes.push(keyframe);
                    } catch (keyError) {
                        logToFile("Error processing keyframe " + k + " for property " + propertyName + ": " + keyError.toString());
                    }
                }
            } else {
                propData.keyframes = [];
            }
        } else {
            // Layers don't have keyframes at the layer level
            propData.keyframes = [];
        }
        
        return propData;
        
    } catch (error) {
        logToFile("Error in processEssentialGraphicsPropertyDirect: " + error.toString());
        return {
            name: propertyName,
            propertyIndex: index,
            error: error.toString()
        };
    }
}

// Process a single Essential Graphics property (legacy method - kept for compatibility)
function processEssentialGraphicsProperty(controller, index) {
    try {
        var propData = {
            name: controller.name,
            propertyIndex: index
        };
        
        // Get the actual property reference
        var property = controller.property;
        if (!property) {
            logToFile("No property reference found for controller: " + controller.name);
            return propData;
        }
        
        // Get current value
        try {
            propData.value = getPropertyValue(property);
        } catch (e) {
            logToFile("Could not get value for property: " + controller.name + " - " + e.toString());
            propData.value = null;
        }
        
        // Determine property type based on matchName and property characteristics
        try {
            propData.matchName = property.matchName;
            propData.propertyType = determinePropertyType(property);
        } catch (e) {
            logToFile("Could not determine property type: " + e.toString());
            propData.propertyType = "unknown";
        }
        
        // Get comment/description if available
        try {
            if (controller.comment) {
                propData.comment = controller.comment;
            }
        } catch (e) {
            // Comment not available, that's okay
        }
        
        // Get parent group/hierarchy
        try {
            var parentGroup = property.parentProperty;
            if (parentGroup && parentGroup.name !== comp.name) {
                propData.groupName = parentGroup.name;
            }
        } catch (e) {
            logToFile("Could not get parent group: " + e.toString());
        }
        
        // Handle constraints (min/max values)
        if (property.propertyValueType === PropertyValueType.OneD || 
            property.propertyValueType === PropertyValueType.TwoD || 
            property.propertyValueType === PropertyValueType.ThreeD) {
            
            try {
                // Try to get min/max values if they exist
                if (typeof property.minValue !== "undefined") {
                    propData.min = property.minValue;
                }
                if (typeof property.maxValue !== "undefined") {
                    propData.max = property.maxValue;
                }
            } catch (e) {
                // Min/max not available for this property
            }
        }
        
        // Handle dropdown menus
        try {
            // Check if this is a dropdown by looking at the property type
            if (property.propertyValueType === PropertyValueType.CUSTOM_VALUE) {
                // Try to access dropdown options
                // Note: AE doesn't provide direct access to dropdown options via scripting
                // We can only get the current selected index/value
                propData.isDropdown = true;
            }
        } catch (e) {
            // Not a dropdown or can't determine
        }
        
        // Get keyframes if the property is animated
        if (property.isTimeVarying && property.numKeys > 0) {
            propData.keyframes = [];
            
            for (var k = 1; k <= property.numKeys; k++) {
                try {
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
                                influence: inEase.influence
                            },
                            outEase: {
                                speed: outEase.speed,
                                influence: outEase.influence
                            },
                            continuous: property.keyTemporalContinuous(k),
                            autoBezier: property.keyTemporalAutoBezier(k)
                        }
                    };
                    propData.keyframes.push(keyframe);
                } catch (keyError) {
                    logToFile("Error processing keyframe " + k + " for property " + controller.name + ": " + keyError.toString());
                }
            }
        } else {
            propData.keyframes = [];
        }
        
        return propData;
        
    } catch (error) {
        logToFile("Error in processEssentialGraphicsProperty: " + error.toString());
        return {
            name: controller.name || "Unknown",
            propertyIndex: index,
            error: error.toString()
        };
    }
}

// Helper function to determine property type for Essential Graphics
function determinePropertyType(property) {
    try {
        var valueType = property.propertyValueType;
        
        // Check property value type
        if (valueType === PropertyValueType.OneD) {
            // Could be slider, angle, or checkbox
            if (property.value === 0 || property.value === 1) {
                // Might be a checkbox, but could also be a slider at 0 or 1
                return "slider";
            }
            return "slider";
        } else if (valueType === PropertyValueType.TwoD) {
            return "2d_point";
        } else if (valueType === PropertyValueType.ThreeD) {
            return "3d_point";
        } else if (valueType === PropertyValueType.COLOR) {
            return "color";
        } else if (valueType === PropertyValueType.CUSTOM_VALUE) {
            return "dropdown";
        } else if (valueType === PropertyValueType.TEXT_DOCUMENT) {
            return "text";
        } else if (valueType === PropertyValueType.LAYER_INDEX) {
            return "layer";
        } else if (valueType === PropertyValueType.MASK_INDEX) {
            return "mask";
        } else if (valueType === PropertyValueType.SHAPE) {
            return "shape";
        } else if (valueType === PropertyValueType.MARKER) {
            return "marker";
        }
        
        return "unknown";
    } catch (e) {
        return "unknown";
    }
}
