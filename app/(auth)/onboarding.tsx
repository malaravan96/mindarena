import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthWaveLayout } from '@/components/auth/AuthWaveLayout';
import { AUTH_CORAL, AUTH_WHITE } from '@/constants/authColors';
import { fontSize, fontWeight, spacing } from '@/constants/theme';

export default function Onboarding() {
  const router = useRouter();

  function handleGetStarted() {
    router.replace('/(auth)');
  }

  return (
    <AuthWaveLayout heroTitle="Welcome" heroSubtitle="Challenge your mind daily. Compete globally.">
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="brain" size={64} color={AUTH_CORAL} />
        </View>

        <Text style={styles.appName}>MindArena</Text>
        <Text style={styles.tagline}>
          Solve unique puzzles every day, climb the leaderboard, and build your solving streak.
        </Text>

        <View style={styles.featuresWrap}>
          <FeatureRow emoji="🧩" text="Daily puzzles keep your mind sharp" />
          <FeatureRow emoji="🏆" text="Compete globally and see live rankings" />
          <FeatureRow emoji="🔥" text="Streak bonuses reward consistency" />
        </View>

        <Pressable
          onPress={handleGetStarted}
          style={({ pressed }) => [styles.getStartedBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.getStartedText}>Get Started</Text>
        </Pressable>
      </View>
    </AuthWaveLayout>
  );
}

function FeatureRow({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureEmoji}>{emoji}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${AUTH_CORAL}18`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  appName: {
    fontSize: 28,
    fontWeight: fontWeight.black,
    color: '#222222',
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: fontSize.base,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  featuresWrap: {
    width: '100%',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  featureEmoji: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: fontSize.base,
    color: '#444444',
    lineHeight: 22,
  },
  getStartedBtn: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: AUTH_CORAL,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: AUTH_CORAL,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    marginTop: spacing.lg,
  },
  getStartedText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: AUTH_WHITE,
    textAlign: 'center',
    lineHeight: 26,
  },
});
