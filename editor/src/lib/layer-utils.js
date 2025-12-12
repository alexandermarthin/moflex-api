import * as THREE from "three";
import { getValueAtTime } from "@/lib/anim-utils";

export function getTransform(clip, time) {
    const props = clip.properties;

    const keyframeOrValue = (name) => {
        return props[name]?.keyframes?.length > 0 ? getValueAtTime(props[name], time) : props[name]?.value;
    };

    return {
        anchorPoint: {
            x: keyframeOrValue("X Anchor Point"),
            y: keyframeOrValue("Y Anchor Point"),
            z: keyframeOrValue("Z Anchor Point"),
        },
        position: {
            x: keyframeOrValue("X Position"),
            y: keyframeOrValue("Y Position"),
            z: keyframeOrValue("Z Position"),
        },
        scale: {
            x: (keyframeOrValue("X Scale") ?? 100) / 100,
            y: (keyframeOrValue("Y Scale") ?? 100) / 100,
            z: (keyframeOrValue("Z Scale") ?? 100) / 100,
        },
        rotation: {
            x: keyframeOrValue("X Rotation"),
            y: keyframeOrValue("Y Rotation"),
            z: keyframeOrValue("Z Rotation"),
        },
        relativePosition: {
            x: keyframeOrValue("Relative X Position") || 0,
            y: keyframeOrValue("Relative Y Position") || 0,
            z: keyframeOrValue("Relative Z Position") || 0,
        },
        relativeScale: {
            x: (keyframeOrValue("Relative X Scale") || 0) / 100,
            y: (keyframeOrValue("Relative Y Scale") || 0) / 100,
            z: (keyframeOrValue("Relative Z Scale") || 0) / 100,
        },
        relativeRotation: {
            x: keyframeOrValue("Relative X Rotation") || 0,
            y: keyframeOrValue("Relative Y Rotation") || 0,
            z: keyframeOrValue("Relative Z Rotation") || 0,
        },
    };
}

/**
 * Build a 4x4 transformation matrix from AE transform properties.
 * AE transform order: Anchor Point → Scale → Rotation → Position
 *
 * The matrix transforms a point as: M = T * R * S * A^-1
 * where:
 *   A^-1 = translate by -anchorPoint (move anchor to origin)
 *   S = scale
 *   R = rotation (Z * Y * X for 3D layers)
 *   T = translate by position
 */
export function buildTransformMatrix(transform) {
    const { position, scale, rotation, anchorPoint } = transform;

    const matrix = new THREE.Matrix4();

    // Start with identity
    matrix.identity();

    // 1. Position translation (applied last in transform chain, first in matrix multiplication)
    matrix.multiply(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z));

    // 2. Rotation (Z * Y * X order for AE compatibility)
    // AE uses degrees, convert to radians
    const rotX = THREE.MathUtils.degToRad(rotation.x || 0);
    const rotY = THREE.MathUtils.degToRad(rotation.y || 0);
    const rotZ = THREE.MathUtils.degToRad(rotation.z || 0);

    // Apply rotations in ZYX order (AE's default 3D rotation order)
    matrix.multiply(new THREE.Matrix4().makeRotationZ(rotZ));
    matrix.multiply(new THREE.Matrix4().makeRotationY(rotY));
    matrix.multiply(new THREE.Matrix4().makeRotationX(rotX));

    // 3. Scale
    matrix.multiply(new THREE.Matrix4().makeScale(scale.x, scale.y, scale.z));

    // 4. Negative anchor point (move anchor point to origin)
    matrix.multiply(new THREE.Matrix4().makeTranslation(-anchorPoint.x, -anchorPoint.y, -anchorPoint.z));

    return matrix;
}

/**
 * Recursively build the world transform matrix for a layer,
 * walking up the parent chain. Supports any depth of parenting.
 *
 * WorldMatrix = GrandparentMatrix * ParentMatrix * ChildMatrix
 */
export function getWorldTransformMatrix(clip, time, clips) {
    const transform = getTransform(clip, time);
    const localMatrix = buildTransformMatrix(transform);

    if (clip.parentLayerId && clips[clip.parentLayerId]) {
        const parentClip = clips[clip.parentLayerId];
        const parentWorldMatrix = getWorldTransformMatrix(parentClip, time, clips);

        const worldMatrix = new THREE.Matrix4();
        worldMatrix.multiplyMatrices(parentWorldMatrix, localMatrix);
        return worldMatrix;
    }

    return localMatrix;
}

/**
 * Decompose a matrix back into position, rotation, scale.
 * Returns values in AE-compatible format (degrees for rotation).
 */
export function decomposeMatrix(matrix) {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    matrix.decompose(position, quaternion, scale);

    const euler = new THREE.Euler().setFromQuaternion(quaternion, "ZYX");

    return {
        position: { x: position.x, y: position.y, z: position.z },
        scale: { x: scale.x, y: scale.y, z: scale.z },
        rotation: {
            x: THREE.MathUtils.radToDeg(euler.x),
            y: THREE.MathUtils.radToDeg(euler.y),
            z: THREE.MathUtils.radToDeg(euler.z),
        },
        // For decomposed matrices, anchor point is baked in, so use zero
        anchorPoint: { x: 0, y: 0, z: 0 },
    };
}
