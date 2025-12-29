import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from 'expo-audio';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { saveRecording, updateRecording, generateTitle, type Recording } from '@/utils/storage';
import { API_ENDPOINTS } from '@/constants/config';

export default function RecordScreen() {
  const colorScheme = useColorScheme();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Request permissions and set audio mode on mount
  useEffect(() => {
    (async () => {
      try {
        console.log('Requesting recording permissions...');
        const status = await AudioModule.requestRecordingPermissionsAsync();
        console.log('Permission status:', status);

        if (!status.granted) {
          Alert.alert('Permission Required', 'Microphone permission is required to record audio');
        }

        console.log('Setting audio mode...');
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });
        console.log('Audio mode set successfully');
      } catch (error) {
        console.error('Failed to setup audio:', error);
        Alert.alert('Setup Error', `Failed to setup audio: ${error}`);
      }
    })();
  }, []);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const saveRecordingLocally = async (uri: string | any, duration: number) => {
    try {
      // Handle case where uri might be an object with a url property
      let audioPath: string;
      if (typeof uri === 'string') {
        audioPath = uri;
      } else if (uri && typeof uri === 'object' && uri.url) {
        audioPath = uri.url;
        console.log('Extracted URL from uri object:', audioPath);
      } else {
        throw new Error('Invalid URI format');
      }

      const recordingId = Date.now().toString();
      const newRecording: Recording = {
        id: recordingId,
        title: `Recording ${new Date().toLocaleString()}`,
        summary: 'Processing...',
        transcription: 'Transcription pending...',
        audioUrl: audioPath,
        duration: duration || 0,
        createdAt: new Date().toISOString(),
      };

      console.log('Saving recording to storage:', newRecording);
      await saveRecording(newRecording);
      console.log('Recording saved successfully');

      // Verify it was saved
      const allRecordings = await import('@/utils/storage').then(m => m.getRecordings());
      console.log('Total recordings after save:', allRecordings.length);

      Alert.alert(
        'Saved!',
        'Recording saved locally. Check the Recordings tab!',
        [{ text: 'OK' }]
      );

      return recordingId;
    } catch (error) {
      console.error('Failed to save recording locally:', error);
      Alert.alert('Error', `Failed to save: ${error}`);
      throw error;
    }
  };

  const startRecording = async () => {
    try {
      console.log('Starting recording...');

      console.log('Preparing to record...');
      await audioRecorder.prepareToRecordAsync();
      console.log('Recorder prepared');

      console.log('Calling record()...');
      audioRecorder.record();
      console.log('record() called');

      // Wait a bit for the recorder to actually start
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('After record(), audioRecorder.isRecording:', audioRecorder.isRecording);

      if (!audioRecorder.isRecording) {
        console.error('WARNING: Recorder did not start!');
        Alert.alert('Error', 'Recording failed to start. Please check microphone permissions.');
        return;
      }

      setIsRecording(true);
      setRecordingTime(0);
      console.log('Recording started successfully');
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', `Failed to start recording: ${err}`);
    }
  };

  const stopRecording = async () => {
    try {
      console.log('Stop recording called, isRecording:', audioRecorder.isRecording);

      // Store duration before stopping
      const duration = recordingTime;

      // Only stop the recorder if it's actually recording
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
        console.log('Recording stopped');

        // Get the URI from the recorder - it's a property, not from stop()
        const uri = audioRecorder.uri;
        console.log('Recording URI:', uri);
        console.log('Recording URI type:', typeof uri);

        // Always set recording to false after stopping
        setIsRecording(false);

        if (uri) {
          // Save locally first
          console.log('Saving recording locally...');
          const recordingId = await saveRecordingLocally(uri, duration);
          console.log('Recording saved with ID:', recordingId);

          // Then try to process with backend (optional, doesn't block)
          processRecording(uri, duration, recordingId).catch((err) => {
            console.log('Background processing failed:', err);
            // Silently fail - recording is already saved locally
          });
        } else {
          console.log('No URI available from recorder');
          Alert.alert('Error', 'Failed to get recording URI');
        }
      } else {
        console.log('Recorder was not recording');
        setIsRecording(false);
      }

      setRecordingTime(0);
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to stop recording');
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  const processRecording = async (uri: string, duration: number, recordingId: string) => {
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);

      const response = await fetch(API_ENDPOINTS.TRANSCRIBE, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = await response.json();

      if (data.success) {
        // Update the existing recording with transcription and summary
        await updateRecording(recordingId, {
          title: generateTitle(data.transcription),
          summary: data.summary,
          transcription: data.transcription,
          audioUrl: data.audioUrl || uri,
        });

        console.log('Recording updated with transcription and summary');
      } else {
        throw new Error(data.error || 'Failed to process recording');
      }
    } catch (err) {
      console.error('Failed to process recording', err);
      // Don't show alert - it's already saved locally
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelRecording = async () => {
    try {
      // Always set recording to false first to stop the timer
      setIsRecording(false);
      setRecordingTime(0);

      // Only stop the recorder if it's actually recording
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
      }
    } catch (err) {
      console.error('Failed to cancel recording', err);
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  return (
    <ThemedView className="flex-1">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        className="flex-1"
      >
        {/* Header */}
        <View className="pt-16 pb-8 px-6">
          <ThemedText type="title" className="text-center text-3xl mb-2">
            Voice Recorder
          </ThemedText>
          <ThemedText className="text-center opacity-70">
            {isRecording ? 'Recording in progress...' : 'Tap the mic to start recording'}
          </ThemedText>
        </View>

        {/* Timer Display */}
        <View className="items-center py-8">
          <Text
            className="text-6xl font-bold tracking-wider"
            style={{ color: Colors[colorScheme ?? 'light'].text }}
          >
            {formatTime(recordingTime)}
          </Text>
          {isRecording && (
            <View className="flex-row items-center mt-4 gap-2">
              <View className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <ThemedText className="text-red-500 font-semibold">RECORDING</ThemedText>
            </View>
          )}
        </View>

        {/* Record Button */}
        <View className="flex-1 justify-center items-center py-12">
          {isProcessing ? (
            <View className="items-center gap-4">
              <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText className="text-center opacity-70">
                Processing your recording...
              </ThemedText>
            </View>
          ) : (
            <View className="items-center gap-6">
              <TouchableOpacity
                onPress={isRecording ? stopRecording : startRecording}
                className="items-center justify-center rounded-full shadow-lg"
                style={{
                  width: 160,
                  height: 160,
                  backgroundColor: isRecording ? '#ef4444' : Colors[colorScheme ?? 'light'].tint,
                }}
                activeOpacity={0.7}
              >
                {isRecording ? (
                  <IconSymbol name="stop.fill" size={64} color="white" />
                ) : (
                  <IconSymbol name="mic.fill" size={64} color="white" />
                )}
              </TouchableOpacity>

              <ThemedText className="text-lg font-semibold">
                {isRecording ? 'Tap to Stop & Process' : 'Tap to Record'}
              </ThemedText>

              {isRecording && (
                <TouchableOpacity
                  onPress={cancelRecording}
                  className="px-6 py-3 rounded-full border-2"
                  style={{ borderColor: Colors[colorScheme ?? 'light'].text }}
                >
                  <ThemedText className="font-semibold">Cancel Recording</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Instructions */}
        {!isRecording && !isProcessing && (
          <View className="px-8 pb-8">
            <View className="bg-opacity-10 rounded-2xl p-6"
              style={{ backgroundColor: Colors[colorScheme ?? 'light'].tint + '20' }}
            >
              <ThemedText className="text-center mb-3 font-semibold">How it works:</ThemedText>
              <ThemedText className="text-center opacity-70 leading-6">
                1. Tap the microphone to start recording{'\n'}
                2. Speak your thoughts or notes{'\n'}
                3. Tap again to stop and process{'\n'}
                4. Get AI-powered transcription & summary
              </ThemedText>
            </View>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}
