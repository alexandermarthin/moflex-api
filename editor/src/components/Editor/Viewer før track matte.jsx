import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import SolidLayer from "./Layers/SolidLayer";
import ImageLayer from "./Layers/ImageLayer";
import TextLayer from "./Layers/TextLayer";
import VideoLayer from "./Layers/VideoLayer";
import AudioLayer from "./Layers/AudioLayer";
import ShapeLayer from "./Layers/ShapeLayer";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useTimerStore } from "@/stores/timerStore";

const ThreeDScene = ({ width, height, assets, clips, updatePropertyValue, setSelectedClipId, selectedClipId, time, projectId }) => {
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
            {Object.entries(clips)
                .reverse()
                .map(([id, clip]) => {
                    if (clip.inPoint <= time) {
                        const parentClip = clip.parentLayerId ? clips[clip.parentLayerId] : null;
                        if (clip.layerType === "solid") {
                            return (
                                <SolidLayer
                                    key={id}
                                    id={id}
                                    clip={clip}
                                    solidItem={assets[clip.sourceId]}
                                    updatePropertyValue={updatePropertyValue}
                                    setSelectedClipId={setSelectedClipId}
                                    selectedClipId={selectedClipId}
                                    time={time}
                                    parentClip={parentClip}
                                />
                            );
                        } else if (clip.layerType === "image") {
                            return (
                                <ImageLayer
                                    key={id}
                                    id={id}
                                    clip={clip}
                                    asset={assets[clip.sourceId]}
                                    updatePropertyValue={updatePropertyValue}
                                    setSelectedClipId={setSelectedClipId}
                                    selectedClipId={selectedClipId}
                                    time={time}
                                    parentClip={parentClip}
                                    projectId={projectId}
                                />
                            );
                        } else if (clip.layerType === "video") {
                            return (
                                <VideoLayer
                                    key={id}
                                    id={id}
                                    clip={clip}
                                    asset={assets[clip.sourceId]}
                                    updatePropertyValue={updatePropertyValue}
                                    setSelectedClipId={setSelectedClipId}
                                    selectedClipId={selectedClipId}
                                    time={time}
                                    parentClip={parentClip}
                                    projectId={projectId}
                                />
                            );
                        } else if (clip.layerType === "text") {
                            return (
                                <TextLayer
                                    key={id}
                                    id={id}
                                    clip={clip}
                                    updatePropertyValue={updatePropertyValue}
                                    setSelectedClipId={setSelectedClipId}
                                    selectedClipId={selectedClipId}
                                    time={time}
                                    parentClip={parentClip}
                                />
                            );
                        } else if (clip.layerType === "audio") {
                            return <AudioLayer key={id} clip={clip} asset={assets[clip.sourceId]} time={time} projectId={projectId} />;
                        } else if (clip.layerType === "shape") {
                            return (
                                <ShapeLayer
                                    key={id}
                                    id={id}
                                    clip={clip}
                                    updatePropertyValue={updatePropertyValue}
                                    setSelectedClipId={setSelectedClipId}
                                    selectedClipId={selectedClipId}
                                    time={time}
                                    parentClip={parentClip}
                                />
                            );
                        }
                    }
                    return null;
                })}
        </>
    );
};

export default function Viewer() {
    const { activeCompId } = useEditorStore();
    const { viewerZoom } = useEditorStore();
    const { time } = useTimerStore();

    const { assets, clips, updatePropertyValue } = useProjectStore();
    const comp = assets[activeCompId];
    const { setSelectedClipId, selectedClipId, projectId } = useEditorStore();

    const { width = 1920, height = 1080 } = comp || {};

    return (
        <>
            <div>
                <div style={{ width: width * viewerZoom, height: height * viewerZoom }}>
                    <Canvas flat={true}>
                        {(() => {
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
