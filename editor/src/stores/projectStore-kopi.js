import { create } from "zustand";
// import { supabase } from "../lib/supabaseClient";
import { createAssets } from "../lib/project-utils";
import { FILE_API_ENDPOINTS } from "../lib/constants";

const initialState = {
    editableFields: {},
    projectName: "",
    assets: {},
    clips: {},
    tracks: {},
};

export const useProjectStore = create((set, get) => ({
    // Properties
    editableFields: initialState.editableFields,
    projectId: initialState.projectId,
    projectName: initialState.projectName,
    assets: initialState.assets,
    clips: initialState.clips,

    // Functions
    loadProject: async (projectId, setProjectId, setActiveCompId, setMaxTime) => {
        try {
            const projectUrl = `${FILE_API_ENDPOINTS.DOWNLOAD}/${projectId}/project.json`;
            const response = await fetch(projectUrl);
            if (!response.ok) {
                throw new Error("Failed to load project.json");
            } else {
                console.log("Project loaded successfully");
            }

            const projectData = await response.json();

            // Set projectId in editorStore
            setProjectId(projectId);

            // Add missing relative properties to each clip
            const relativeProperties = [
                "Relative X Position",
                "Relative Y Position",
                "Relative Z Position",
                "Relative X Rotation",
                "Relative Y Rotation",
                "Relative Z Rotation",
                "Relative X Scale",
                "Relative Y Scale",
                "Relative Z Scale",
            ];

            if (projectData.clips) {
                Object.keys(projectData.clips).forEach((clipId) => {
                    const clip = projectData.clips[clipId];
                    if (clip.properties) {
                        relativeProperties.forEach((propName) => {
                            if (!clip.properties[propName]) {
                                // Scale properties should default to 100, others to 0
                                const defaultValue = propName.includes("Scale") ? 100 : 0;
                                clip.properties[propName] = {
                                    name: propName,
                                    value: defaultValue,
                                    keyframes: [],
                                };
                            }
                        });
                    }
                });
            }

            // Set the store state with the loaded data
            set(projectData);

            // Get max time from first composition if available
            const firstComp = Object.values(projectData.assets).find((asset) => asset.type === "composition");
            setActiveCompId(firstComp?.id);
            setMaxTime(firstComp?.duration || 4);

            return projectData;
        } catch (error) {
            console.error("Error loading project:", error);
            throw error;
        }
    },

    getStoreAsJson: () => {
        const { getActiveComp, setActiveComp, setSelectedClip, updateProject, getStoreAsJson, syncToDatabase, ...state } = get();
        return JSON.stringify(state, null, 2);
    },

    removeEditableField: (path) => {
        const { editableFields } = get();
        const pathKey = Array.isArray(path) ? path.join(".") : path;
        const newFields = { ...editableFields };
        delete newFields[pathKey];

        set({ editableFields: newFields });
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

    // Asset functions
    setAssets: (assets) => {
        set({ assets });
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

    // Clip functions
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

    updateProject: (newProjectData) => {
        if (!newProjectData || !Array.isArray(newProjectData.items)) {
            console.error("Invalid project data format");
            return;
        }
        const newClips = {};
        newProjectData.items.forEach((item) => {
            if (item.type === "composition" && item.layers) {
                item.layers.forEach((layer, index) => {
                    const clipId = `${item.id}_${index}`;
                    const { layerName, threeDLayer, properties, ...rest } = layer;
                    const propsObject = properties.reduce((acc, prop) => {
                        acc[prop.name] = prop;
                        return acc;
                    }, {});

                    newClips[clipId] = {
                        ...rest,
                        id: clipId,
                        parentId: item.id,
                        clipName: layerName,
                        isThreeD: threeDLayer,
                        properties: propsObject,
                    };
                });
            }
        });

        set(
            {
                projectName: newProjectData.name,
                assets: createAssets(newProjectData.items),
                clips: newClips,
                activeCompId: newProjectData.activeComp,
            },
            false
        );
    },
}));
