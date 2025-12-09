import { create } from "zustand";

const initialState = {
    editableFields: {},
    projectName: "",
    assets: {},
    clips: {},
    tracks: {}, // New tracks object with unique IDs
};

export const useProjectStore = create((set, get) => ({
    // Properties
    editableFields: initialState.editableFields,
    projectName: initialState.projectName,
    assets: initialState.assets,
    clips: initialState.clips,
    tracks: initialState.tracks,
    activeCompId: null,

    // Functions
    removeEditableField: (path) => {
        const { editableFields } = get();
        const pathKey = Array.isArray(path) ? path.join(".") : path;
        const newFields = { ...editableFields };
        delete newFields[pathKey];

        set({ editableFields: newFields });
    },

    // Update multiple editable fields by their titles
    // Usage: updateByTitles({ "headline": "new text", "subtitle": "new subtitle" })
    updateByTitles: (updates) => {
        const { editableFields, setValue } = get();

        const results = { success: [], failed: [] };

        Object.entries(updates).forEach(([title, newValue]) => {
            const field = Object.values(editableFields).find((f) => f.title === title);
            if (field) {
                setValue(field.path, newValue);
                results.success.push(title);
            } else {
                console.warn(`No editable field found with title: ${title}`);
                results.failed.push(title);
            }
        });

        return results;
    },
    setEditableField: (path, title, type) => {
        const { editableFields } = get();
        const pathKey = Array.isArray(path) ? path.join(".") : path;
        const newField = { path: Array.isArray(path) ? path : pathKey.split("."), title, type };

        set({
            editableFields: {
                ...editableFields,
                [pathKey]: newField,
            },
        });
    },

    setAssets: (assets) => {
        set({ assets });
    },

    setActiveCompId: (compId) => {
        set({ activeCompId: compId });
    },

    getStoreAsJson: () => {
        const { getStoreAsJson, ...state } = get();

        return JSON.stringify(state, null, 2);
    },

    updateKeyframe: (clipId, propertyName, keyframeIndex, newValue) => {
        const { clips } = get();
        const clip = clips[clipId];
        if (!clip || !clip.properties[propertyName]) return;

        const property = clip.properties[propertyName];
        if (!property.keyframes || keyframeIndex >= property.keyframes.length) return;

        const newClips = { ...clips };
        newClips[clipId] = {
            ...clip,
            properties: {
                ...clip.properties,
                [propertyName]: {
                    ...property,
                    keyframes: property.keyframes.map((kf, i) => (i === keyframeIndex ? { ...kf, value: newValue } : kf)),
                },
            },
        };

        set({ clips: newClips });
    },

    updatePropertyValue: (clipId, propertyName, updates) => {
        console.log("Updating property value", clipId, propertyName, updates);
        const { clips } = get();
        const clip = clips[clipId];
        if (!clip || !clip.properties[propertyName]) return;
        console.log("Clip", clip);
        const newClips = { ...clips };
        newClips[clipId] = {
            ...clip,
            properties: {
                ...clip.properties,
                [propertyName]: {
                    ...clip.properties[propertyName],
                    ...updates,
                },
            },
        };

        set({ clips: newClips });
    },

    updateTextValue: (clipId, textValue) => {
        const { clips } = get();
        const clip = clips[clipId];
        if (!clip || !clip.text) return;
        const newClips = { ...clips };
        newClips[clipId] = { ...clip, text: { ...clip.text, sourceText: textValue } };
        set({ clips: newClips });
    },

    updateAssetFile: async (assetId, fileData) => {
        const { assets } = get();
        const updatedAssets = { ...assets };

        updatedAssets[assetId] = {
            ...assets[assetId],
            name: fileData.name,
            width: fileData.width || assets[assetId].width,
            height: fileData.height || assets[assetId].height,
            url: fileData.url,
        };

        set({ assets: updatedAssets }, false);
    },

    setValue: (path, newValue) => {
        const state = get();
        let current = state;

        // Navigate to the parent of the target property
        for (let i = 0; i < path.length - 1; i++) {
            if (current[path[i]] === undefined) {
                console.error(`Invalid path at ${path[i]}`);
                return;
            }
            current = current[path[i]];
        }

        // Update the value
        const lastKey = path[path.length - 1];
        current[lastKey] = newValue;

        // Update the store
        set(state, false);
    },

    updateClip: (clipId, updatedClip) => {
        const { clips } = get();
        set({
            clips: {
                ...clips,
                [clipId]: updatedClip,
            },
        });
    },

    getClipsArray: () => {
        const { clips } = get();
        return Object.values(clips);
    },

    getActiveCompMaxTime: () => {
        const { assets, activeCompId } = get();
        if (!activeCompId || !assets[activeCompId]) return 4; // default fallback
        const activeComp = assets[activeCompId];
        return activeComp.duration || 4;
    },

    getActiveCompFrameRate: () => {
        const { assets, activeCompId } = get();
        if (!activeCompId || !assets[activeCompId]) return 25; // default fallback
        const activeComp = assets[activeCompId];
        return activeComp.frameRate || 25;
    },

    // Track management functions
    createTrack: (trackType, trackOrder, compositionId) => {
        const { tracks } = get();
        const trackId = crypto.randomUUID();
        const newTrack = {
            id: trackId,
            type: trackType, // 'video' or 'audio'
            trackOrder: trackOrder,
            trackType: trackType === "video" ? "2dTrack" : "AudioTrack", // can be updated later
            compositionId: compositionId, // Store the composition ID this track belongs to
        };

        set({
            tracks: {
                ...tracks,
                [trackId]: newTrack,
            },
        });

        return trackId;
    },

    getTracksByType: (trackType) => {
        const { tracks } = get();
        return Object.values(tracks)
            .filter((track) => track.type === trackType)
            .sort((a, b) => a.trackOrder - b.trackOrder);
    },

    getTracksByCompositionAndType: (compositionId, trackType) => {
        const { tracks } = get();
        return Object.values(tracks)
            .filter((track) => track.compositionId === compositionId && track.type === trackType)
            .sort((a, b) => a.trackOrder - b.trackOrder);
    },

    updateTrackOrder: (trackId, newOrder) => {
        const { tracks } = get();
        if (!tracks[trackId]) return;

        set({
            tracks: {
                ...tracks,
                [trackId]: {
                    ...tracks[trackId],
                    trackOrder: newOrder,
                },
            },
        });
    },

    getCompTracks: (compId) => {
        const { tracks } = get();
        return Object.values(tracks)
            .filter((track) => track.compositionId === compId)
            .sort((a, b) => {
                // Sort by type first (video tracks before audio tracks), then by trackOrder
                if (a.type !== b.type) {
                    return a.type === "video" ? -1 : 1;
                }
                return (a.trackOrder || 0) - (b.trackOrder || 0);
            });
    },
}));
