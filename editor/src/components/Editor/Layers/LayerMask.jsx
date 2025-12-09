import * as THREE from "three";
import { useMemo } from "react";
import { getValueAtTime } from "@/lib/anim-utils";

// Builds a THREE.ShapeGeometry from AE-like path data
function buildShapeGeometryFromPath(pathData) {
    try {
        const shape = new THREE.Shape();

        if (pathData?.vertices && pathData.vertices.length > 0) {
            const vertices = pathData.vertices;
            const inTangents = pathData.inTangents || [];
            const outTangents = pathData.outTangents || [];

            shape.moveTo(vertices[0][0], vertices[0][1]);

            for (let i = 1; i < vertices.length; i++) {
                const v = vertices[i];
                const prev = vertices[i - 1];
                const hasTangents = !!(outTangents[i - 1] && inTangents[i]);

                if (hasTangents) {
                    const cp1x = prev[0] + outTangents[i - 1][0];
                    const cp1y = prev[1] + outTangents[i - 1][1];
                    const cp2x = v[0] + inTangents[i][0];
                    const cp2y = v[1] + inTangents[i][1];
                    shape.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, v[0], v[1]);
                } else {
                    shape.lineTo(v[0], v[1]);
                }
            }

            if (pathData.closed) {
                // Close back to first point using its in/out tangents if present
                const lastIndex = vertices.length - 1;
                const hasCloseTangents = !!(outTangents[lastIndex] && inTangents[0]);
                if (hasCloseTangents) {
                    const last = vertices[lastIndex];
                    const first = vertices[0];
                    const cp1x = last[0] + outTangents[lastIndex][0];
                    const cp1y = last[1] + outTangents[lastIndex][1];
                    const cp2x = first[0] + inTangents[0][0];
                    const cp2y = first[1] + inTangents[0][1];
                    shape.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, first[0], first[1]);
                }
                shape.closePath();
            }
        }

        // Fallback rectangle if shape has no curves
        if (shape.curves.length === 0) {
            shape.moveTo(0, 0);
            shape.lineTo(100, 0);
            shape.lineTo(100, 100);
            shape.lineTo(0, 100);
            shape.closePath();
        }

        return new THREE.ShapeGeometry(shape, 64);
    } catch (err) {
        // Hard fallback
        const s = new THREE.Shape();
        s.moveTo(0, 0);
        s.lineTo(100, 0);
        s.lineTo(100, 100);
        s.lineTo(0, 100);
        s.closePath();
        return new THREE.ShapeGeometry(s, 64);
    }
}

// Renders white mask geometry for MaskedLayer's mask scene.
// If no masks, renders a full-rect white plane as fallback.
export default function LayerMask({ width, height, clip, time }) {
    const masks = clip?.masks || [];

    function getAnimatedPath(mask) {
        // Prefer property-based mask path if present (includes easing)
        const prop = clip?.properties?.["Mask Path"];
        if (prop?.keyframes && prop.keyframes.length > 0) {
            try {
                return getValueAtTime(prop, time);
            } catch (_) {
                // fallthrough to other options
            }
        }

        // Fallback: mask.keyframes.maskPath without easing → wrap as linear
        const keyframes = mask?.keyframes?.maskPath;
        if (keyframes && keyframes.length > 0) {
            const linearTrack = {
                keyframes: keyframes.map((kf) => ({
                    time: kf.time,
                    value: kf.value,
                    easing: {
                        inType: "LINEAR",
                        outType: "LINEAR",
                        inEase: { speed: 0, influence: 16.666666667 },
                        outEase: { speed: 0, influence: 16.666666667 },
                    },
                })),
            };
            try {
                return getValueAtTime(linearTrack, time);
            } catch (_) {
                // fallthrough
            }
        }

        // Static path
        return mask?.maskPath || null;
    }

    const maskMeshes = useMemo(() => {
        if (!masks || masks.length === 0) return null;

        return masks.map((mask, idx) => {
            const pathData = getAnimatedPath(mask);
            if (!pathData) return null;

            const geometry = buildShapeGeometryFromPath(pathData);

            // The path coordinates are already in pixel space relative to comp
            // Draw as filled white shape for alpha/luma mask usage
            return (
                <mesh key={idx} geometry={geometry}>
                    {/* <meshBasicMaterial color="white" side={THREE.DoubleSide} /> */}
                    <meshBasicMaterial color="white" transparent opacity={1} toneMapped={false} side={THREE.DoubleSide} />
                </mesh>
            );
        });
    }, [masks, time]);

    if (maskMeshes && maskMeshes.some(Boolean)) {
        return <group>{maskMeshes}</group>;
    }

    // Fallback: full comp white rect
    return (
        <mesh position={[width / 2, height / 2, 0]}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial color="white" side={THREE.DoubleSide} />
        </mesh>
    );
}
