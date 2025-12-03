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

// Polyfill for checking if a variable is an array
function isArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
}

// Save JSON to a fixed location
function saveToFile(text) {
    var saveFile = File("/Users/lumafilm/Documents/code/system/filesapi/TheBucket/632ab2e9-70fb-429e-a682-a3542fcc9cd8/project.json");
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

        // Process each layer in the composition
        for (var i = 1; i <= comp.layers.length; i++) {
            var layer = comp.layers[i];
            var clipId = comp.id + "_" + (i - 1);
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
                                        var keyValue = param.keyValue(k);
                                        var inEase = param.keyInTemporalEase(k)[0];
                                        var outEase = param.keyOutTemporalEase(k)[0];

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
            }

            processPropertyGroup(layer, layerData.properties, layer.threeDLayer);
            clips[clipId] = layerData;
        }

        return compData;
    }

    // Process a property group recursively
    function processPropertyGroup(propertyGroup, output, is3D) {
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
                            $.writeln("Error processing scale: " + scaleError.toString());
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
        for (var i = 1; i <= propertyGroup.numProperties; i++) {
            var property = propertyGroup.property(i);

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
            for (var i = 1; i <= animator.numProperties; i++) {
                var prop = animator.property(i);

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
            for (var i = 1; i <= propertyGroup.numProperties; i++) {
                var prop = propertyGroup.property(i);
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
        for (var i = 1; i <= item.numItems; i++) {
            var subItem = item.item(i);
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
    for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (item.parentFolder === app.project.rootFolder) {
            processItem(item, 0);
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
exportProject();
app.endUndoGroup();
