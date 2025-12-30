import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getRecordings, type Recording } from '@/utils/storage';

export default function RecordingsScreen() {
  const colorScheme = useColorScheme();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Load recordings from local storage
  const loadRecordings = async () => {
    try {
      console.log('Loading recordings...');
      const storedRecordings = await getRecordings();
      console.log('Loaded recordings:', storedRecordings.length);
      console.log('Recordings data:', storedRecordings);
      setRecordings(storedRecordings);
    } catch (error) {
      console.error('Failed to load recordings:', error);
    }
  };

  // Reload recordings when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadRecordings();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecordings();
    setRefreshing(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const filteredRecordings = recordings.filter(
    (recording) =>
      recording.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recording.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openRecording = (recording: Recording) => {
    // TODO: Navigate to detail modal with recording data
    router.push({
      pathname: '/modal',
      params: { recordingId: recording.id },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors[colorScheme ?? 'light'].background }} edges={['top', 'left', 'right', 'bottom']}>
      <ThemedView className="flex-1">
        {/* Header */}
        <View className="pb-4 px-6">
        <ThemedText type="title" className="text-3xl mb-2">
          Recordings
        </ThemedText>
        <ThemedText className="opacity-70 mb-4">
          {recordings.length} {recordings.length === 1 ? 'recording' : 'recordings'}
        </ThemedText>

        {/* Search Bar */}
        <View
          className="flex-row items-center px-4 py-3 rounded-xl"
          style={{
            backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#f0f0f0',
          }}
        >
          <IconSymbol
            name="magnifyingglass"
            size={20}
            color={Colors[colorScheme ?? 'light'].icon}
          />
          <TextInput
            className="flex-1 ml-3 text-base"
            placeholder="Search recordings..."
            placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ color: Colors[colorScheme ?? 'light'].text }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IconSymbol
                name="xmark.circle.fill"
                size={20}
                color={Colors[colorScheme ?? 'light'].icon}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Recordings List */}
      <ScrollView
        className="flex-1 px-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors[colorScheme ?? 'light'].tint}
          />
        }
      >
        {filteredRecordings.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <IconSymbol
              name="waveform"
              size={64}
              color={Colors[colorScheme ?? 'light'].icon}
              style={{ opacity: 0.3 }}
            />
            <ThemedText className="text-lg mt-4 opacity-50 text-center">
              {searchQuery
                ? 'No recordings found'
                : 'No recordings yet\nTap Record to get started'}
            </ThemedText>
          </View>
        ) : (
          <View className="gap-3 pb-6">
            {filteredRecordings.map((recording) => (
              <TouchableOpacity
                key={recording.id}
                onPress={() => openRecording(recording)}
                activeOpacity={0.7}
                className="rounded-2xl p-4 shadow-sm"
                style={{
                  backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#ffffff',
                  borderWidth: 1,
                  borderColor: colorScheme === 'dark' ? '#3a3a3a' : '#e0e0e0',
                }}
              >
                {/* Header Row */}
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 mr-3">
                    <ThemedText className="text-lg font-semibold mb-1">
                      {recording.title}
                    </ThemedText>
                    <View className="flex-row items-center gap-3">
                      <View className="flex-row items-center gap-1">
                        <IconSymbol
                          name="clock"
                          size={14}
                          color={Colors[colorScheme ?? 'light'].icon}
                        />
                        <ThemedText className="text-xs opacity-60">
                          {formatDuration(recording.duration)}
                        </ThemedText>
                      </View>
                      <ThemedText className="text-xs opacity-60">
                        {formatDate(recording.createdAt)}
                      </ThemedText>
                    </View>
                  </View>

                  <IconSymbol
                    name="chevron.right"
                    size={20}
                    color={Colors[colorScheme ?? 'light'].icon}
                    style={{ opacity: 0.5 }}
                  />
                </View>

                {/* Summary */}
                <ThemedText
                  className="text-sm opacity-70 leading-5"
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {recording.summary}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}
