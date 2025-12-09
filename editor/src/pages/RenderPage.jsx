import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useTimerStore } from "@/stores/timerStore";
import Viewer from "@/components/Editor/Viewer";

import { loadProjectData } from "@/lib/project-utils.js";

export default function EditorPage() {
    const { projectId } = useParams();
    const [searchParams] = useSearchParams();
    const { updateByTitles } = useProjectStore();
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

                // Get max time from first composition if available
                // const firstComp = Object.values(projectData.assets).find((asset) => asset.type === "composition");
                // setMaxTime(firstComp?.duration || 4);
                // console.log("textpath", textpath);

                //Set the timer's maxTime based on the active composition duration
                const maxTime = useProjectStore.getState().getActiveCompMaxTime();
                useTimerStore.getState().setMaxTime(maxTime);
                window.maxTime = maxTime;

                // Apply data from URL query params if present
                const dataParam = searchParams.get("data");
                if (dataParam) {
                    try {
                        const data = JSON.parse(atob(dataParam));
                        updateByTitles(data);
                    } catch (e) {
                        console.error("Failed to parse data param:", e);
                    }
                }
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
