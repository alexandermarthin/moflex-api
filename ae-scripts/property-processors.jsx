// After Effects Project Export Script - Property Processors Module
// Handles transform properties, text animators, and other layer properties

// Maximum recursion depth to prevent stack overflow
var MAX_PROPERTY_DEPTH = 50;

// Process a property group recursively
function processPropertyGroup(propertyGroup, output, is3D, depth) {
    depth = depth || 0;
    
    // Safety: prevent infinite recursion
    if (depth > MAX_PROPERTY_DEPTH) {
        logToFile("Max recursion depth reached processing property group: " + propertyGroup.name, 1);
        return;
    }
    
    try {
        // Always include transform properties if this is the transform group
        if (propertyGroup.name === "Transform") {
            processTransformProperties(propertyGroup, output, is3D);
        }

        // Process other properties
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
                processPropertyGroup(property, output, is3D, depth + 1);
            }
        }

        // Handle text animators
        if (propertyGroup.name === "Text") {
            processTextAnimators(propertyGroup, output);
        }
    } catch (e) {
        logToFile("Error processing property group: " + propertyGroup.name + " - " + e.toString(), 1);
    }
}

// Process transform properties specifically
function processTransformProperties(propertyGroup, output, is3D) {
    // Check if position is separated
    var positionSeparated = false;
    try {
        var positionProp = propertyGroup.property(2);
        if (positionProp && positionProp.dimensionsSeparated) {
            positionSeparated = true;
        }
    } catch (e) {
        // Position separation check failed
    }

    // Transform property indexes: 1=Anchor Point, 2=Position, 3-5=X/Y/Z Position, 6=Scale, 7=Orientation, 8-10=X/Y/Z Rotation, 11=Opacity
    for (var index = 1; index <= 11; index++) {
        try {
            var prop = propertyGroup.property(index);
            if (!prop) continue;

            if (index === 1) {
                processAnchorPoint(prop, output);
            } else if (index === 2 && !positionSeparated) {
                processUnifiedPosition(prop, output);
            } else if (index >= 3 && index <= 5 && positionSeparated) {
                processSeparatedPosition(prop, index, output);
            } else if (index === 6) {
                processScale(prop, output);
            } else if (index === 7) {
                processOrientation(prop, output);
            } else if (index >= 8 && index <= 11) {
                var propData = processProperty(prop);
                if (propData) {
                    if (index === 10) {
                        output["Z Rotation"] = propData;
                    } else {
                        output[propData.name] = propData;
                    }
                }
            }
        } catch (e) {
            // Skip transform property on error
        }
    }
}

// Generic helper to process multi-dimensional properties (anchor point, scale, orientation)
function processMultiDimensional(prop, output, baseName, propertyIndex, includeZ) {
    var value = prop.value;
    if (!value || !value.length) return;
    
    var axes = ["X", "Y"];
    if (includeZ || value.length > 2) axes.push("Z");
    
    for (var i = 0; i < axes.length; i++) {
        var axisName = axes[i] + " " + baseName;
        var keyframes = [];
        
        if (prop.numKeys > 0) {
            for (var k = 1; k <= prop.numKeys; k++) {
                var kf = createKeyframeData(prop, k, i);
                if (kf) keyframes.push(kf);
            }
        }
        
        output[axisName] = {
            name: axisName,
            propertyIndex: propertyIndex,
            value: value[i] !== undefined ? value[i] : 0,
            keyframes: keyframes,
        };
    }
}

// Process anchor point property
function processAnchorPoint(prop, output) {
    processMultiDimensional(prop, output, "Anchor Point", 1, true);
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
    processMultiDimensional(prop, output, "Scale", 6, false);
}

// Process orientation property
function processOrientation(prop, output) {
    processMultiDimensional(prop, output, "Orientation", 7, true);
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
            } else {
                egData.error = "Essential Graphics API not fully available in this After Effects version";
                return egData;
            }
        } catch (e) {
            egData.error = "Could not access Essential Graphics controller count: " + e.toString();
            return egData;
        }
        
        if (controllerCount === 0) {
            egData.error = "Template exists but no exposed properties found";
            return egData;
        }
        
        // Build a map of all properties that are in Essential Graphics
        var egPropertiesMap = buildEssentialGraphicsMap(comp, controllerCount);
        
        // Check if the documented API method exists
        var hasGetName = typeof comp.getMotionGraphicsTemplateControllerName === "function";
        
        // Process each exposed property using the documented API
        for (var i = 1; i <= controllerCount; i++) {
            try {
                var controllerName = null;
                
                if (hasGetName) {
                    try {
                        controllerName = comp.getMotionGraphicsTemplateControllerName(i);
                    } catch (nameError) {
                        // Name retrieval failed
                    }
                }
                
                if (!controllerName) {
                    egData.properties.push({
                        propertyIndex: i,
                        error: "Could not retrieve property name"
                    });
                    continue;
                }
                
                // Find the property in our map by controller index or name
                var foundPropertyInfo = null;
                
                for (var m = 0; m < egPropertiesMap.length; m++) {
                    if (egPropertiesMap[m].controllerIndex === i) {
                        foundPropertyInfo = egPropertiesMap[m];
                        break;
                    }
                }
                
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
                    // Fallback: try to find layer by name directly
                    var directLayer = findPropertyByName(comp, controllerName);
                    if (directLayer) {
                        foundPropertyInfo = {
                            property: directLayer,
                            layerName: directLayer.name,
                            propertyName: directLayer.name
                        };
                    } else if (i <= comp.numLayers) {
                        // Last resort: map controller index to layer index
                        var fallbackLayer = comp.layer(i);
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
                
                var propData = processEssentialGraphicsPropertyDirect(foundPropertyInfo.property, controllerName, i);
                if (propData) {
                    egData.properties.push(propData);
                }
                
            } catch (propError) {
                logToFile("Error processing Essential Graphics property: " + propError.toString(), 1);
                egData.properties.push({
                    propertyIndex: i,
                    error: "Failed to process property: " + propError.toString()
                });
            }
        }
        
        return egData;
        
    } catch (error) {
        logToFile("Error processing Essential Graphics: " + error.toString(), 1);
        return {
            error: "Failed to process Essential Graphics: " + error.toString()
        };
    }
}

