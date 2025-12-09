import { getValueAtTime } from "@/lib/anim-utils";

export function getTransform(clip, time) {
    const props = clip.properties;

    const keyframeOrValue = (name) => {
        return props[name]?.keyframes?.length > 0
            ? getValueAtTime(props[name], time)
            : props[name]?.value;
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
