import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import Position from "./SubComponents/Position";



export default function SolidInspector() {
  const { clips } = useProjectStore();
  const { selectedClipId } = useEditorStore();
  const selectedClip = clips[selectedClipId];
  const isThreeD = selectedClip.isThreeD;

  return (
    <div>

      <Position label="X Pos" property="Relative X Position" />
      <Position label="Y Pos" property="Relative Y Position" />
      {isThreeD && <Position label="Z Pos" property="Relative Z Position" />}
    </div>
  );
}
