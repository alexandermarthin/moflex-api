import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { useMemo, createRef } from "react";
import SolidLayer from "./Layers/SolidLayer";
import ImageLayer from "./Layers/ImageLayer";
import TextLayer from "./Layers/TextLayer";
import VideoLayer from "./Layers/VideoLayer";
import AudioLayer from "./Layers/AudioLayer";
import ShapeLayer from "./Layers/ShapeLayer";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useTimerStore } from "@/stores/timerStore";
import TrackMatteLayer from "./Layers/TrackMatteLayer";
import Compositor2D from "./Compositor2D";

const ThreeDScene = ({ width, height, assets, clips, updatePropertyValue, setSelectedClipId, selectedClipId, time, projectId }) => {
    const scene = useThree((s) => s.scene);
    const r3fCamera = useThree((s) => s.camera);

    // Stable refs per layer id for compositor visibility toggling
    const layerRefs = useMemo(() => ({}), []);
    const getLayerRef = (id) => {
        if (!layerRefs[id]) layerRefs[id] = createRef();
        return layerRefs[id];
    };
    const renderClipEl = (id, clip) => {
        const parentClip = clip.parentLayerId ? clips[clip.parentLayerId] : null;
        // Pass clips for recursive parent chain resolution (supports multiple parent levels)
        const common = { id, clip, updatePropertyValue, setSelectedClipId, selectedClipId, time, parentClip, projectId, compWidth: width, compHeight: height, clips };
        switch (clip.layerType) {
            case "solid":
                return <SolidLayer key={id} {...common} solidItem={assets[clip.sourceId]} />;
            case "image":
                return <ImageLayer key={id} {...common} asset={assets[clip.sourceId]} />;
            case "video":
                return <VideoLayer key={id} {...common} asset={assets[clip.sourceId]} />;
            case "text":
                return <TextLayer key={id} {...common} />;
            case "shape":
                return <ShapeLayer key={id} {...common} />;
            case "audio":
                return <AudioLayer key={id} clip={clip} asset={assets[clip.sourceId]} time={time} projectId={projectId} />;
            default:
                return null;
        }
    };
    return (
        <>
            <PerspectiveCamera
                makeDefault
                near={0.1}
                far={10000}
                fov={40}
                aspect={width / height}
                position={[width / 2, height / 2, -2666.6667]}
                rotation={[Math.PI, 0, 0]}
                onUpdate={(cam) => {
                    cam.filmGauge = 36;
                    cam.setFocalLength(50);
                    cam.updateProjectionMatrix();
                }}
            />
            <ambientLight intensity={1} />
            <pointLight position={[10, 10, 10]} />

            {(() => {
                const orderedEntries = Object.entries(clips).reverse(); // bottom -> top
                const consumed = new Set();

                // Build children and orderedLayers array in one pass
                const children = [];
                const orderedLayers = [];

                let current3DGroup = [];

                const flush3DGroup = () => {
                    if (current3DGroup.length === 0) return;
                    // Add children for all items in the 3D group
                    const memberRefs = [];
                    for (const item of current3DGroup) {
                        const ref = getLayerRef(item.id);
                        memberRefs.push(ref);
                        children.push(
                            <group key={`grp-${item.id}`} ref={ref}>
                                {item.element}
                            </group>
                        );
                    }
                    const gid = `grp3d-${current3DGroup[0].id}-${current3DGroup[current3DGroup.length - 1].id}`;
                    // Composite the whole 3D stack as one layer (normal, opacity 1)
                    orderedLayers.push({ id: gid, memberRefs, opacity: 1.0, blendMode: "normal" });
                    current3DGroup = [];
                };

                for (const [id, clip] of orderedEntries) {
                    if (clip.inPoint > time || clip.outPoint <= time) continue;
                    if (clip.enabled === false) continue;
                    if (consumed.has(id)) continue;

                    const tm = clip.trackMatte; // { matteLayerId, mode }
                    let element = null;
                    if (tm?.matteLayerId && clips[tm.matteLayerId]) {
                        const matteClip = clips[tm.matteLayerId];
                        const contentEl = renderClipEl(id, clip);
                        const matteEl = renderClipEl(tm.matteLayerId, matteClip);
                        consumed.add(tm.matteLayerId);
                        const mode = tm.mode?.includes("luma") ? "luma" : "alpha";
                        const invert = tm.inverted || tm.mode?.includes("inverted") ? true : false;
                        element = (
                            <TrackMatteLayer key={`${id}-tm`} width={width} height={height} mode={mode} invert={invert} matte={matteEl}>
                                {contentEl}
                            </TrackMatteLayer>
                        );
                    } else {
                        element = renderClipEl(id, clip);
                    }

                    if (clip.isThreeD) {
                        // Accumulate into a 3D group
                        current3DGroup.push({ id, element });
                        continue;
                    }

                    // Non-3D: flush any pending 3D group, then add as a regular 2D layer
                    flush3DGroup();
                    const ref = getLayerRef(id);
                    children.push(
                        <group key={`grp-${id}`} ref={ref}>
                            {element}
                        </group>
                    );
                    orderedLayers.push({ id, groupRef: ref, opacity: 1.0, blendMode: (clip?.blendMode || "normal").toLowerCase(), effects: clip?.effects || [] });
                }

                // Flush trailing 3D group
                flush3DGroup();

                // Mount compositor once with orderedLayers
                children.push(<Compositor2D key="compositor" width={width} height={height} time={time} mainScene={scene} camera={r3fCamera} orderedLayers={orderedLayers} />);

                return children;
            })()}
        </>
    );
};

export default function Viewer() {
    const { viewerZoom } = useEditorStore();
    const { time } = useTimerStore();

    const { assets, clips, updatePropertyValue, activeCompId } = useProjectStore();
    const comp = assets[activeCompId];
    const { setSelectedClipId, selectedClipId, projectId } = useEditorStore();

    const { width = 1920, height = 1080 } = comp || {};

    return (
        <>
            <div>
                <div style={{ width: width * viewerZoom, height: height * viewerZoom }}>
                    <Canvas gl={{ outputColorSpace: THREE.SRGBColorSpace, alpha: true, premultipliedAlpha: false, antialias: true, preserveDrawingBuffer: true }} flat>
                        {!window.renderWithAlpha &&
                            (() => {
                                const bgColor = new THREE.Color(comp?.backgroundColor.red || 0, comp?.backgroundColor.green || 0, comp?.backgroundColor.blue || 0);
                                bgColor.convertSRGBToLinear();
                                return <color attach="background" args={[bgColor.r, bgColor.g, bgColor.b]} />;
                            })()}
                        <ThreeDScene
                            width={width}
                            height={height}
                            assets={assets}
                            clips={clips}
                            updatePropertyValue={updatePropertyValue}
                            setSelectedClipId={setSelectedClipId}
                            selectedClipId={selectedClipId}
                            time={time}
                            projectId={projectId}
                        />
                    </Canvas>
                </div>
            </div>
        </>
    );
}
