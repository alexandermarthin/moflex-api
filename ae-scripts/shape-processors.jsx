// After Effects Project Export Script - Shape Processors Module
// Handles shape layer processing including groups, paths, fills, strokes, etc.

// Helper function to process shape groups
function processShapeGroup(shapeGroup) {
    try {
        var groupData = {
            name: shapeGroup.name,
            matchName: shapeGroup.matchName,
            type: "group",
            contents: [],
        };

        // Process contents of the shape group
        for (var groupIndex = 1; groupIndex <= shapeGroup.numProperties; groupIndex++) {
            try {
                var content = shapeGroup.property(groupIndex);
                if (content) {
                    // PropertyType.INDEXED_GROUP = 2, PropertyType.PROPERTY = 1
                    if (content.propertyType === PROP_TYPE.INDEXED_GROUP || content.propertyType === PropertyType.INDEXED_GROUP) {
                        var contentData = processShapeContent(content);
                        if (contentData) {
                            groupData.contents.push(contentData);
                        }
                    } else if (content.propertyType === PROP_TYPE.PROPERTY || content.propertyType === PropertyType.PROPERTY) {
                        // Handle direct properties in shape groups
                        var propData = processProperty(content);
                        if (propData) {
                            groupData.contents.push({
                                name: propData.name,
                                type: "property",
                                property: propData,
                            });
                        }
                    } else {
                        // Unknown property type, add to debug
                        groupData.contents.push({
                            name: content.name,
                            type: "unknown",
                            propertyType: content.propertyType,
                            matchName: content.matchName,
                        });
                    }
                }
            } catch (contentError) {
                // Skip problematic content
                continue;
            }
        }

        return groupData;
    } catch (error) {
        // Return a basic group structure if processing fails
        return {
            name: shapeGroup ? shapeGroup.name : "Unknown",
            matchName: shapeGroup ? shapeGroup.matchName : "Unknown",
            type: "group",
            contents: [],
            error: "Failed to process shape group: " + error.toString(),
        };
    }
}

