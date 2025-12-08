// After Effects MOGRT Parser Module
// Exports MOGRT, unzips it, and extracts Essential Graphics data from definition.json

// Property type constants from MOGRT format
var MOGRT_TYPE = {
    SLIDER: 1,
    CHECKBOX: 2,
    COLOR: 4,
    POINT: 5,
    TEXT: 6,
    MEDIA: 14
};

// Scale mode constants
var SCALE_MODE = {
    0: "none",
    1: "fit",
    2: "fill",
    3: "stretch"
};

// Get the temp folder path - use the same folder as the output file
function getTempFolder() {
    // Try to use the configured output path's parent folder
    if (typeof CONFIG !== "undefined" && CONFIG.outputPath) {
        var outputFile = new File(CONFIG.outputPath);
        var parentFolder = outputFile.parent;
        if (parentFolder && parentFolder.exists) {
            return parentFolder.fsName + "/ae_mogrt_temp";
        }
    }
    
    // Fallback to desktop
    return Folder.desktop.fsName + "/ae_mogrt_temp";
}

// Create directory if it doesn't exist
function ensureDirectory(path) {
    var folder = new Folder(path);
    if (!folder.exists) {
        folder.create();
    }
    return folder.exists;
}

// Clean up temp files
function cleanupTemp(tempFolder) {
    try {
        var folder = new Folder(tempFolder);
        if (folder.exists) {
            // Remove all files in folder
            var files = folder.getFiles();
            for (var i = 0; i < files.length; i++) {
                if (files[i] instanceof File) {
                    files[i].remove();
                } else if (files[i] instanceof Folder) {
                    // Recursively clean subfolder
                    cleanupTemp(files[i].fsName);
                    files[i].remove();
                }
            }
            folder.remove();
        }
    } catch (e) {
        logToFile("Warning: Could not clean up temp folder: " + e.toString(), 1);
    }
}

// Execute system command (platform-specific)
function executeCommand(command) {
    try {
        // Check if system.callSystem is available
        if (typeof system === "undefined" || typeof system.callSystem !== "function") {
            logToFile("MOGRT: system.callSystem is not available. Enable 'Allow Scripts to Write Files and Access Network' in After Effects Preferences > Scripting & Expressions", 1);
            return null;
        }
        return system.callSystem(command);
    } catch (e) {
        logToFile("Error executing command: " + e.toString(), 1);
        return null;
    }
}

// Unzip MOGRT file (it's just a ZIP)
function unzipMOGRT(mogrtPath, outputFolder) {
    var command;
    
    if ($.os.indexOf("Windows") !== -1) {
        // Windows - use PowerShell
        command = 'powershell -command "Expand-Archive -Path \'' + mogrtPath + '\' -DestinationPath \'' + outputFolder + '\' -Force"';
    } else {
        // macOS/Linux - use unzip
        command = 'unzip -o "' + mogrtPath + '" -d "' + outputFolder + '"';
    }
    
    logToFile("MOGRT: Unzip command: " + command, 1);
    var result = executeCommand(command);
    logToFile("MOGRT: Unzip result: " + (result ? result.substring(0, 200) : "null"), 1);
    
    // Check if definition.json exists
    var defFile = new File(outputFolder + "/definition.json");
    logToFile("MOGRT: definition.json exists: " + defFile.exists, 1);
    return defFile.exists;
}

// Read file contents
function readFile(filePath) {
    var file = new File(filePath);
    if (!file.exists) {
        return null;
    }
    
    file.open("r");
    file.encoding = "UTF-8";
    var content = file.read();
    file.close();
    
    return content;
}

// Extract localized string from MOGRT format
function getLocalizedString(obj) {
    if (!obj) return "";
    if (typeof obj === "string") return obj;
    if (obj.strDB && obj.strDB.length > 0) {
        // Find en_US or first available
        for (var i = 0; i < obj.strDB.length; i++) {
            if (obj.strDB[i].localeString === "en_US") {
                return obj.strDB[i].str;
            }
        }
        return obj.strDB[0].str;
    }
    return "";
}

// Get property type name from MOGRT type number
function getPropertyTypeName(typeNum) {
    switch (typeNum) {
        case MOGRT_TYPE.SLIDER: return "slider";
        case MOGRT_TYPE.CHECKBOX: return "checkbox";
        case MOGRT_TYPE.COLOR: return "color";
        case MOGRT_TYPE.POINT: return "point";
        case MOGRT_TYPE.TEXT: return "text";
        case MOGRT_TYPE.MEDIA: return "media";
        default: return "unknown";
    }
}

