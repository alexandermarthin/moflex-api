import React, { useEffect, useState } from "react";

import { useProjectStore } from "@/stores/projectStore";
import { useTimerStore } from "@/stores/timerStore";
import { useEditorStore } from "@/stores/editorStore";
import Viewer from "@/components/Editor/Viewer";

export default function EditorPage() {
    const getStoreAsJson = useProjectStore((state) => state.getStoreAsJson);
    const { setValue } = useProjectStore();
    const { setMaxTime, startTimer, setTime } = useTimerStore();
    const [jsonState, setJsonState] = useState("");
    const { setViewerZoom } = useEditorStore();

    const textpath = ["clips", "2_0", "text", "sourceText"];

    useEffect(() => {
        window.setTime = setTime;
        setViewerZoom(1);
        async function loadProject() {
            try {
                const response = await fetch("/project.json");
                if (!response.ok) {
                    throw new Error("Failed to load project.json");
                } else {
                    console.log("Project loaded successfully");
                }

                const projectData = await response.json();

                // Set the store state with the loaded data
                useProjectStore.setState(projectData);
                setJsonState(getStoreAsJson());

                // Get max time from first composition if available
                const firstComp = Object.values(projectData.assets).find((asset) => asset.type === "composition");
                setMaxTime(firstComp?.duration || 4);
                setValue(textpath, "Hello");
            } catch (error) {
                console.error("Error loading project:", error);
            }
        }

        loadProject();
    }, []);

    return (
        <div className="flex h-full">
            <Viewer />
        </div>
    );
}
