// After Effects Project Export Script - Utilities Module
// Contains common helper functions, JSON polyfill, and logging

// Test if native JSON.stringify is available, otherwise use polyfill
var stringify;
try {
    // Test if native JSON.stringify works
    var testObj = { test: "value" };
    var testResult = JSON.stringify(testObj);
    if (testResult === '{"test":"value"}') {
        stringify = JSON.stringify;
        logToFile("Using native JSON.stringify");
    } else {
        throw new Error("Native JSON.stringify test failed");
    }
} catch (e) {
    logToFile("Native JSON.stringify not available, using polyfill: " + e.toString());

    stringify = function (obj) {
        function escapeString(str) {
            return '"' + String(str).replace(/\\/g, "\\\\").replace(/\"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + '"';
        }

        function serialize(value) {
            var t = typeof value;
            if (value === null) return "null";
            if (t === "number") return isFinite(value) ? String(value) : "null";
            if (t === "boolean") return value ? "true" : "false";
            if (t === "string") return escapeString(value);
            if (t === "undefined") return undefined; // omit in objects, becomes null in arrays

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
function logToFile(message) {
    try {
        var logFile = File("/Users/lumafilm/Documents/code/moflex-api/editor/public/log.txt");
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

// Save JSON to a fixed location
function saveToFile(text) {
    var saveFile = File("/Users/lumafilm/Documents/code/moflex-api/editor/public/project.json");
    saveFile.open("w");
    saveFile.write(text);
    saveFile.close();
}

// Polyfill for checking if a variable is an array
function isArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
}

// Helper function to get interpolation type
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
    if (prop.value instanceof Array) {
        return prop.value;
    }
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
