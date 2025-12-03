import Position from "./SubComponents/Position";
import Text from "./SubComponents/Text";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";

export default function TextInspector() {
    const { clips } = useProjectStore();
    const { selectedClipId } = useEditorStore();
    const selectedClip = clips[selectedClipId];
    const isThreeD = selectedClip.isThreeD;

    return (
        <div>
            <Position label="X Pos" property="Relative X Position" />
            <Position label="Y Pos" property="Relative Y Position" />
            {isThreeD && <Position label="Z Pos" property="Relative Z Position" />}
            <Text />
        </div>
    );
}
