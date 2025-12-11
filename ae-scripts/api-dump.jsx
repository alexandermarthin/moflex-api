// After Effects API Dump Module
// Used to discover available properties on Essential Graphics items

// Dump all properties of an object to a string
function dumpObjectProperties(obj, objName) {
    var dump = "=== API Dump for " + objName + " ===\n\n";
    
    var props = [];
    var methods = [];
    
    for (var key in obj) {
        try {
            var type = typeof obj[key];
            var valueStr = "";
            
            try {
                if (type === "string") {
                    valueStr = ' = "' + obj[key].substring(0, 50) + '"';
                } else if (type === "number" || type === "boolean") {
                    valueStr = " = " + obj[key];
                }
            } catch (e) {
                // Value access failed
            }
            
            if (type === "function") {
                methods.push("  " + key + "()");
            } else {
                props.push("  " + key + " (" + type + ")" + valueStr);
            }
        } catch (e) {
            props.push("  " + key + " (error: " + e.toString() + ")");
        }
    }
    
    dump += "Properties:\n" + props.join("\n") + "\n\n";
    dump += "Methods:\n" + methods.join("\n") + "\n";
    
    return dump;
}

// Dump Essential Property information for the active composition
function dumpEssentialGraphicsAPI(comp) {
    if (!comp) {
        comp = app.project.activeItem;
    }
    
    if (!comp || !(comp instanceof CompItem)) {
        return "Error: No active composition";
    }
    
    if (!comp.motionGraphicsTemplateName || comp.motionGraphicsTemplateName === "") {
        return "Error: Composition has no Essential Graphics template";
    }
    
    var wrapperComp = null;
    var result = "";
    
    try {
        // Create temporary wrapper comp
        wrapperComp = app.project.items.addComp(
            "_temp_api_dump_" + comp.id,
            comp.width,
            comp.height,
            comp.pixelAspect,
            comp.duration,
            comp.frameRate
        );
        
        // Add comp as layer
        var nestedLayer = wrapperComp.layers.add(comp);
        
        // Get essential properties
        var essentialProps = nestedLayer.essentialProperty;
        
        result += "=== Essential Graphics API Dump ===\n";
        result += "Composition: " + comp.name + "\n";
        result += "Template Name: " + comp.motionGraphicsTemplateName + "\n";
        result += "Number of Essential Properties: " + essentialProps.numProperties + "\n\n";
        
        // Dump the essentialProperty group itself
        result += dumpObjectProperties(essentialProps, "essentialProperty (PropertyGroup)");
        result += "\n\n";
        
        // Dump each individual property
        for (var i = 1; i <= essentialProps.numProperties; i++) {
            var ep = essentialProps.property(i);
            
            result += "--- Property " + i + ": " + ep.name + " ---\n";
            result += "matchName: " + ep.matchName + "\n";
            
            // Check if it's a layer type (has different properties)
            var isLayerType = (ep.matchName === "ADBE AV Layer" || 
                               ep.matchName === "ADBE Text Layer" ||
                               ep.matchName === "ADBE Vector Layer");
            
            result += "isLayerType: " + isLayerType + "\n\n";
            result += dumpObjectProperties(ep, "Essential Property " + i);
            
            // Try to get source property info
            try {
                var source = ep.essentialPropertySource;
                if (source) {
                    result += "\n--- Source Property for " + ep.name + " ---\n";
                    result += dumpObjectProperties(source, "essentialPropertySource");
                }
            } catch (e) {
                result += "\nCould not get essentialPropertySource: " + e.toString() + "\n";
            }
            
            result += "\n\n";
        }
        
    } catch (error) {
        result += "Error during API dump: " + error.toString() + "\n";
    } finally {
        // Clean up
        if (wrapperComp) {
            try {
                wrapperComp.remove();
            } catch (e) {
                result += "Warning: Could not remove temp comp: " + e.toString() + "\n";
            }
        }
    }
    
    return result;
}

// Run the dump and save to file
function runAPIDump() {
    var result = dumpEssentialGraphicsAPI();
    
    // Save to file
    var outputPath = CONFIG.outputPath.replace("project.json", "api_dump.txt");
    
    try {
        var file = new File(outputPath);
        file.open("w");
        file.write(result);
        file.close();
        logToFile("API dump saved to: " + outputPath, 1);
    } catch (e) {
        logToFile("Error saving API dump: " + e.toString(), 1);
    }
    
    return result;
}


