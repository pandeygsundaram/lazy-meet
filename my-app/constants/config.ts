// API Configuration
// Update these values based on your backend setup

export const API_CONFIG = {
  // Backend API URL
  BASE_URL: 'https://api.lazymeet.samosa.wtf',

  // Cloudflare R2 public URL for audio playback
  // Get this from your R2 bucket settings
  R2_PUBLIC_URL: 'https://api.lazymeet.samosa.wtf',
};

export const API_ENDPOINTS = {
  UPLOAD: `${API_CONFIG.BASE_URL}/recordings/upload`,
  RECORDINGS: `${API_CONFIG.BASE_URL}/recordings`,
};
