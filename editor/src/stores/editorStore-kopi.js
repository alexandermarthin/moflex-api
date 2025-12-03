import { create } from "zustand";

export const useEditorStore = create((set, get) => ({
    projectId: null,
    activeCompId: null,
    selectedClipId: null,
    viewerZoom: 0.25,

    setProjectId: (id) => set({ projectId: id }),

    setActiveCompId: (compId) => {
        set({ activeCompId: compId });
    },

    setSelectedClipId: (clipId) => {
        set({ selectedClipId: clipId });
    },

    setViewerZoom: (zoom) => set({ viewerZoom: zoom }),
}));