// Parse a single client control from MOGRT
function parseClientControl(control) {
    var prop = {
        id: control.id,
        name: getLocalizedString(control.uiName),
        type: getPropertyTypeName(control.type),
        typeNum: control.type,
        canAnimate: control.canAnimate || false
    };
    
    // Add tooltip if present
    var tooltip = getLocalizedString(control.uiToolTip);
    if (tooltip) {
        prop.tooltip = tooltip;
    }
    
    // Type-specific properties
    switch (control.type) {
        case MOGRT_TYPE.TEXT:
            prop.value = getLocalizedString(control.value);
            if (control.fonteditinfo) {
                prop.font = control.fonteditinfo.fontEditValue;
                prop.fontSize = control.fonteditinfo.fontSizeEditValue;
                prop.fontEditable = control.fonteditinfo.capPropFontEdit;
                prop.fontSizeEditable = control.fonteditinfo.capPropFontSizeEdit;
            }
            break;
            
        case MOGRT_TYPE.MEDIA:
            prop.defaultScaling = SCALE_MODE[control.scale] || "fill";
            prop.scaleValue = control.scale;
            prop.width = control.width;
            prop.height = control.height;
            prop.thumbnail = control.thumbnail;
            if (control.starttime !== undefined && control.timescale) {
                prop.startTime = control.starttime / control.timescale;
                prop.endTime = control.endtime / control.timescale;
                prop.duration = (control.endtime - control.starttime) / control.timescale;
            }
            break;
            
        case MOGRT_TYPE.POINT:
            if (control.value) {
                prop.value = [control.value.x, control.value.y];
            }
            break;
            
        case MOGRT_TYPE.COLOR:
            prop.value = control.value;
            break;
            
        case MOGRT_TYPE.SLIDER:
            prop.value = control.value;
            if (control.minValue !== undefined) prop.min = control.minValue;
            if (control.maxValue !== undefined) prop.max = control.maxValue;
            break;
            
        case MOGRT_TYPE.CHECKBOX:
            prop.value = control.value;
            break;
    }
    
    return prop;
}

// Parse the definition.json and extract Essential Graphics data
function parseDefinition(definitionJson) {
    var data = jsonParse(definitionJson);
    if (!data) {
        return { error: "Failed to parse definition.json" };
    }
    
    var result = {
        templateName: data.capsuleName || "",
        templateId: data.capsuleID || "",
        apiVersion: data.apiVersion || "",
        properties: []
    };
    
    // Parse client controls (Essential Graphics properties)
    if (data.clientControls && data.clientControls.length > 0) {
        for (var i = 0; i < data.clientControls.length; i++) {
            var prop = parseClientControl(data.clientControls[i]);
            prop.propertyIndex = i + 1;
            result.properties.push(prop);
        }
    }
    
    // Extract additional metadata from sourceInfoLocalized
    if (data.sourceInfoLocalized && data.sourceInfoLocalized.en_US) {
        var sourceInfo = data.sourceInfoLocalized.en_US;
        result.compName = sourceInfo.name;
        result.duration = sourceInfo.duration ? sourceInfo.duration.value : 0;
        result.frameRate = sourceInfo.framerate ? 254016000000 / sourceInfo.framerate.ticksperframe : 0;
        result.width = sourceInfo.framesize ? sourceInfo.framesize.size.x : 0;
        result.height = sourceInfo.framesize ? sourceInfo.framesize.size.y : 0;
        result.hasAudio = sourceInfo.hasaudio || false;
        result.hasVideo = sourceInfo.hasvideo || false;
    }
    
    // Extract used fonts
    if (data.usedFontsLocalized && data.usedFontsLocalized.en_US) {
        result.usedFonts = data.usedFontsLocalized.en_US;
    }
    
    // Extract used file types
    if (data.usedFileTypes) {
        result.usedFileTypes = data.usedFileTypes;
    }
    
    return result;
}

