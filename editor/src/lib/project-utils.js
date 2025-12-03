import { v4 as uuidv4 } from "uuid";
import { FILE_API_ENDPOINTS } from "./constants";

/**
 * Creates a single track if it doesn't exist
 */
export const ensureTrack = (tracks, trackId, layerType, compositionId) => {
    const trackType = layerType === "audio" ? "audio" : "video";

    // Check if track already exists
    if (tracks[trackId]) return tracks;

    // Determine track order by looking at existing tracks of the same type
    const existingTracks = Object.values(tracks).filter((track) => track.type === trackType);
    const maxOrder = existingTracks.length > 0 ? Math.max(...existingTracks.map((t) => t.trackOrder || 0)) : 0;

    const newTrack = {
        id: trackId,
        type: trackType,
        trackOrder: maxOrder + 1,
        trackType: trackType === "video" ? "2dTrack" : "AudioTrack",
        compositionId: compositionId,
    };

    return {
        ...tracks,
        [trackId]: newTrack,
    };
};

/**
 * Creates tracks from clips if they don't exist (OPTIMIZED)
 */
export const ensureTracksFromClips = (clips, tracks) => {
    // Check if clips already have trackIds
    const clipValues = Object.values(clips);
    const clipsHaveTrackIds = clipValues.some((clip) => clip.trackId);

    // If tracks already exist AND clips have trackIds, don't recreate them
    if (Object.keys(tracks).length > 0 && clipsHaveTrackIds) {
        console.log("Tracks and trackIds already exist, skipping creation");
        return { clips, tracks };
    }

    console.log("Creating tracks from clips. Existing tracks:", Object.keys(tracks).length, "Clips have trackIds:", clipsHaveTrackIds);

    const newTracks = {};
    const newClips = {};

    // Single pass: group, sort, and create tracks
    const audioClips = [];
    const videoClips = [];

    // Group clips by type in single pass
    clipValues.forEach((clip) => {
        if (clip.layerType === "audio") {
            audioClips.push(clip);
        } else {
            videoClips.push(clip);
        }
    });

    // Sort once
    audioClips.sort((a, b) => (a.index || 0) - (b.index || 0));
    videoClips.sort((a, b) => (a.index || 0) - (b.index || 0));

    // Process audio clips with direct index mapping
    audioClips.forEach((clip, idx) => {
        const trackOrder = idx + 1;
        const trackId = uuidv4();

        newTracks[trackId] = {
            id: trackId,
            type: "audio",
            trackOrder,
            trackType: "AudioTrack",
            compositionId: clip.parentId,
        };

        newClips[clip.id] = {
            ...clip,
            trackId,
            trackOrder,
        };
    });

    // Process video clips with direct index mapping
    videoClips.forEach((clip, idx) => {
        const trackOrder = idx + 1;
        const trackId = uuidv4();
        const trackType = clip.isThreeD ? "3dTrack" : "2dTrack";

        newTracks[trackId] = {
            id: trackId,
            type: "video",
            trackOrder,
            trackType,
            compositionId: clip.parentId,
        };

        newClips[clip.id] = {
            ...clip,
            trackId,
            trackOrder,
        };
    });

    console.log("Created", Object.keys(newTracks).length, "tracks from clips");

    return {
        clips: newClips,
        tracks: newTracks,
    };
};

/**
 * Loads project data from a URL and processes it for the timeline (OPTIMIZED)
 */
export const loadProjectData = async (projectId) => {
    try {
        // const projectUrl = `${FILE_API_ENDPOINTS.DOWNLOAD}/${projectId}/project.json`;
        const projectUrl = "/project.json";
        const response = await fetch(projectUrl);
        if (!response.ok) {
            throw new Error("Failed to load project.json");
        } else {
            console.log("Project loaded successfully");
        }

        const projectData = await response.json();

        // Optimize relative properties addition
        if (projectData.clips) {
            // Pre-create property templates to avoid repeated object creation
            const createRelativeProperty = (name, defaultValue) => ({
                name,
                value: defaultValue,
                keyframes: [],
            });

            const relativePropertyTemplates = {
                "Relative X Position": () => createRelativeProperty("Relative X Position", 0),
                "Relative Y Position": () => createRelativeProperty("Relative Y Position", 0),
                "Relative Z Position": () => createRelativeProperty("Relative Z Position", 0),
                "Relative X Rotation": () => createRelativeProperty("Relative X Rotation", 0),
                "Relative Y Rotation": () => createRelativeProperty("Relative Y Rotation", 0),
                "Relative Z Rotation": () => createRelativeProperty("Relative Z Rotation", 0),
                "Relative X Scale": () => createRelativeProperty("Relative X Scale", 100),
                "Relative Y Scale": () => createRelativeProperty("Relative Y Scale", 100),
                "Relative Z Scale": () => createRelativeProperty("Relative Z Scale", 100),
            };

            // Single pass through clips
            Object.values(projectData.clips).forEach((clip) => {
                if (clip.properties) {
                    // Add missing properties in batch
                    Object.entries(relativePropertyTemplates).forEach(([propName, template]) => {
                        if (!clip.properties[propName]) {
                            clip.properties[propName] = template();
                        }
                    });
                }
            });
        }

        // Find active composition (more efficient)
        const firstComp = projectData.assets ? Object.values(projectData.assets).find((asset) => asset.type === "composition") : null;

        // Ensure tracks exist (create from clips if they don't)
        const { clips, tracks } = ensureTracksFromClips(projectData.clips || {}, projectData.tracks || {});

        return {
            ...projectData,
            clips,
            tracks,
            activeCompId: firstComp?.id,
        };
    } catch (error) {
        console.error("Error loading project data:", error);
        throw error;
    }
};
