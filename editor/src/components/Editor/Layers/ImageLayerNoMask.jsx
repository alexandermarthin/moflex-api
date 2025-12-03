import * as THREE from "three";
import { useState } from "react";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { getTransform } from "@/lib/layer-utils";
import { getValueAtTime } from "@/lib/anim-utils";
import { FILE_API_ENDPOINTS } from "@/lib/constants";
import { PivotControls } from "@react-three/drei";

const ImageLayer = ({ id, clip, asset, updatePropertyValue, setSelectedClipId, selectedClipId, time, parentClip, projectId }) => {
    const { anchorPoint, position, scale, rotation, relativePosition, relativeScale, relativeRotation } = getTransform(clip, time);

    // Initialize local state with current relative values from store
    const [localRelativePosition, setLocalRelativePosition] = useState([relativePosition.x, relativePosition.y, relativePosition.z]);

    const [localRelativeScale, setLocalRelativeScale] = useState([relativeScale.x, relativeScale.y, relativeScale.z]);

    const [localRelativeRotation, setLocalRelativeRotation] = useState([relativeRotation.x, relativeRotation.y, relativeRotation.z]);

    const imageUrl = `${FILE_API_ENDPOINTS.DOWNLOAD}/${projectId}/${asset.url}`;
    // const imageUrl = "/632ab2e9-70fb-429e-a682-a3542fcc9cd8.jpg";
    const texture = useLoader(TextureLoader, imageUrl);
    if (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
    }

    const opacity = clip.properties["Opacity"].keyframes.length > 0 ? getValueAtTime(clip.properties["Opacity"], time) / 100 : clip.properties["Opacity"].value / 100;

    const { width, height } = asset;

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

        updatePropertyValue(id, "Relative X Scale", { value: localRelativeScale[0] * 100 });
        updatePropertyValue(id, "Relative Y Scale", { value: localRelativeScale[1] * 100 });
        updatePropertyValue(id, "Relative Z Scale", { value: localRelativeScale[2] * 100 });

        // Update each axis of the relative rotation
        updatePropertyValue(id, "Relative X Rotation", { value: localRelativeRotation[0] });
        updatePropertyValue(id, "Relative Y Rotation", { value: localRelativeRotation[1] });
        updatePropertyValue(id, "Relative Z Rotation", { value: localRelativeRotation[2] });
    };

    const content = (
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
            <group
                position={[position.x, position.y, position.z]}
                scale={[scale.x, scale.y, scale.z]}
                rotation={[Math.PI * (rotation.x / 180), Math.PI * (rotation.y / 180), Math.PI * (rotation.z / 180)]}
            >
                <group position={[-anchorPoint.x, -anchorPoint.y, -anchorPoint.z]}>
                    <mesh position={[width / 2, height / 2, 0]} scale={[1, -1, 1]} onClick={handleClick}>
                        <planeGeometry args={[width, height]} />
                        <meshBasicMaterial map={texture} side={THREE.DoubleSide} opacity={opacity} transparent={opacity < 1} />
                    </mesh>
                </group>
            </group>
        </PivotControls>
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

export default ImageLayer;
