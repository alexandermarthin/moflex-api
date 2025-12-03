import { useEffect, useRef } from "react";
import { Howl } from "howler";

import { FILE_API_ENDPOINTS } from "@/lib/constants";

// Global cache for Howl instances to prevent reloading same audio files
const audioCache = new Map();

const AudioLayer = ({ clip, asset, time, projectId }) => {
    const soundRef = useRef(null);
    const isPlayingRef = useRef(false);
    const currentUrlRef = useRef(null);

    const audioUrl = `${FILE_API_ENDPOINTS.DOWNLOAD}/${projectId}/${asset?.url}`;

    // Initialize Howl instance once when URL changes
    useEffect(() => {
        if (!audioUrl) return;

        // If URL hasn't changed, don't recreate
        if (currentUrlRef.current === audioUrl && soundRef.current) {
            return;
        }

        // Check if we already have this audio cached
        if (audioCache.has(audioUrl)) {
            soundRef.current = audioCache.get(audioUrl);
            currentUrlRef.current = audioUrl;
            // console.log(`Audio retrieved from cache: ${asset?.name || audioUrl}`);
            return;
        }

        // Create new Howl instance
        const howl = new Howl({
            src: [audioUrl],
            preload: true,
            html5: false, // Force Web Audio API for better performance
            volume: 1.0,
            onload: () => {
                // console.log(`Audio loaded: ${asset?.name || audioUrl}`);
            },
            onloaderror: (id, error) => {
                console.error(`Audio load error: ${asset?.name || audioUrl}`, error);
                // Remove from cache on error
                audioCache.delete(audioUrl);
            },
        });

        // Cache the Howl instance
        audioCache.set(audioUrl, howl);
        soundRef.current = howl;
        currentUrlRef.current = audioUrl;

        return () => {
            // Don't unload here since we're caching - just clear references
            soundRef.current = null;
            currentUrlRef.current = null;
            isPlayingRef.current = false;
        };
    }, [audioUrl]); // Only depend on the URL string

    // Handle playback based on timeline position
    useEffect(() => {
        if (!soundRef.current || !clip || soundRef.current.state() !== "loaded") return;

        const isInTimeRange = time >= clip.inPoint && time <= (clip.outPoint || Infinity);
        const shouldBePlaying = isInTimeRange;

        if (shouldBePlaying && !isPlayingRef.current) {
            // Calculate seek position relative to clip start
            const seekTime = Math.max(0, time - clip.inPoint);
            const duration = soundRef.current.duration();

            // Only seek if within audio duration
            if (seekTime < duration) {
                // soundRef.current.seek(seekTime);
                soundRef.current.seek(0);
                soundRef.current.play();
                isPlayingRef.current = true;
            }
        } else if (!shouldBePlaying && isPlayingRef.current) {
            soundRef.current.pause();
            isPlayingRef.current = false;
        } else if (shouldBePlaying && isPlayingRef.current) {
            // Update seek position for timeline scrubbing
            const seekTime = Math.max(0, time - clip.inPoint);
            const duration = soundRef.current.duration();

            if (seekTime < duration) {
                const currentSeek = soundRef.current.seek();
                // Only update seek if we're off by more than a small threshold (avoid constant seeking)
                if (Math.abs(currentSeek - seekTime) > 0.1) {
                    soundRef.current.seek(seekTime);
                }
            }
        }
    }, [time, clip?.inPoint, clip?.outPoint]);

    return null;
};

export default AudioLayer;
