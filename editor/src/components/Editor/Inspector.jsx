import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import SolidInspector from "./Inspector/SolidInspector";
import ImageInspector from "./Inspector/ImageInspector";
import VideoInspector from "./Inspector/VideoInspector";
import TextInspector from "./Inspector/TextInspector";
import AudioInspector from "./Inspector/AudioInspector";
import ShapeInspector from "./Inspector/ShapeInspector";
export default function Inspector() {
    const { clips } = useProjectStore();
    const { selectedClipId } = useEditorStore();
    const selectedClip = clips[selectedClipId];

    if (!selectedClip) return null;

    return (
        <div className="p-2">
            <h2 className="text-lg font-semibold">Inspector</h2>

            <div className="space-y-2">
                <p>Clip: {selectedClip.clipName}</p>
                <p>{selectedClip.layerType}</p>
                <div>
                    {selectedClip.layerType === "solid" && <SolidInspector />}
                    {selectedClip.layerType === "image" && <ImageInspector />}
                    {selectedClip.layerType === "video" && <VideoInspector />}
                    {selectedClip.layerType === "audio" && <AudioInspector />}
                    {selectedClip.layerType === "text" && <TextInspector />}
                    {selectedClip.layerType === "shape" && <ShapeInspector />}
                </div>
            </div>
        </div>
    );
}
