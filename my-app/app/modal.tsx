import { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getRecordingById, updateRecording, generateTitle, type Recording } from '@/utils/storage';
import { API_CONFIG, API_ENDPOINTS } from '@/constants/config';

export default function RecordingDetailModal() {
  const colorScheme = useColorScheme();
  const params = useLocalSearchParams();
  const recordingId = params.recordingId as string;

  const [recording, setRecording] = useState<Recording | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const player = useAudioPlayer(audioUrl);
  const [showFullTranscription, setShowFullTranscription] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadRecording();
  }, [recordingId]);

  const loadRecording = async () => {
    try {
      const loadedRecording = await getRecordingById(recordingId);
      if (loadedRecording) {
        setRecording(loadedRecording);
        setAudioUrl(`${API_CONFIG.R2_PUBLIC_URL}/${loadedRecording.audioUrl}`);
      } else {
        Alert.alert('Error', 'Recording not found');
        router.back();
      }
    } catch (error) {
      console.error('Failed to load recording:', error);
      Alert.alert('Error', 'Failed to load recording');
      router.back();
    }
  };

  const togglePlayback = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const sendToServer = async () => {
    if (!recording) return;

    setIsProcessing(true);
    try {
      console.log('Sending recording to server...');
      console.log('Audio URL:', recording.audioUrl);

      const formData = new FormData();
      formData.append('audio', {
        uri: recording.audioUrl,
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
      console.log('Server response:', data);

      if (data.success) {
        // Update the recording with transcription and summary
        await updateRecording(recordingId, {
          title: generateTitle(data.transcription),
          summary: data.summary,
          transcription: data.transcription,
          audioUrl: data.audioUrl || recording.audioUrl,
        });

        // Reload the recording to show updated data
        await loadRecording();

        Alert.alert('Success!', 'Recording processed successfully');
      } else {
        throw new Error(data.error || 'Failed to process recording');
      }
    } catch (err) {
      console.error('Failed to process recording:', err);
      Alert.alert('Error', `Failed to process recording: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const isPending = recording?.summary === 'Processing...' || recording?.transcription === 'Transcription pending...';

  if (!recording) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors[colorScheme ?? 'light'].background }} edges={['top', 'left', 'right', 'bottom']}>
        <ThemedView className="flex-1 items-center justify-center">
          <ThemedText>Loading...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const currentTime = player.currentTime || 0;
  const duration = player.duration || recording.duration;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors[colorScheme ?? 'light'].background }} edges={['top', 'left', 'right']}>
      <ThemedView className="flex-1">
        {/* Header */}
        <View className="pb-4 px-6 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center gap-2"
        >
          <IconSymbol
            name="chevron.left"
            size={24}
            color={Colors[colorScheme ?? 'light'].tint}
          />
          <ThemedText style={{ color: Colors[colorScheme ?? 'light'].tint }}>
            Back
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity>
          <IconSymbol
            name="ellipsis.circle"
            size={24}
            color={Colors[colorScheme ?? 'light'].icon}
          />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Title */}
        <ThemedText type="title" className="text-2xl mb-2">
          {recording.title}
        </ThemedText>
        <ThemedText className="text-sm opacity-60 mb-6">
          {formatDate(recording.createdAt)}
        </ThemedText>

        {/* Audio Player */}
        <View
          className="rounded-2xl p-6 mb-6"
          style={{
            backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#f5f5f5',
          }}
        >
          {/* Play Button & Progress */}
          <View className="flex-row items-center gap-4 mb-4">
            <TouchableOpacity
              onPress={togglePlayback}
              className="items-center justify-center rounded-full"
              style={{
                width: 56,
                height: 56,
                backgroundColor: Colors[colorScheme ?? 'light'].tint,
              }}
            >
              <IconSymbol
                name={player.playing ? 'pause.fill' : 'play.fill'}
                size={24}
                color="white"
              />
            </TouchableOpacity>

            <View className="flex-1">
              <View className="flex-row justify-between mb-2">
                <ThemedText className="text-xs opacity-70">
                  {formatTime(currentTime)}
                </ThemedText>
                <ThemedText className="text-xs opacity-70">
                  {formatTime(duration)}
                </ThemedText>
              </View>

              {/* Progress Bar */}
              <View
                className="h-1 rounded-full overflow-hidden"
                style={{
                  backgroundColor: colorScheme === 'dark' ? '#3a3a3a' : '#e0e0e0',
                }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: Colors[colorScheme ?? 'light'].tint,
                    width: `${progress}%`,
                  }}
                />
              </View>
            </View>
          </View>

          {/* Waveform Indicator */}
          <View className="flex-row items-center justify-center gap-1 opacity-30">
            <IconSymbol
              name="waveform"
              size={80}
              color={Colors[colorScheme ?? 'light'].text}
            />
          </View>
        </View>

        {/* Summary Section */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-3">
            <IconSymbol
              name="doc.text"
              size={20}
              color={Colors[colorScheme ?? 'light'].tint}
            />
            <ThemedText className="text-lg font-semibold">Summary</ThemedText>
          </View>
          <View
            className="rounded-xl p-4"
            style={{
              backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#f9f9f9',
            }}
          >
            <ThemedText className="leading-6">{recording.summary}</ThemedText>
          </View>
        </View>

        {/* Transcription Section */}
        <View className="mb-8">
          <TouchableOpacity
            onPress={() => setShowFullTranscription(!showFullTranscription)}
            className="flex-row items-center justify-between mb-3"
          >
            <View className="flex-row items-center gap-2">
              <IconSymbol
                name="text.alignleft"
                size={20}
                color={Colors[colorScheme ?? 'light'].tint}
              />
              <ThemedText className="text-lg font-semibold">
                Full Transcription
              </ThemedText>
            </View>
            <IconSymbol
              name={showFullTranscription ? 'chevron.up' : 'chevron.down'}
              size={20}
              color={Colors[colorScheme ?? 'light'].icon}
            />
          </TouchableOpacity>

          {showFullTranscription && (
            <View
              className="rounded-xl p-4"
              style={{
                backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#f9f9f9',
              }}
            >
              <ThemedText className="leading-6 opacity-80">
                {recording.transcription}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Process with AI Button */}
        {isPending && (
          <View className="mb-8">
            <TouchableOpacity
              onPress={sendToServer}
              disabled={isProcessing}
              className="rounded-xl p-4 flex-row items-center justify-center gap-2"
              style={{
                backgroundColor: isProcessing
                  ? (colorScheme === 'dark' ? '#3a3a3a' : '#e0e0e0')
                  : Colors[colorScheme ?? 'light'].tint,
              }}
            >
              {isProcessing ? (
                <>
                  <ActivityIndicator color="white" />
                  <ThemedText className="font-semibold" style={{ color: 'white' }}>
                    Processing...
                  </ThemedText>
                </>
              ) : (
                <>
                  <IconSymbol name="sparkles" size={20} color="white" />
                  <ThemedText className="font-semibold" style={{ color: 'white' }}>
                    Process with AI
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}
