import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useTimerStore } from "@/stores/timerStore";
import AssetList from "@/components/Editor/AssetList";
import SelectedAsset from "@/components/Editor/SelectedAsset";
import ClipList from "@/components/Editor/ClipList";
import Inspector from "@/components/Editor/Inspector";
import TimerControls from "@/components/Editor/TimerControls";
import Viewer from "@/components/Editor/Viewer";
import JsonView from "@/components/Editor/JsonView";
import { loadProjectData } from "@/lib/project-utils.js";

export default function EditorPage() {
    const { projectId } = useParams();
    const storeData = useProjectStore();
    const { setTime } = useTimerStore();
    const { setViewerZoom } = useEditorStore();

    useEffect(() => {
        window.setTime = setTime;
        setViewerZoom(1);
        async function loadProject() {
            try {
                useEditorStore.getState().setProjectId(projectId);
                const projectData = await loadProjectData(projectId);
                useProjectStore.setState(projectData);

                // Set the timer's maxTime based on the active composition duration
                const maxTime = useProjectStore.getState().getActiveCompMaxTime();
                useTimerStore.getState().setMaxTime(maxTime);
            } catch (error) {
                console.error("Error loading project:", error);
            }
        }

        loadProject();
    }, [projectId]);

    return (
        <div className="flex h-full">
            <Viewer />
        </div>
    );
}
