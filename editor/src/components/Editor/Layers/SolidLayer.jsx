import * as THREE from "three";
import { getValueAtTime } from "@/lib/anim-utils";
import { getTransform, getWorldTransformMatrix } from "@/lib/layer-utils";
import { PivotControls } from "@react-three/drei";
import { useState, useMemo } from "react";
import MaskedLayer from "@/components/Editor/Layers/MaskedLayer";
import LayerMask from "@/components/Editor/Layers/LayerMask";

const SolidLayer = ({ id, clip, solidItem, updatePropertyValue, setSelectedClipId, selectedClipId, time, parentClip, compWidth, compHeight, clips }) => {
    const opacity = clip.properties["Opacity"].keyframes.length > 0 ? getValueAtTime(clip.properties["Opacity"], time) / 100 : clip.properties["Opacity"].value / 100;

    const color = new THREE.Color(solidItem.solidColor.red, solidItem.solidColor.green, solidItem.solidColor.blue);
    color.convertSRGBToLinear();

    const { anchorPoint, position, scale, rotation, relativePosition, relativeScale, relativeRotation } = getTransform(clip, time);
    const { width, height } = solidItem;

    // Initialize local state with current relative values from store
    const [localRelativePosition, setLocalRelativePosition] = useState([relativePosition.x, relativePosition.y, relativePosition.z]);

    const [localRelativeScale, setLocalRelativeScale] = useState([relativeScale.x, relativeScale.y, relativeScale.z]);

    const [localRelativeRotation, setLocalRelativeRotation] = useState([relativeRotation.x, relativeRotation.y, relativeRotation.z]);

    const handleClick = () => {
        setSelectedClipId(id);
    };

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

    const hasMasks = (clip?.masks && clip.masks.length > 0) || clip?.properties?.["Mask Path"]?.keyframes?.length > 0;

    // Transform object to pass to MaskedLayer (applied inside FBO scenes)
    const transform = {
        position,
        scale,
        rotation,
        anchorPoint,
    };

    // For masked layers, compute world transform matrix that includes all parent transforms
    // This supports any depth of parenting (grandparent → parent → child)
    const worldTransformMatrix = useMemo(() => {
        if (!hasMasks) return null;

        // Use recursive function that walks entire parent chain
        if (clips && clip.parentLayerId) {
            return getWorldTransformMatrix(clip, time, clips);
        }

        return null;
    }, [hasMasks, clip, time, clips]);

    // The mesh content (same for both masked and non-masked)
    const meshContent = (
        <mesh position={[width / 2, height / 2, 0]} onClick={handleClick}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial color={color} side={THREE.DoubleSide} opacity={opacity} transparent={opacity < 1} />
        </mesh>
    );

    // For masked layers, MaskedLayer handles transforms internally at comp resolution
    if (hasMasks) {
        // Use transformMatrix when layer has parent(s), otherwise use transform object
        const maskedContent = (
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
                    const pos = [localMatrix.elements[12], localMatrix.elements[13], localMatrix.elements[14]];
                    setLocalRelativePosition(pos);

                    // Extract scale from the matrix (as final scale multipliers, not relative additions)
                    const sx = Math.sqrt(localMatrix.elements[0] ** 2 + localMatrix.elements[1] ** 2 + localMatrix.elements[2] ** 2);
                    const sy = Math.sqrt(localMatrix.elements[4] ** 2 + localMatrix.elements[5] ** 2 + localMatrix.elements[6] ** 2);
                    const sz = Math.sqrt(localMatrix.elements[8] ** 2 + localMatrix.elements[9] ** 2 + localMatrix.elements[10] ** 2);

                    // Extract rotation from the matrix
                    const scaleVals = [sx, sy, sz];
                    const rotMatrix = localMatrix.clone();
                    rotMatrix.elements[12] = 0; // Remove translation
                    rotMatrix.elements[13] = 0;
                    rotMatrix.elements[14] = 0;

                    // Normalize by scale to get pure rotation
                    rotMatrix.elements[0] /= scaleVals[0];
                    rotMatrix.elements[1] /= scaleVals[0];
                    rotMatrix.elements[2] /= scaleVals[0];
                    rotMatrix.elements[4] /= scaleVals[1];
                    rotMatrix.elements[5] /= scaleVals[1];
                    rotMatrix.elements[6] /= scaleVals[1];
                    rotMatrix.elements[8] /= scaleVals[2];
                    rotMatrix.elements[9] /= scaleVals[2];
                    rotMatrix.elements[10] /= scaleVals[2];

                    const euler = new THREE.Euler();
                    euler.setFromRotationMatrix(rotMatrix);
                    const rotVals = [THREE.MathUtils.radToDeg(euler.x), THREE.MathUtils.radToDeg(euler.y), THREE.MathUtils.radToDeg(euler.z)];
                    setLocalRelativeRotation(rotVals);
                    setLocalRelativeScale([sx, sy, sz]);
                }}
                onDragEnd={handleDragEnd}
            >
                <MaskedLayer
                    compWidth={compWidth}
                    compHeight={compHeight}
                    width={width}
                    height={height}
                    mode="alpha"
                    invert={false}
                    transform={worldTransformMatrix ? undefined : transform}
                    transformMatrix={worldTransformMatrix}
                    mask={<LayerMask width={width} height={height} clip={clip} time={time} />}
                >
                    {meshContent}
                </MaskedLayer>
            </PivotControls>
        );

        // No parent wrapper needed for masked layers - parent transforms are baked into worldTransformMatrix
        return maskedContent;
    }

    // Non-masked layers keep the original transform structure
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
                        const pos = [localMatrix.elements[12], localMatrix.elements[13], localMatrix.elements[14]];
                        setLocalRelativePosition(pos);

                        // Extract scale from the matrix (as final scale multipliers, not relative additions)
                        const sx = Math.sqrt(localMatrix.elements[0] ** 2 + localMatrix.elements[1] ** 2 + localMatrix.elements[2] ** 2);
                        const sy = Math.sqrt(localMatrix.elements[4] ** 2 + localMatrix.elements[5] ** 2 + localMatrix.elements[6] ** 2);
                        const sz = Math.sqrt(localMatrix.elements[8] ** 2 + localMatrix.elements[9] ** 2 + localMatrix.elements[10] ** 2);
                        setLocalRelativeScale([sx, sy, sz]);

                        // Extract rotation from the matrix
                        const scaleVals = [sx, sy, sz];
                        const rotMatrix = localMatrix.clone();
                        rotMatrix.elements[12] = 0; // Remove translation
                        rotMatrix.elements[13] = 0;
                        rotMatrix.elements[14] = 0;

                        // Normalize by scale to get pure rotation
                        rotMatrix.elements[0] /= scaleVals[0];
                        rotMatrix.elements[1] /= scaleVals[0];
                        rotMatrix.elements[2] /= scaleVals[0];
                        rotMatrix.elements[4] /= scaleVals[1];
                        rotMatrix.elements[5] /= scaleVals[1];
                        rotMatrix.elements[6] /= scaleVals[1];
                        rotMatrix.elements[8] /= scaleVals[2];
                        rotMatrix.elements[9] /= scaleVals[2];
                        rotMatrix.elements[10] /= scaleVals[2];

                        const euler = new THREE.Euler();
                        euler.setFromRotationMatrix(rotMatrix);
                        const rotVals = [THREE.MathUtils.radToDeg(euler.x), THREE.MathUtils.radToDeg(euler.y), THREE.MathUtils.radToDeg(euler.z)];
                        setLocalRelativeRotation(rotVals);
                    }}
                    onDragEnd={handleDragEnd}
                >
                    {meshContent}
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

export default SolidLayer;
