import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";

export default function ClipList() {
    const { clips, activeCompId } = useProjectStore();
    const { selectedClipId, setSelectedClipId } = useEditorStore();

    const activeClips = Object.values(clips).filter((clip) => clip.parentId === activeCompId);

    if (!activeClips.length) return null;

    return (
        <div className="w-64 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-3">Clips</h2>
            <div className="space-y-2">
                {activeClips.map((clip) => (
                    <div
                        key={clip.id}
                        className={`p-2 bg-white rounded cursor-pointer hover:bg-gray-50 ${clip.id === selectedClipId ? "ring-2 ring-blue-500" : ""}`}
                        onClick={() => setSelectedClipId(clip.id)}
                    >
                        <div className="font-medium">{clip.clipName}</div>
                        <div className="text-sm text-gray-500">
                            {clip.inPoint}s - {clip.outPoint}s
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
