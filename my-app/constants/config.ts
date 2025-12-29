// API Configuration
// Update these values based on your backend setup

export const API_CONFIG = {
  // Backend API URL
  // For iOS Simulator: use 'http://localhost:3000'
  // For Android Emulator: use 'http://10.0.2.2:3000'
  // For physical device: use your computer's IP address (e.g., 'http://192.168.1.100:3000')
  BASE_URL: 'http://localhost:3000',

  // Cloudflare R2 public URL for audio playback
  // Get this from your R2 bucket settings
  R2_PUBLIC_URL: 'https://your-r2-bucket.r2.dev',
};

export const API_ENDPOINTS = {
  TRANSCRIBE: `${API_CONFIG.BASE_URL}/transcribe-and-summarize`,
};
