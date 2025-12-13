// After Effects Project Export Script - Utilities Module
// Contains common helper functions, JSON polyfill, and logging

// =============================================================================
// CONSTANTS - Property types and interpolation modes
// =============================================================================
var PROP_TYPE = {
    PROPERTY: 1,
    INDEXED_GROUP: 2,
    NAMED_GROUP: 3,
    MASK_SHAPE: 6212,
    SHAPE_ELEMENT: 6213
};

var INTERP_TYPE = {
    LINEAR: 6612,
    BEZIER: 6613,
    HOLD: 6614
};

// Test if native JSON.stringify is available, otherwise use polyfill
var stringify;
try {
    // Test if native JSON.stringify works
    var testObj = { test: "value" };
    var testResult = JSON.stringify(testObj);
    if (testResult === '{"test":"value"}') {
        stringify = JSON.stringify;
    } else {
        throw new Error("Native JSON.stringify test failed");
    }
} catch (e) {

    stringify = function (obj) {
        // Track visited objects to prevent circular reference infinite loops
        var visited = [];
        
        function escapeString(str) {
            return '"' + String(str).replace(/\\/g, "\\\\").replace(/\"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + '"';
        }

        function serialize(value) {
            var t = typeof value;
            if (value === null) return "null";
            if (t === "number") return isFinite(value) ? String(value) : "null";
            if (t === "boolean") return value ? "true" : "false";
            if (t === "string") return escapeString(value);
            if (t === "undefined") return undefined;

            // Check for circular references
            if (t === "object") {
                for (var i = 0; i < visited.length; i++) {
                    if (visited[i] === value) {
                        return '"[Circular]"';
                    }
                }
                visited.push(value);
            }

            // Arrays
            if (value && value.constructor === Array) {
                var arr = [];
                for (var i = 0; i < value.length; i++) {
                    var v = serialize(value[i]);
                    arr.push(v === undefined ? "null" : v);
                }
                return "[" + arr.join(",") + "]";
            }

            // Objects
            if (t === "object") {
                var props = [];
                for (var k in value) {
                    if (value.hasOwnProperty(k)) {
                        var sv = serialize(value[k]);
                        if (sv !== undefined) {
                            props.push('"' + k + '":' + sv);
                        }
                    }
                }
                return "{" + props.join(",") + "}";
            }

            return "null";
        }

        return serialize(obj);
    };
}

// Helper function to log to file instead of console
// level: 1 = errors/milestones (always shown), 2 = verbose debug
function logToFile(message, level) {
    level = level || 2; // Default to verbose (level 2)
    
    // Check if CONFIG exists and if log level allows this message
    if (typeof CONFIG !== "undefined" && CONFIG.logLevel < level) {
        return; // Skip this log message
    }
    if (typeof CONFIG !== "undefined" && CONFIG.logLevel === 0) {
        return; // Logging disabled
    }
    
    try {
        var logPath = (typeof CONFIG !== "undefined" && CONFIG.logPath) 
            ? CONFIG.logPath 
            : "/Users/lumafilm/Documents/code/moflex-api/editor/public/log.txt";
        var logFile = File(logPath);
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

// Save JSON to configured output location
function saveToFile(text) {
    var outputPath = (typeof CONFIG !== "undefined" && CONFIG.outputPath)
        ? CONFIG.outputPath
        : "/Users/lumafilm/Documents/code/moflex-api/editor/public/project.json";
    
    // Log what we're about to save
    if (!text || text.length === 0) {
        logToFile("ERROR: saveToFile called with empty text!", 1);
        return;
    }
    logToFile("Saving " + text.length + " characters to: " + outputPath, 1);
    
    try {
        var saveFile = File(outputPath);
        var opened = saveFile.open("w");
        if (!opened) {
            logToFile("ERROR: Failed to open file for writing: " + outputPath, 1);
            return;
        }
        saveFile.encoding = "UTF-8";
        var written = saveFile.write(text);
        if (!written) {
            logToFile("ERROR: Failed to write to file: " + outputPath, 1);
        }
        saveFile.close();
        logToFile("File saved successfully", 1);
    } catch (e) {
        logToFile("ERROR: saveToFile exception: " + e.toString(), 1);
    }
}

// Polyfill for checking if a variable is an array
function isArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
}

// Helper function to get interpolation type
function getInterpolationType(type) {
    switch (type) {
        case INTERP_TYPE.LINEAR:
            return "LINEAR";
        case INTERP_TYPE.BEZIER:
            return "BEZIER";
        case INTERP_TYPE.HOLD:
            return "HOLD";
        default:
            return "UNKNOWN";
    }
}

// Track matte type constants (in case they're not available in all AE versions)
if (typeof TrackMatteType === "undefined") {
    var TrackMatteType = {
        NO_TRACK_MATTE: 0,
        ALPHA: 1,
        ALPHA_INVERTED: 2,
        LUMA: 3,
        LUMA_INVERTED: 4,
        NONE: 0, // Alias for NO_TRACK_MATTE
    };
}

// Helper function to get property value at current time
function getPropertyValue(prop) {
    return prop.value;
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

// Helper function to create 3D keyframe data
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

// Generic keyframe extraction helper
// Returns an array of keyframes with time, value, and optional easing data
function extractKeyframes(property, includeEasing) {
    var keyframes = [];
    if (!property || !property.numKeys || property.numKeys === 0) {
        return keyframes;
    }
    
    for (var k = 1; k <= property.numKeys; k++) {
        try {
            var keyframe = {
                time: property.keyTime(k),
                value: property.keyValue(k)
            };
            
            if (includeEasing) {
                try {
                    var inEase = property.keyInTemporalEase(k)[0];
                    var outEase = property.keyOutTemporalEase(k)[0];
                    keyframe.easing = {
                        inType: getInterpolationType(property.keyInInterpolationType(k)),
                        outType: getInterpolationType(property.keyOutInterpolationType(k)),
                        inEase: { speed: inEase.speed, influence: inEase.influence },
                        outEase: { speed: outEase.speed, influence: outEase.influence },
                        continuous: property.keyTemporalContinuous(k),
                        autoBezier: property.keyTemporalAutoBezier(k)
                    };
                } catch (e) {
                    // Easing data not available
                }
            }
            
            keyframes.push(keyframe);
        } catch (e) {
            // Skip problematic keyframes
        }
    }
    
    return keyframes;
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
                value: keyValue,
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
