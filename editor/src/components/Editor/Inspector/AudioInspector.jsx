import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import FileUpload from "./SubComponents/FileUpload";

export default function AudioInspector() {
    const { assets, clips } = useProjectStore();
    const { selectedClipId } = useEditorStore();

    const clip = clips[selectedClipId];
    const asset = assets[clip.sourceId];

    return (
        <div>

            <FileUpload assetId={asset.id} />
        </div>
    );
}