// Main function: Export MOGRT and extract Essential Graphics data
function extractMOGRTData(comp) {
    if (!comp || !(comp instanceof CompItem)) {
        logToFile("MOGRT: Invalid composition", 1);
        return { error: "Invalid composition" };
    }
    
    // Check if comp has Essential Graphics
    if (!comp.motionGraphicsTemplateName || comp.motionGraphicsTemplateName === "") {
        logToFile("MOGRT: No template name found", 1);
        return null;
    }
    
    // Store comp info before any operations that might invalidate references
    var compId = comp.id;
    var compName = comp.name;
    var templateName = comp.motionGraphicsTemplateName;
    
    logToFile("Extracting MOGRT data for comp: " + compName, 1);
    logToFile("MOGRT: Template name: " + templateName, 1);
    
    // Adobe's default MOGRT folder - create it if it doesn't exist
    var adobeFolder = new Folder(Folder.myDocuments.fsName + "/Adobe");
    var adobeMOGRTFolder = new Folder(Folder.myDocuments.fsName + "/Adobe/Motion Graphics Templates");
    
    logToFile("MOGRT: Adobe MOGRT folder: " + adobeMOGRTFolder.fsName, 1);
    logToFile("MOGRT: Adobe folder exists: " + adobeMOGRTFolder.exists, 1);
    
    // Create the Adobe folder structure if it doesn't exist
    if (!adobeFolder.exists) {
        adobeFolder.create();
        logToFile("MOGRT: Created Adobe folder", 1);
    }
    if (!adobeMOGRTFolder.exists) {
        adobeMOGRTFolder.create();
        logToFile("MOGRT: Created Motion Graphics Templates folder", 1);
    }
    
    // Use temp folder for extraction
    var tempFolderPath = getTempFolder();
    var tempFolderObj = new Folder(tempFolderPath);
    
    try {
        // Ensure temp directory exists for extraction
        if (!tempFolderObj.exists) {
            tempFolderObj.create();
        }
        logToFile("MOGRT: Temp folder: " + tempFolderObj.fsName, 1);
        
        var expectedMogrtName = templateName + ".mogrt";
        
        // Create File object pointing to Adobe's MOGRT folder (where AE might expect to save)
        var adobeMogrtFile = new File(adobeMOGRTFolder.fsName + "/" + expectedMogrtName);
        var tempMogrtFile = new File(tempFolderObj.fsName + "/" + expectedMogrtName);
        
        logToFile("MOGRT: Adobe MOGRT path: " + adobeMogrtFile.fsName, 1);
        logToFile("MOGRT: Temp MOGRT path: " + tempMogrtFile.fsName, 1);
        
        // Check if MOGRT already exists and note its modified time
        var existingModTime = adobeMogrtFile.exists ? adobeMogrtFile.modified : null;
        logToFile("MOGRT: Existing MOGRT in Adobe folder: " + adobeMogrtFile.exists, 1);
        
        // Try exporting to Adobe's MOGRT folder first (this is where AE expects to save)
        try {
            logToFile("MOGRT: Attempting export to Adobe MOGRT folder...", 1);
            var exportResult = comp.exportAsMotionGraphicsTemplate(adobeMogrtFile);
            logToFile("MOGRT: Export to Adobe folder result: " + exportResult, 1);
        } catch (exportError) {
            logToFile("MOGRT: Export to Adobe folder exception: " + exportError.toString(), 1);
            
            // Try temp folder as fallback
            try {
                logToFile("MOGRT: Trying temp folder instead...", 1);
                exportResult = comp.exportAsMotionGraphicsTemplate(tempMogrtFile);
                logToFile("MOGRT: Export to temp result: " + exportResult, 1);
            } catch (exportError2) {
                logToFile("MOGRT: Export to temp exception: " + exportError2.toString(), 1);
            }
        }
        
        // Small delay to ensure file is written
        $.sleep(1000);
        
        // Check if file was created
        var foundFile = null;
        
        // Refresh file objects
        adobeMogrtFile = new File(adobeMOGRTFolder.fsName + "/" + expectedMogrtName);
        tempMogrtFile = new File(tempFolderObj.fsName + "/" + expectedMogrtName);
        
        // 1. Check Adobe folder first (most likely location)
        logToFile("MOGRT: Checking Adobe folder...", 1);
        if (adobeMogrtFile.exists) {
            var newModTime = adobeMogrtFile.modified;
            var now = new Date();
            var timeDiff = now.getTime() - newModTime.getTime();
            logToFile("MOGRT: Found " + adobeMogrtFile.name + " (age: " + Math.round(timeDiff/1000) + "s)", 1);
            if (!existingModTime || newModTime.getTime() > existingModTime.getTime() || timeDiff < 120000) {
                logToFile("MOGRT: Using file from Adobe folder!", 1);
                foundFile = adobeMogrtFile;
            }
        }
        
        // 2. Check temp folder
        if (!foundFile) {
            logToFile("MOGRT: Checking temp folder...", 1);
            if (tempMogrtFile.exists) {
                logToFile("MOGRT: Found in temp folder!", 1);
                foundFile = tempMogrtFile;
            }
        }
        
        // 3. Search Adobe folder for any MOGRT files
        if (!foundFile && adobeMOGRTFolder.exists) {
            var adobeFiles = adobeMOGRTFolder.getFiles("*.mogrt");
            logToFile("MOGRT: Total MOGRT files in Adobe folder: " + adobeFiles.length, 1);
            var now = new Date();
            for (var a = 0; a < adobeFiles.length; a++) {
                var modTime = adobeFiles[a].modified;
                var timeDiff = now.getTime() - modTime.getTime();
                logToFile("MOGRT:   - " + adobeFiles[a].name + " (age: " + Math.round(timeDiff/1000) + "s)", 1);
                if (timeDiff < 120000) { // Modified in last 2 minutes
                    foundFile = adobeFiles[a];
                    logToFile("MOGRT: Using recently modified: " + adobeFiles[a].name, 1);
                    break;
                }
            }
        }
        
        // 4. Search temp folder for any MOGRT files
        if (!foundFile) {
            var tempFiles = tempFolderObj.getFiles("*.mogrt");
            logToFile("MOGRT: MOGRT files in temp: " + tempFiles.length, 1);
            for (var t = 0; t < tempFiles.length; t++) {
                logToFile("MOGRT:   - " + tempFiles[t].name, 1);
                foundFile = tempFiles[t];
            }
        }
        
        if (!foundFile || !foundFile.exists) {
            logToFile("MOGRT: No MOGRT file found after export", 1);
            logToFile("MOGRT: Checked locations:", 1);
            logToFile("MOGRT:   - Adobe: " + adobeMOGRTFolder.fsName, 1);
            logToFile("MOGRT:   - Temp: " + tempFolderObj.fsName, 1);
            
            return { error: "MOGRT file was not created" };
        }
        
        logToFile("MOGRT exported successfully to: " + foundFile.fsName, 1);
        
        // Create extract folder
        var extractFolder = new Folder(tempFolderObj.fsName + "/extracted");
        if (!extractFolder.exists) {
            extractFolder.create();
        }
        
        if (!extractFolder.exists) {
            logToFile("MOGRT: Could not create extract folder", 1);
            return { error: "Could not create extract folder" };
        }
        logToFile("MOGRT: Extract folder created: " + extractFolder.fsName, 1);
        
        // Unzip MOGRT
        logToFile("MOGRT: Attempting to unzip...", 1);
        if (!unzipMOGRT(foundFile.fsName, extractFolder.fsName)) {
            logToFile("MOGRT: Unzip failed or definition.json not found", 1);
            return { error: "Failed to unzip MOGRT or definition.json not found" };
        }
        
        logToFile("MOGRT unzipped to: " + extractFolder.fsName, 1);
        
        // Read definition.json
        var definitionFile = new File(extractFolder.fsName + "/definition.json");
        logToFile("MOGRT: Reading definition from: " + definitionFile.fsName, 1);
        logToFile("MOGRT: Definition file exists: " + definitionFile.exists, 1);
        
        if (!definitionFile.exists) {
            // List extracted folder contents
            var extractedFiles = extractFolder.getFiles();
            logToFile("MOGRT: Extracted folder contents (" + extractedFiles.length + "):", 1);
            for (var e = 0; e < extractedFiles.length; e++) {
                logToFile("MOGRT:   - " + extractedFiles[e].name, 1);
            }
            return { error: "definition.json not found after extraction" };
        }
        
        var definitionContent = readFile(definitionFile.fsName);
        
        if (!definitionContent) {
            logToFile("MOGRT: Could not read definition.json", 1);
            return { error: "Could not read definition.json" };
        }
        
        logToFile("MOGRT: Definition.json read, length: " + definitionContent.length, 1);
        
        // Parse and return the data
        var result = parseDefinition(definitionContent);
        
        if (result.error) {
            logToFile("MOGRT: Parse error: " + result.error, 1);
            return result;
        }
        
        // Add comp reference info
        result.compId = compId;
        
        logToFile("MOGRT parsing complete. Found " + result.properties.length + " properties", 1);
        
        return result;
        
    } catch (error) {
        logToFile("Error extracting MOGRT data: " + error.toString(), 1);
        if (error.line) {
            logToFile("  at line: " + error.line, 1);
        }
        return { error: "MOGRT extraction failed: " + error.toString() };
        
    } finally {
        // Clean up temp files
        cleanupTemp(tempFolderObj.fsName);
    }
}

