import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';

export default function AuthScreen() {
  const colorScheme = useColorScheme();
  const { login, signup, isLoading } = useAuthStore();

  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (isSignup && !name) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    try {
      if (isSignup) {
        await signup(email, password, name);
      } else {
        await login(email, password);
      }
      // Navigation will be handled by the auth state change
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Authentication failed');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors[colorScheme ?? 'light'].background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <ThemedView className="flex-1 justify-center px-8">
            {/* Title */}
            <View className="mb-12">
              <ThemedText type="title" className="text-4xl mb-2 text-center">
                {isSignup ? 'Create Account' : 'Welcome Back'}
              </ThemedText>
              <ThemedText className="text-center opacity-70">
                {isSignup ? 'Sign up to get started' : 'Sign in to continue'}
              </ThemedText>
            </View>

            {/* Form */}
            <View className="gap-4 mb-6">
              {isSignup && (
                <View>
                  <ThemedText className="mb-2 font-semibold">Name</ThemedText>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your name"
                    placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
                    className="px-4 py-3 rounded-xl"
                    style={{
                      backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#f5f5f5',
                      color: Colors[colorScheme ?? 'light'].text,
                    }}
                  />
                </View>
              )}

              <View>
                <ThemedText className="mb-2 font-semibold">Email</ThemedText>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="px-4 py-3 rounded-xl"
                  style={{
                    backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#f5f5f5',
                    color: Colors[colorScheme ?? 'light'].text,
                  }}
                />
              </View>

              <View>
                <ThemedText className="mb-2 font-semibold">Password</ThemedText>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
                  secureTextEntry
                  className="px-4 py-3 rounded-xl"
                  style={{
                    backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#f5f5f5',
                    color: Colors[colorScheme ?? 'light'].text,
                  }}
                />
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading}
              className="py-4 rounded-xl mb-4"
              style={{
                backgroundColor: isLoading
                  ? (colorScheme === 'dark' ? '#3a3a3a' : '#e0e0e0')
                  : Colors[colorScheme ?? 'light'].tint,
              }}
            >
              <ThemedText className="text-center font-bold text-lg" style={{ color: 'white' }}>
                {isLoading ? 'Please wait...' : (isSignup ? 'Sign Up' : 'Sign In')}
              </ThemedText>
            </TouchableOpacity>

            {/* Toggle */}
            <TouchableOpacity onPress={() => setIsSignup(!isSignup)}>
              <ThemedText className="text-center">
                {isSignup ? 'Already have an account? ' : "Don't have an account? "}
                <ThemedText style={{ color: Colors[colorScheme ?? 'light'].tint }} className="font-bold">
                  {isSignup ? 'Sign In' : 'Sign Up'}
                </ThemedText>
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
