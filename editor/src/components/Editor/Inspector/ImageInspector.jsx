import Position from "./SubComponents/Position";
import { useProjectStore } from "@/stores/projectStore";
import FileUpload from "./SubComponents/FileUpload";
import { useEditorStore } from "@/stores/editorStore";

export default function ImageInspector() {
    const { assets, clips } = useProjectStore();
    const { selectedClipId } = useEditorStore();

    const clip = clips[selectedClipId];
    const asset = assets[clip.sourceId];

    const isThreeD = clip.isThreeD;

    return (
        <div>

            <Position label="X Pos" property="Relative X Position" />
            <Position label="Y Pos" property="Relative Y Position" />
            {isThreeD && <Position label="Z Pos" property="Relative Z Position" />}
            <FileUpload assetId={asset.id} />
        </div>
    );
}
