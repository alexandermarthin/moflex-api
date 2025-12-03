import { create } from "zustand";

export const useEditorStore = create((set, get) => ({
    selectedClipId: null,
    viewerZoom: 0.5,
    projectId: null,
    trackHeight: 32,
    setViewerZoom: (zoom) => set({ viewerZoom: zoom }),

    setProjectId: (id) => set({ projectId: id }),

    setTrackHeight: (height) => set({ trackHeight: height }),

    setSelectedClipId: (clipId) => {
        set({ selectedClipId: clipId });
    },
}));
