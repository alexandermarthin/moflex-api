// Test script to verify modular structure works
#include "utils.jsx"

logToFile("=== TESTING MODULAR STRUCTURE ===");

// Test basic functionality
try {
    var testObj = { test: "value" };
    var testJson = stringify(testObj);
    logToFile("JSON.stringify test passed: " + testJson);
    
    // Test Object.keys polyfill
    var keys = Object.keys(testObj);
    logToFile("Object.keys test passed: " + keys.length + " keys found");
    
    logToFile("Basic modular structure test PASSED");
} catch (error) {
    logToFile("Basic modular structure test FAILED: " + error.toString());
}

logToFile("=== MODULAR TEST COMPLETE ===");
