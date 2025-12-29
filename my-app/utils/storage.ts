import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Recording {
  id: string;
  title: string;
  summary: string;
  transcription: string;
  audioUrl: string;
  duration: number;
  createdAt: string;
}

const RECORDINGS_KEY = '@recordings';

export const saveRecording = async (recording: Recording): Promise<void> => {
  try {
    const recordings = await getRecordings();
    recordings.unshift(recording); // Add to beginning
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(recordings));
  } catch (error) {
    console.error('Error saving recording:', error);
    throw error;
  }
};

export const getRecordings = async (): Promise<Recording[]> => {
  try {
    const recordingsJson = await AsyncStorage.getItem(RECORDINGS_KEY);
    return recordingsJson ? JSON.parse(recordingsJson) : [];
  } catch (error) {
    console.error('Error loading recordings:', error);
    return [];
  }
};

export const getRecordingById = async (id: string): Promise<Recording | null> => {
  try {
    const recordings = await getRecordings();
    return recordings.find(r => r.id === id) || null;
  } catch (error) {
    console.error('Error loading recording:', error);
    return null;
  }
};

export const deleteRecording = async (id: string): Promise<void> => {
  try {
    const recordings = await getRecordings();
    const filtered = recordings.filter(r => r.id !== id);
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting recording:', error);
    throw error;
  }
};

export const updateRecording = async (id: string, updates: Partial<Recording>): Promise<void> => {
  try {
    const recordings = await getRecordings();
    const index = recordings.findIndex(r => r.id === id);
    if (index !== -1) {
      recordings[index] = { ...recordings[index], ...updates };
      await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(recordings));
    }
  } catch (error) {
    console.error('Error updating recording:', error);
    throw error;
  }
};

// Generate a title from transcription or use default
export const generateTitle = (transcription: string, maxLength: number = 50): string => {
  if (!transcription || transcription.trim().length === 0) {
    return `Recording ${new Date().toLocaleDateString()}`;
  }

  // Get first sentence or first N characters
  const firstSentence = transcription.split(/[.!?]/)[0].trim();
  if (firstSentence.length > 0 && firstSentence.length <= maxLength) {
    return firstSentence;
  }

  return transcription.substring(0, maxLength).trim() + '...';
};
