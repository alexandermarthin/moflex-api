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
// import TestComponent from "editor-timeline/src/components/TestComponent";
import { loadProjectData } from "@/lib/project-utils.js";

export default function EditorPage() {
    const { projectId } = useParams();
    const storeData = useProjectStore();

    useEffect(() => {
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
        <div className="flex flex-col h-[calc(100vh)]">
            {/* <div className="border p-2">
                <TestComponent />
            </div> */}
            <div className="flex flex-1">
                <div className="flex flex-col w-3/5">
                    <div className="h-1/2">
                        <div className="flex h-full">
                            <div className="w-1/5">
                                <div className="flex flex-col h-full">
                                    <div className="h-32 border">
                                        <SelectedAsset />
                                    </div>
                                    <div className="h-full border overflow-y-auto">
                                        <AssetList />
                                    </div>
                                </div>
                            </div>
                            <div className="w-4/5">
                                <div className="flex flex-col h-full">
                                    <div className="flex h-full border items-center justify-center overflow-hidden">
                                        <Viewer />
                                    </div>
                                    <div className="border h-12">
                                        <TimerControls />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="h-1/2 border">
                        <ClipList />
                    </div>
                </div>
                <div className="flex flex-col w-1/5">
                    <Inspector />
                </div>
                <div className=" w-1/5 border">
                    <JsonView jsonState={storeData} />
                </div>
            </div>
        </div>
    );
}