// Helper function to process shape content (paths, fills, strokes, etc.)
function processShapeContent(content) {
    try {
        var contentData = {
            name: content.name,
            matchName: content.matchName,
            type: "unknown",
        };

        // Determine content type based on matchName
        if (content.matchName === "ADBE Vector Group" || content.matchName === "ADBE Vectors Group") {
            contentData.type = "group";
            contentData.contents = [];

            // Process nested contents
            for (var contentIndex = 1; contentIndex <= content.numProperties; contentIndex++) {
                try {
                    var nestedContent = content.property(contentIndex);
                    if (nestedContent) {
                        // PropertyType.INDEXED_GROUP = 2, PropertyType.PROPERTY = 1
                        if (nestedContent.propertyType === PROP_TYPE.INDEXED_GROUP || nestedContent.propertyType === PropertyType.INDEXED_GROUP) {
                            var nestedData = processShapeContent(nestedContent);
                            if (nestedData) {
                                contentData.contents.push(nestedData);
                            }
                        } else if (nestedContent.propertyType === PROP_TYPE.PROPERTY || nestedContent.propertyType === PropertyType.PROPERTY) {
                            // Handle direct properties in nested content
                            var propData = processProperty(nestedContent);
                            if (propData) {
                                contentData.contents.push({
                                    name: propData.name,
                                    type: "property",
                                    property: propData,
                                });
                            }
                        } else if (nestedContent.propertyType === PROP_TYPE.SHAPE_ELEMENT) {
                            // Handle shape elements with propertyType 6213
                            var shapeElementData = processShapeElement(nestedContent);
                            if (shapeElementData) {
                                contentData.contents.push(shapeElementData);
                            }
                        } else {
                            // Unknown property type, add to debug
                            contentData.contents.push({
                                name: nestedContent.name,
                                type: "unknown",
                                propertyType: nestedContent.propertyType,
                                matchName: nestedContent.matchName,
                            });
                        }
                    }
                } catch (nestedError) {
                    // Skip problematic nested content
                    continue;
                }
            }

            // If no contents were found, add debug information
            if (contentData.contents.length === 0) {
                contentData.debug = {
                    numProperties: content.numProperties,
                    propertyTypes: [],
                };

                // Collect property types for debugging
                for (var i = 1; i <= content.numProperties; i++) {
                    try {
                        var nestedContent = content.property(i);
                        if (nestedContent) {
                            contentData.debug.propertyTypes.push({
                                index: i,
                                name: nestedContent.name,
                                matchName: nestedContent.matchName,
                                propertyType: nestedContent.propertyType,
                                numProperties: nestedContent.numProperties || 0,
                            });
                        }
                    } catch (e) {
                        contentData.debug.propertyTypes.push({
                            index: i,
                            error: e.toString(),
                        });
                    }
                }
            }
        } else if (content.matchName === "ADBE Vector Shape - Rect" || content.matchName === "ADBE Vector Shape - Rectangle") {
            contentData.type = "rectangle";
            contentData.rectData = processRectangleData(content);
        } else if (content.matchName === "ADBE Vector Shape - Ellipse" || content.matchName === "ADBE Vector Shape - Circle") {
            contentData.type = "ellipse";
            contentData.ellipseData = processEllipseData(content);
        } else if (content.matchName === "ADBE Vector Shape - Group" || content.matchName === "ADBE Vector Shape - Path") {
            contentData.type = "path";
            contentData.pathData = processPathData(content);
        } else if (content.matchName === "ADBE Vector Graphic - Fill") {
            contentData.type = "fill";
            contentData.fillData = processFillData(content);
        } else if (content.matchName === "ADBE Vector Graphic - Stroke") {
            contentData.type = "stroke";
            contentData.strokeData = processStrokeData(content);
        } else if (content.matchName === "ADBE Vector Filter - Merge") {
            contentData.type = "merge";
            contentData.mergeData = processMergeData(content);
        } else if (content.matchName === "ADBE Vector Filter - Trim") {
            contentData.type = "trim";
            contentData.trimData = processTrimData(content);
        } else if (content.matchName === "ADBE Vector Filter - Repeater") {
            contentData.type = "repeater";
            contentData.repeaterData = processRepeaterData(content);
        } else if (content.matchName === "ADBE Vector Shape - Star") {
            contentData.type = "star";
            contentData.starData = processStarData(content);
        } else if (content.matchName === "ADBE Vector Shape - Polystar") {
            contentData.type = "polystar";
            contentData.polystarData = processPolystarData(content);
        } else {
            // Handle other shape content types - including those with propertyType 6213
            contentData.type = "unknown";
            contentData.properties = {};
            contentData.matchName = content.matchName; // Store the actual match name for debugging
            contentData.propertyType = content.propertyType; // Store the property type for debugging

            // Process all properties
            for (var i = 1; i <= content.numProperties; i++) {
                try {
                    var prop = content.property(i);
                    if (prop && (prop.propertyType === PROP_TYPE.PROPERTY || prop.propertyType === PropertyType.PROPERTY)) {
                        var propData = processProperty(prop);
                        if (propData) {
                            contentData.properties[propData.name] = propData;
                        }
                    }
                } catch (propError) {
                    // Skip problematic properties
                    continue;
                }
            }
        }

        return contentData;
    } catch (error) {
        // Return a basic content structure if processing fails
        return {
            name: content ? content.name : "Unknown",
            matchName: content ? content.matchName : "Unknown",
            type: "unknown",
            error: "Failed to process shape content: " + error.toString(),
        };
    }
}

