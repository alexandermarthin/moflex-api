import * as THREE from "three";
import { getValueAtTime } from "@/lib/anim-utils";
import { useProjectStore } from "@/stores/projectStore";
import { useTimerStore } from "@/stores/timerStore";
import { useTransformProperties, useClipClickHandler } from "@/lib/animation-hooks.jsx";

const NullLayer = ({ id, parentTransform }) => {
    const { assets, clips } = useProjectStore();
    
    const clip = clips[id];
    const nullItem = assets[clip.sourceId];

    if (!nullItem) return null;

    // Use the shared hook for transform properties
    const { 
        xAnchorPoint, yAnchorPoint, zAnchorPoint, xPosition, yPosition, zPosition,
        xScale, yScale, zScale, xRotation, yRotation, zRotation 
    } = useTransformProperties(clip);

    // Null layers are always 100x100 pixels
    const width = nullItem.width || 100;
    const height = nullItem.height || 100;

    const handleClick = useClipClickHandler(id);

    // Create outline geometry using LineLoop
    const outlineGeometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height));

    const content = (
        <group 
            position={[xPosition, yPosition, zPosition]}  
            scale={[xScale, yScale, zScale]}
            rotation={[Math.PI * (xRotation / 180), Math.PI * (yRotation / 180), Math.PI * (zRotation / 180)]}
        >
            {/* Invisible clickable area */}
            <mesh
                position={[width/2-xAnchorPoint, height/2-yAnchorPoint, 0-zAnchorPoint]}
                onClick={handleClick}
            >
                <planeGeometry args={[width, height]} />
                <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
            </mesh>
            
            {/* Visible outline */}
            <lineSegments
                position={[width/2-xAnchorPoint, height/2-yAnchorPoint, 0-zAnchorPoint]}
                geometry={outlineGeometry}
                onClick={handleClick}
            >
                <lineBasicMaterial color={0xffffff} opacity={0.8} transparent />
            </lineSegments>
        </group>
    );

    // Apply parent transform if it exists
    if (parentTransform) {
        return (
            <group 
                position={parentTransform.position}
                scale={parentTransform.scale}
                rotation={parentTransform.rotation}
            >
                {content}
            </group>
        );
    }

    return content;
};

export default NullLayer; 