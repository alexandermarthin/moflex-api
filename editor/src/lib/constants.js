// API Base URL
// export const FILE_API_BASE_URL = 'http://localhost:3000';

// For production, you could use:
export const FILE_API_BASE_URL = import.meta.env.VITE_FILE_API_BASE_URL;

// API Endpoints
export const FILE_API_ENDPOINTS = {
    DOWNLOAD: `${FILE_API_BASE_URL}/download`,
    UPLOAD: `${FILE_API_BASE_URL}/upload`,
    DELETE: `${FILE_API_BASE_URL}/delete`,
};
