// For production, you could use:
export const FILE_API_BASE_URL = import.meta.env.VITE_FILE_API_BASE_URL;

// API Endpoints
export const FILE_API_ENDPOINTS = {
    DOWNLOAD: `${FILE_API_BASE_URL}/templates`,
    UPLOAD: `${FILE_API_BASE_URL}/upload`,
    DELETE: `${FILE_API_BASE_URL}/delete`,
};