// Helper function to process shape elements with propertyType 6213
function processShapeElement(shapeElement) {
    try {
        var elementData = {
            name: shapeElement.name,
            matchName: shapeElement.matchName,
            type: "unknown",
            properties: {},
        };

        // Determine element type based on matchName
        if (shapeElement.matchName === "ADBE Vector Shape - Group" || shapeElement.matchName === "ADBE Vector Shape - Path") {
            elementData.type = "path";
            elementData.pathData = processPathData(shapeElement);
        } else if (shapeElement.matchName === "ADBE Vector Graphic - Fill") {
            elementData.type = "fill";
            elementData.fillData = processFillData(shapeElement);
        } else if (shapeElement.matchName === "ADBE Vector Graphic - Stroke") {
            elementData.type = "stroke";
            elementData.strokeData = processStrokeData(shapeElement);
        } else if (shapeElement.matchName === "ADBE Vector Shape - Rect" || shapeElement.matchName === "ADBE Vector Shape - Rectangle") {
            elementData.type = "rectangle";
            elementData.rectData = processRectangleData(shapeElement);
        } else if (shapeElement.matchName === "ADBE Vector Shape - Ellipse" || shapeElement.matchName === "ADBE Vector Shape - Circle") {
            elementData.type = "ellipse";
            elementData.ellipseData = processEllipseData(shapeElement);
        } else {
            // Handle other shape element types
            elementData.type = "unknown";
            elementData.matchName = shapeElement.matchName;
            elementData.propertyType = shapeElement.propertyType;

            // Process all properties
            for (var elementIndex = 1; elementIndex <= shapeElement.numProperties; elementIndex++) {
                try {
                    var prop = shapeElement.property(elementIndex);
                    if (prop && (prop.propertyType === PROP_TYPE.PROPERTY || prop.propertyType === PropertyType.PROPERTY)) {
                        var propData = processProperty(prop);
                        if (propData) {
                            elementData.properties[propData.name] = propData;
                        }
                    }
                } catch (propError) {
                    // Skip problematic properties
                    continue;
                }
            }
        }

        return elementData;
    } catch (error) {
        // Return a basic element structure if processing fails
        return {
            name: shapeElement ? shapeElement.name : "Unknown",
            matchName: shapeElement ? shapeElement.matchName : "Unknown",
            type: "unknown",
            propertyType: shapeElement ? shapeElement.propertyType : "Unknown",
            error: "Failed to process shape element: " + error.toString(),
        };
    }
}

// Generic helper to extract properties from shape content
// includeEnabled: if true, returns { enabled, properties }, otherwise returns properties directly
function processShapeProperties(content, includeEnabled) {
    try {
        var data = includeEnabled ? { enabled: content.enabled, properties: {} } : {};
        var target = includeEnabled ? data.properties : data;

        for (var i = 1; i <= content.numProperties; i++) {
            try {
                var prop = content.property(i);
                if (prop && (prop.propertyType === PROP_TYPE.PROPERTY || prop.propertyType === PropertyType.PROPERTY)) {
                    var propData = processProperty(prop);
                    if (propData) {
                        target[propData.name] = propData;
                    }
                }
            } catch (e) {
                // Skip problematic properties
            }
        }

        return data;
    } catch (error) {
        if (includeEnabled) {
            return { enabled: false, properties: {}, error: error.toString() };
        }
        return { error: error.toString() };
    }
}

// Convenience wrappers using the generic function
function processRectangleData(content) { return processShapeProperties(content, false); }
function processEllipseData(content) { return processShapeProperties(content, false); }
function processPathData(content) { return processShapeProperties(content, false); }
function processStarData(content) { return processShapeProperties(content, false); }
function processPolystarData(content) { return processShapeProperties(content, false); }
function processFillData(content) { return processShapeProperties(content, true); }
function processStrokeData(content) { return processShapeProperties(content, true); }
function processMergeData(content) { return processShapeProperties(content, true); }
function processTrimData(content) { return processShapeProperties(content, true); }
function processRepeaterData(content) { return processShapeProperties(content, true); }