// Build a map of all properties that are in Essential Graphics
function buildEssentialGraphicsMap(comp, controllerCount) {
    var egMap = [];
    
    try {
        var hasGetController = typeof comp.getMotionGraphicsControllerForProperty === "function";
        if (!hasGetController) {
            return egMap;
        }
        
        for (var layerIndex = 1; layerIndex <= comp.numLayers; layerIndex++) {
            var layer = comp.layer(layerIndex);
            
            // Check the layer itself
            try {
                var layerController = comp.getMotionGraphicsControllerForProperty(layer);
                if (layerController > 0) {
                    egMap.push({
                        controllerIndex: layerController,
                        property: layer,
                        layerName: layer.name,
                        propertyName: layer.name
                    });
                }
            } catch (e) {
                // Layer not in Essential Graphics
            }
            
            // Check all properties in the layer recursively
            checkPropertyGroupForEG(comp, layer, layer.name, egMap);
        }
    } catch (error) {
        // Map building failed
    }
    
    return egMap;
}

// Recursively check properties in a group for Essential Graphics membership
function checkPropertyGroupForEG(comp, propGroup, layerName, egMap) {
    try {
        if (!propGroup.numProperties) return;
        
        for (var i = 1; i <= propGroup.numProperties; i++) {
            try {
                var prop = propGroup.property(i);
                
                try {
                    var controllerIndex = comp.getMotionGraphicsControllerForProperty(prop);
                    if (controllerIndex > 0) {
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
                
                if (prop.propertyType === PropertyType.INDEXED_GROUP || 
                    prop.propertyType === PropertyType.NAMED_GROUP) {
                    checkPropertyGroupForEG(comp, prop, layerName, egMap);
                }
            } catch (e) {
                // Skip inaccessible properties
            }
        }
    } catch (e) {
        // Group check failed
    }
}

// Helper function to find a property by name in a composition
function findPropertyByName(comp, propertyName) {
    try {
        for (var layerIndex = 1; layerIndex <= comp.numLayers; layerIndex++) {
            var layer = comp.layer(layerIndex);
            var foundProp = searchPropertyInGroup(layer, propertyName);
            if (foundProp) {
                return foundProp;
            }
        }
        return null;
    } catch (e) {
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
            try {
                layer = property.propertyGroup(property.propertyDepth);
            } catch (e) {
                // Couldn't get layer
            }
        }
        
        // Set layer info and clipId
        if (layer && layer.name) {
            propData.layerName = layer.name;
            if (layer.containingComp) {
                propData.clipId = layer.containingComp.id + "_" + (layer.index - 1);
            }
        }
        
        // Determine property type
        if (isLayer) {
            if (property.matchName === "ADBE Text Layer") {
                propData.propertyType = "text_layer";
                try {
                    var textProp = property.property("ADBE Text Properties").property("ADBE Text Document");
                    if (textProp) {
                        propData.value = textProp.value.text;
                    }
                } catch (e) {
                    propData.value = null;
                }
            } else if (property.matchName === "ADBE AV Layer") {
                propData.propertyType = "av_layer";
                try {
                    if (property.source) {
                        propData.value = {
                            sourceName: property.source.name,
                            sourceId: property.source.id
                        };
                    } else {
                        propData.value = null;
                    }
                } catch (e) {
                    propData.value = null;
                }
            } else {
                propData.propertyType = "layer";
                propData.value = null;
            }
        } else {
            try {
                propData.value = getPropertyValue(property);
            } catch (e) {
                propData.value = null;
            }
            
            try {
                propData.propertyType = determinePropertyType(property);
            } catch (e) {
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
                            value: keyValue,
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
                    } catch (e) {
                        // Skip problematic keyframes
                    }
                }
            } else {
                propData.keyframes = [];
            }
        } else {
            propData.keyframes = [];
        }
        
        return propData;
        
    } catch (error) {
        return {
            name: propertyName,
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
