import { useCallback, useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { FILE_API_ENDPOINTS } from "@/lib/constants";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";

export default function FileUploadComponent({ assetId, mode = "image" }) {
    const { assets, updateAssetFile } = useProjectStore();
    const { projectId } = useEditorStore();
    const [uploadStatus, setUploadStatus] = useState("");
    const [currentFile, setCurrentFile] = useState();
    const isNewUpload = useRef(false);


    useEffect(() => {
        setCurrentFile(
            {
                name: assets[assetId].name,
                url: assets[assetId].url,
                width: assets[assetId].width || 0,
                height: assets[assetId].height || 0
            }
        )
    }, [assets[assetId]]);

    // Consistent styling for all states using inline styles
    const containerStyle = {
        width: '200px',
        height: '200px',
        border: '2px solid #d1d5db',
        borderRadius: '5px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px'
    };

    // Configure accepted file types based on mode
    const getAcceptedFiles = () => {
        switch (mode) {
            case 'image':
                return {
                    'image/jpeg': ['.jpg', '.jpeg'],
                    'image/png': ['.png']
                };
            case 'video':
                return {
                    'video/mp4': ['.mp4']
                };
            case 'audio':
                return {
                    'audio/mpeg': ['.mp3'],
                    'audio/wav': ['.wav']
                };
            default:
                return {
                    'image/jpeg': ['.jpg', '.jpeg'],
                    'image/png': ['.png']
                };
        }
    };

    // Get user-friendly text based on mode
    const getDropzoneText = () => {
        switch (mode) {
            case 'image':
                return 'Drag \'n\' drop an image here, or click to select (JPG, PNG)';
            case 'video':
                return 'Drag \'n\' drop a video here, or click to select (MP4)';
            case 'audio':
                return 'Drag \'n\' drop an audio file here, or click to select (MP3, WAV)';
            default:
                return 'Drag \'n\' drop an image here, or click to select (JPG, PNG)';
        }
    };

    const getDropActiveText = () => {
        switch (mode) {
            case 'image':
                return 'Drop the image here...';
            case 'video':
                return 'Drop the video here...';
            case 'audio':
                return 'Drop the audio file here...';
            default:
                return 'Drop the image here...';
        }
    };

    const generateImageThumbnail = (file) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 200;
                const MAX_HEIGHT = 200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    return reject(new Error("Cannot get 2D context"));
                }
                ctx.drawImage(img, 0, 0, width, height);
                resolve({
                    dataURL: canvas.toDataURL("image/jpeg", 0.7),
                    originalWidth: img.width,
                    originalHeight: img.height
                });
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = URL.createObjectURL(file);
        });
    };

    const generateVideoThumbnail = (file) => {
        return new Promise((resolve, reject) => {
            const video = document.createElement("video");
            video.preload = "metadata";
            video.muted = true;
            video.playsInline = true;
            video.crossOrigin = "anonymous";

            const objectUrl = URL.createObjectURL(file);
            video.src = objectUrl;

            video.onloadeddata = () => {
                video.currentTime = 0.1;
            };

            video.onseeked = () => {
                const canvas = document.createElement("canvas");

                // Apply the same scaling logic as image thumbnails
                const MAX_WIDTH = 200;
                const MAX_HEIGHT = 200;
                let width = video.videoWidth;
                let height = video.videoHeight;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    return reject(new Error("Cannot get 2D context"));
                }
                ctx.drawImage(video, 0, 0, width, height);
                URL.revokeObjectURL(objectUrl);
                resolve({
                    dataURL: canvas.toDataURL("image/jpeg", 0.9),
                    originalWidth: video.videoWidth,
                    originalHeight: video.videoHeight
                });
            };

            video.onerror = (err) => {
                URL.revokeObjectURL(objectUrl);
                console.error("Video error:", err);
                reject(new Error("Failed to load video"));
            };

            video.src = URL.createObjectURL(file);
            video.load();
        });
    };

    const deleteFile = async (filename) => {
        try {
            // Backend expects: DELETE /delete/{filepath}
            const response = await fetch(`${FILE_API_ENDPOINTS.DELETE}/${projectId}/${filename}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(`Delete failed: ${response.statusText}`);
            }

            const result = await response.json();
            console.log(`Successfully deleted: ${filename}`);
            return result;
        } catch (error) {
            console.error(`Error deleting file ${filename}:`, error);
            throw error;
        }
    };

    const uploadFile = async (file, filename, onProgress = null) => {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file, filename);
            formData.append('path', projectId);

            const xhr = new XMLHttpRequest();

            // Track upload progress
            if (onProgress) {
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = Math.round((event.loaded / event.total) * 100);
                        onProgress(percentComplete);
                    }
                });
            }

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        resolve(result);
                    } catch (error) {
                        reject(new Error('Invalid JSON response'));
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.statusText}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed: Network error'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Upload cancelled'));
            });

            xhr.open('POST', FILE_API_ENDPOINTS.UPLOAD);
            xhr.send(formData);
        });
    };

    const onDrop = useCallback(
        async (acceptedFiles) => {
            try {
                if (acceptedFiles.length === 0) return;

                setUploadStatus("Preparing upload...");
                isNewUpload.current = true;

                const file = acceptedFiles[0];
                const filename = file.name;
                const extension = filename.split(".").pop();
                const baseFilename = filename.replace(/\.[^/.]+$/, "");
                const thumbnailFilename = `${baseFilename}_thumb.jpg`;

                // Delete old files if they exist
                if (currentFile?.name) {
                    const oldBaseFilename = currentFile.name.replace(/\.[^/.]+$/, "");
                    const oldThumbnailFilename = `${oldBaseFilename}_thumb.jpg`;

                    try {
                        const deletePromises = [deleteFile(currentFile.name)];

                        // Only delete thumbnail for image and video files
                        if (mode === 'image' || mode === 'video') {
                            deletePromises.push(deleteFile(oldThumbnailFilename));
                        }

                        await Promise.all(deletePromises);
                        console.log("Old files deleted successfully");
                    } catch (error) {
                        console.error("Error deleting old files:", error);
                        // Continue with upload even if deletion fails
                    }
                }

                // Generate and upload thumbnail for images/videos
                let thumbnailUrl = null;
                let actualWidth = 0;
                let actualHeight = 0;

                if (file.type.startsWith("video/") || file.type.startsWith("image/")) {
                    try {
                        setUploadStatus("Generating thumbnail...");
                        const thumbnailResult = await (file.type.startsWith("video/")
                            ? generateVideoThumbnail(file)
                            : generateImageThumbnail(file));

                        // Capture the actual dimensions
                        actualWidth = thumbnailResult.originalWidth;
                        actualHeight = thumbnailResult.originalHeight;

                        const thumbnailBlob = await fetch(thumbnailResult.dataURL).then((r) => r.blob());

                        setUploadStatus("Uploading...");
                        const uploadResult = await uploadFile(thumbnailBlob, thumbnailFilename);
                        // Extract just the filename from the stored path (remove projectId directory part)
                        const storedPath = uploadResult.file.storedName;
                        thumbnailUrl = storedPath.includes('/') ? storedPath.split('/').pop() : storedPath;
                        console.log("Thumbnail uploaded successfully");
                    } catch (err) {
                        console.error("Failed to generate/upload thumbnail:", err);
                    }
                }

                // Upload main file
                const uploadResult = await uploadFile(file, filename, (percent) => {
                    setUploadStatus(`Uploading... ${percent}%`);
                });
                // Extract just the filename from the stored path (remove projectId directory part)
                const storedPath = uploadResult.file.storedName;
                const fileUrl = storedPath.includes('/') ? storedPath.split('/').pop() : storedPath;

                // Create file data object for the asset update
                const fileData = {
                    name: filename,
                    url: fileUrl,
                    width: actualWidth,
                    height: actualHeight
                };

                // Update the asset in the store
                await updateAssetFile(assetId, fileData);

                // Also update local state for immediate UI feedback
                setCurrentFile(fileData);

                // setUploadStatus("Upload successful!");
                // setTimeout(() => setUploadStatus(""), 2000);
                setUploadStatus("")

                console.log("Upload completed successfully:", fileData);

            } catch (error) {
                console.error("Upload error:", error);
                setUploadStatus(`Upload failed: ${error.message || "Unknown error occurred"}`);
                setTimeout(() => setUploadStatus(""), 3000);
            }
        },
        [currentFile]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: getAcceptedFiles()
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

            {/* Upload area */}
            {!uploadStatus && (!currentFile?.url || isDragActive) && (
                <div
                    {...getRootProps()}
                    style={{
                        ...containerStyle,
                        borderStyle: 'solid',
                        cursor: 'pointer',
                        textAlign: 'center',
                        backgroundColor: isDragActive ? '#f9fafb' : '#ffffff',
                        borderColor: isDragActive ? '#10b981' : '#d1d5db',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        if (!isDragActive) e.target.style.borderColor = '#6b7280';
                    }}
                    onMouseLeave={(e) => {
                        if (!isDragActive) e.target.style.borderColor = '#d1d5db';
                    }}
                >
                    <input {...getInputProps()} />
                    {isDragActive ? (
                        <p style={{ fontSize: '14px', margin: 0 }}>{getDropActiveText()}</p>
                    ) : (
                        <p style={{ fontSize: '14px', margin: 0 }}>{getDropzoneText()}</p>
                    )}
                </div>
            )}

            {/* Thumbnail preview */}
            {!uploadStatus && currentFile?.url && !isDragActive && (
                <div
                    {...getRootProps()}
                    style={{
                        ...containerStyle,
                        cursor: 'pointer',
                        overflow: 'hidden',
                        backgroundColor: '#ffffff',
                        transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                    onMouseLeave={(e) => e.target.style.opacity = '1'}
                >
                    <input {...getInputProps()} />
                    {mode === 'audio' ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '100%',
                            padding: '16px',
                            textAlign: 'center'
                        }}>
                            <div style={{
                                fontSize: '24px',
                                marginBottom: '8px',
                                color: '#6b7280'
                            }}>🎵</div>
                            <div style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#374151',
                                wordBreak: 'break-word'
                            }}>
                                {currentFile.name}
                            </div>
                        </div>
                    ) : (
                        <img
                            src={`${FILE_API_ENDPOINTS.DOWNLOAD}/${projectId}/${currentFile.url.replace(/\.[^/.]+$/, "_thumb.jpg")}`}
                            alt="File thumbnail"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain'
                            }}
                        />
                    )}
                </div>
            )}

            {/* Upload status */}
            {uploadStatus && (
                <div style={{
                    ...containerStyle,
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    fontWeight: '600',
                    textAlign: 'center'
                }}>
                    <span style={{ fontSize: '14px' }}>{uploadStatus}</span>
                </div>
            )}
            {/* Debug: Current file contents */}
            {currentFile && (
                <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f0f2f5', borderRadius: '8px', fontSize: '14px', color: '#6b7280' }}>
                    <h4 style={{ fontWeight: '600', marginBottom: '8px' }}>Current File Details:</h4>
                    {mode}
                    <pre style={{ whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(currentFile, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
