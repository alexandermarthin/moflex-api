import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";

export default function SelectedAsset() {
  const { activeCompId } = useEditorStore();
  const { assets } = useProjectStore();
  const activeComp = assets[activeCompId];

  if (!activeComp) return null;

  return (
    <div className="text-xs p-2">


      <p>
        ID: {activeComp.id}
      </p>
      <p>
        Name: {activeComp.name}
      </p>
      <p>
        Type: {activeComp.type}
      </p>
      {activeComp.width && (
        <p>
          Size: {activeComp.width}x
          {activeComp.height}
        </p>
      )}
      {activeComp.duration && (
        <p>
          Duration: {activeComp.duration}
          s
        </p>
      )}
      {activeComp.frameRate && (
        <p>
          Frame Rate: {activeComp.frameRate}fps
        </p>
      )}

    </div>
  );
}
