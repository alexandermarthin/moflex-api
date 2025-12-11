import React, { useMemo, useState } from "react";
import * as THREE from "three";
import { getValueAtTime } from "@/lib/anim-utils";
import { getTransform } from "@/lib/layer-utils";
import { PivotControls } from "@react-three/drei";

const ShapeLayer = ({ id, clip, updatePropertyValue, setSelectedClipId, selectedClipId, time, parentClip }) => {
    if (!clip || clip.layerType !== "shape" || !clip.shapeContents) {
        return null;
    }

    const { anchorPoint, position, scale, rotation, relativePosition, relativeScale, relativeRotation } = getTransform(clip, time);

    // Initialize local state with current relative values from store
    const [localRelativePosition, setLocalRelativePosition] = useState([relativePosition.x, relativePosition.y, relativePosition.z]);

    const [localRelativeScale, setLocalRelativeScale] = useState([relativeScale.x, relativeScale.y, relativeScale.z]);

    const [localRelativeRotation, setLocalRelativeRotation] = useState([relativeRotation.x, relativeRotation.y, relativeRotation.z]);

    const handleClick = () => {
        setSelectedClipId(id);
    };

    // Extract shape data and create renderable elements
    const shapeData = useMemo(() => {
        let pathData = null;
        let fillData = null;
        let strokeData = null;
        let pathProperty = null;

        try {
            // First, check if there's an animated Path property in the clip properties
            if (clip.properties && clip.properties["Path"]) {
                pathProperty = clip.properties["Path"];
            }

            // Navigate the nested structure to find the actual shape data
            const shapeGroups = clip.shapeContents.contents;

            for (const shapeGroup of shapeGroups) {
                if (shapeGroup.type === "group" && shapeGroup.contents) {
                    // Find the Contents group
                    const contentsGroup = shapeGroup.contents.find((item) => item.matchName === "ADBE Vectors Group" && item.contents);

                    if (contentsGroup) {
                        // Find path, fill, and stroke data in the contents
                        for (const item of contentsGroup.contents) {
                            if (item.type === "path" && item.pathData) {
                                // Use animated path data if available, otherwise use static value
                                if (pathProperty && pathProperty.keyframes && pathProperty.keyframes.length > 0) {
                                    pathData = getValueAtTime(pathProperty, time);
                                } else if (item.pathData.Path && item.pathData.Path.keyframes && item.pathData.Path.keyframes.length > 0) {
                                    pathData = getValueAtTime(item.pathData.Path, time);
                                } else if (item.pathData.Path && item.pathData.Path.value) {
                                    pathData = item.pathData.Path.value;
                                }
                            } else if (item.type === "fill" && item.fillData) {
                                fillData = item.fillData;
                            } else if (item.type === "stroke" && item.strokeData) {
                                strokeData = item.strokeData;
                            }
                        }
                        break; // Found the data we need
                    }
                }
            }
        } catch (error) {
            // Error processing shape data
            console.error("Error processing shape data:", error);
        }

        // Debug logging
        console.log("Shape data extracted:", { pathData, fillData, strokeData });
        console.log("Clip shapeContents:", clip.shapeContents);

        return { pathData, fillData, strokeData };
    }, [clip.shapeContents, clip.properties, time]);

    const { pathData, fillData, strokeData } = shapeData;

    if (!pathData || !pathData.vertices || pathData.vertices.length === 0) {
        console.warn("No valid path data found:", pathData);
        return null;
    }

    // Debug logging for path data
    console.log("Path data for rendering:", pathData);
    console.log("Vertices:", pathData.vertices);
    console.log("In tangents:", pathData.inTangents);
    console.log("Out tangents:", pathData.outTangents);

    // Create shape geometry from path data
    const shapeGeometry = useMemo(() => {
        try {
            // Create a simple shape from path data
            const shape = new THREE.Shape();

            if (pathData.vertices && pathData.vertices.length > 0) {
                // Start with the first vertex
                shape.moveTo(pathData.vertices[0][0], pathData.vertices[0][1]);

                // Add the rest of the vertices with Bezier curves if available
                for (let i = 1; i < pathData.vertices.length; i++) {
                    const vertex = pathData.vertices[i];
                    const prevVertex = pathData.vertices[i - 1];

                    // Check if we have tangent data for Bezier curves
                    if (pathData.outTangents && pathData.inTangents && pathData.outTangents[i - 1] && pathData.inTangents[i]) {
                        // Create Bezier curve using control points
                        const cp1x = prevVertex[0] + pathData.outTangents[i - 1][0];
                        const cp1y = prevVertex[1] + pathData.outTangents[i - 1][1];
                        const cp2x = vertex[0] + pathData.inTangents[i][0];
                        const cp2y = vertex[1] + pathData.inTangents[i][1];

                        shape.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, vertex[0], vertex[1]);
                    } else {
                        // Fall back to straight line
                        shape.lineTo(vertex[0], vertex[1]);
                    }
                }

                // Close the shape if it's closed
                if (pathData.closed) {
                    shape.closePath();
                }
            }

            // Check if the shape has any points
            if (shape.curves.length === 0) {
                console.warn("Shape has no curves, creating default rectangle");
                shape.moveTo(0, 0);
                shape.lineTo(100, 0);
                shape.lineTo(100, 100);
                shape.lineTo(0, 100);
                shape.closePath();
            }

            // Use 64 curve segments for smooth circles/curves
            return new THREE.ShapeGeometry(shape, 64);
        } catch (error) {
            console.error("Error creating shape geometry:", error);
            // Return a default geometry if shape creation fails
            const defaultShape = new THREE.Shape();
            defaultShape.moveTo(0, 0);
            defaultShape.lineTo(100, 0);
            defaultShape.lineTo(100, 100);
            defaultShape.lineTo(0, 100);
            defaultShape.closePath();
            return new THREE.ShapeGeometry(defaultShape, 64);
        }
    }, [pathData]);

    // Create stroke geometry
    const strokeGeometry = useMemo(() => {
        if (!strokeData || !strokeData.enabled || !shapeGeometry) return null;

        try {
            const edges = new THREE.EdgesGeometry(shapeGeometry);
            return edges;
        } catch (error) {
            console.error("Error creating stroke geometry:", error);
            return null;
        }
    }, [shapeGeometry, strokeData]);

    // Update matrix to use current relative values from store
    const matrix = new THREE.Matrix4();

    // Create individual transformation matrices
    const translationMatrix = new THREE.Matrix4().makeTranslation(localRelativePosition[0], localRelativePosition[1], localRelativePosition[2]);

    // Use localRelativeScale directly since it already represents the final scale multiplier
    const scaleMatrix = new THREE.Matrix4().makeScale(localRelativeScale[0], localRelativeScale[1], localRelativeScale[2]);

    const rotationMatrix = new THREE.Matrix4()
        .makeRotationX(THREE.MathUtils.degToRad(localRelativeRotation[0]))
        .multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(localRelativeRotation[1])))
        .multiply(new THREE.Matrix4().makeRotationZ(THREE.MathUtils.degToRad(localRelativeRotation[2])));

    // Combine transformations: translation * rotation * scale
    matrix.multiplyMatrices(translationMatrix, rotationMatrix);
    matrix.multiplyMatrices(matrix, scaleMatrix);

    // Function to update relative values in the store
    const handleDragEnd = () => {
        // Update each axis of the relative position
        updatePropertyValue(id, "Relative X Position", { value: localRelativePosition[0] });
        updatePropertyValue(id, "Relative Y Position", { value: localRelativePosition[1] });
        updatePropertyValue(id, "Relative Z Position", { value: localRelativePosition[2] });

        // Update each axis of the relative scale (multiply by 100 to convert back to percentage)
        updatePropertyValue(id, "Relative X Scale", { value: localRelativeScale[0] * 100 });
        updatePropertyValue(id, "Relative Y Scale", { value: localRelativeScale[1] * 100 });
        updatePropertyValue(id, "Relative Z Scale", { value: localRelativeScale[2] * 100 });

        // Update each axis of the relative rotation
        updatePropertyValue(id, "Relative X Rotation", { value: localRelativeRotation[0] });
        updatePropertyValue(id, "Relative Y Rotation", { value: localRelativeRotation[1] });
        updatePropertyValue(id, "Relative Z Rotation", { value: localRelativeRotation[2] });
    };

    const opacity = clip.properties["Opacity"]?.keyframes?.length > 0 ? getValueAtTime(clip.properties["Opacity"], time) / 100 : (clip.properties["Opacity"]?.value || 100) / 100;

    const content = (
        <group
            position={[position.x, position.y, position.z]}
            scale={[scale.x, scale.y, scale.z]}
            rotation={[Math.PI * (rotation.x / 180), Math.PI * (rotation.y / 180), Math.PI * (rotation.z / 180)]}
        >
            <group position={[-anchorPoint.x, -anchorPoint.y, -anchorPoint.z]}>
                <PivotControls
                    matrix={matrix}
                    autoTransform={false}
                    anchor={[0, 0, 0]}
                    depthTest={false}
                    scale={200}
                    lineWidth={3}
                    visible={selectedClipId === id}
                    activeAxes={[true, true, clip.isThreeD]}
                    rotation={[Math.PI, 0, 0]}
                    onDrag={(localMatrix, deltaLocalMatrix, worldMatrix, deltaWorldMatrix) => {
                        // Extract position from the matrix
                        const position = [localMatrix.elements[12], localMatrix.elements[13], localMatrix.elements[14]];
                        setLocalRelativePosition(position);

                        // Extract scale from the matrix (as final scale multipliers, not relative additions)
                        const sx = Math.sqrt(localMatrix.elements[0] ** 2 + localMatrix.elements[1] ** 2 + localMatrix.elements[2] ** 2);
                        const sy = Math.sqrt(localMatrix.elements[4] ** 2 + localMatrix.elements[5] ** 2 + localMatrix.elements[6] ** 2);
                        const sz = Math.sqrt(localMatrix.elements[8] ** 2 + localMatrix.elements[9] ** 2 + localMatrix.elements[10] ** 2);
                        setLocalRelativeScale([sx, sy, sz]);

                        // Extract rotation from the matrix
                        const scale = [sx, sy, sz];
                        const rotationMatrix = localMatrix.clone();
                        rotationMatrix.elements[12] = 0; // Remove translation
                        rotationMatrix.elements[13] = 0;
                        rotationMatrix.elements[14] = 0;

                        // Normalize by scale to get pure rotation
                        rotationMatrix.elements[0] /= scale[0];
                        rotationMatrix.elements[1] /= scale[0];
                        rotationMatrix.elements[2] /= scale[0];
                        rotationMatrix.elements[4] /= scale[1];
                        rotationMatrix.elements[5] /= scale[1];
                        rotationMatrix.elements[6] /= scale[1];
                        rotationMatrix.elements[8] /= scale[2];
                        rotationMatrix.elements[9] /= scale[2];
                        rotationMatrix.elements[10] /= scale[2];

                        const euler = new THREE.Euler();
                        euler.setFromRotationMatrix(rotationMatrix);
                        const rotation = [THREE.MathUtils.radToDeg(euler.x), THREE.MathUtils.radToDeg(euler.y), THREE.MathUtils.radToDeg(euler.z)];
                        setLocalRelativeRotation(rotation);
                    }}
                    onDragEnd={handleDragEnd}
                >
                    <group onClick={handleClick}>
                        {/* Render fill if enabled */}
                        {fillData && fillData.enabled && shapeGeometry && (
                            <mesh geometry={shapeGeometry} position={[0, 0, -0.1]}>
                                <meshBasicMaterial
                                    color={new THREE.Color(fillData.properties?.Color?.value?.[0] || 1, fillData.properties?.Color?.value?.[1] || 1, fillData.properties?.Color?.value?.[2] || 1)}
                                    transparent={true}
                                    opacity={((fillData.properties?.Opacity?.value || 100) / 100) * opacity}
                                    side={THREE.DoubleSide}
                                />
                            </mesh>
                        )}

                        {/* Render stroke if enabled */}
                        {strokeData && strokeData.enabled && strokeGeometry && (
                            <lineSegments geometry={strokeGeometry} position={[0, 0, 0]}>
                                <lineBasicMaterial
                                    color={new THREE.Color(strokeData.properties?.Color?.value?.[0] || 1, strokeData.properties?.Color?.value?.[1] || 1, strokeData.properties?.Color?.value?.[2] || 1)}
                                    transparent={true}
                                    opacity={((strokeData.properties?.Opacity?.value || 100) / 100) * opacity}
                                />
                            </lineSegments>
                        )}
                    </group>
                </PivotControls>
            </group>
        </group>
    );

    if (parentClip) {
        const { anchorPoint: parentAnchorPoint, position: parentPosition, scale: parentScale, rotation: parentRotation } = getTransform(parentClip, time);

        return (
            <group
                position={[parentPosition.x, parentPosition.y, parentPosition.z]}
                scale={[parentScale.x, parentScale.y, parentScale.z]}
                rotation={[Math.PI * (parentRotation.x / 180), Math.PI * (parentRotation.y / 180), Math.PI * (parentRotation.z / 180)]}
            >
                <group position={[-parentAnchorPoint.x, -parentAnchorPoint.y, -parentAnchorPoint.z]}>{content}</group>
            </group>
        );
    }

    return content;
};

export default ShapeLayer;
