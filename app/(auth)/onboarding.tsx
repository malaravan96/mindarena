import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
  features: string[];
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to MindArena',
    description: 'Challenge your mind with daily puzzles and compete with others!',
    icon: '\u{1F9E0}',
    features: [
      'Solve unique puzzles every day',
      'Track your progress over time',
      'Build your solving streak',
    ],
  },
  {
    title: 'Climb the Leaderboard',
    description: 'Compete with players around the world and prove your skills!',
    icon: '\u{1F3C6}',
    features: [
      'Earn points for correct answers',
      'Faster solutions = more points',
      'See your global ranking',
    ],
  },
  {
    title: 'Build Your Streak',
    description: 'Consistency is key! Solve puzzles daily to maintain your streak.',
    icon: '\u{1F525}',
    features: [
      'Daily puzzles to keep you sharp',
      'Streak bonuses for consistency',
      'Track your improvement',
    ],
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const { colors } = useTheme();

  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const step = ONBOARDING_STEPS[currentStep];

  function handleNext() {
    if (isLastStep) {
      router.replace('/(app)');
    } else {
      setCurrentStep(currentStep + 1);
    }
  }

  function handleSkip() {
    router.replace('/(app)');
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Skip Button */}
        {!isLastStep && (
          <View style={styles.skipContainer}>
            <Pressable onPress={handleSkip}>
              <Text
                style={[
                  styles.skipButton,
                  { color: colors.textSecondary, fontWeight: fontWeight.semibold },
                ]}
              >
                Skip
              </Text>
            </Pressable>
          </View>
        )}

        {/* Progress Dots — themed */}
        <View style={styles.dotsContainer}>
          {ONBOARDING_STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === currentStep ? colors.primary : colors.border,
                  width: index === currentStep ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Pseudo-gradient header area */}
        <View style={styles.headerWrap}>
          <View style={[styles.headerBg, { backgroundColor: colors.gradientStart, opacity: 0.12 }]} />
          <View style={[styles.headerBgEnd, { backgroundColor: colors.gradientEnd, opacity: 0.08 }]} />

          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}20` }]}>
            <Text style={styles.icon}>{step.icon}</Text>
          </View>

          {/* Title */}
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontSize: fontSize['3xl'],
                fontWeight: fontWeight.black,
              },
            ]}
          >
            {step.title}
          </Text>

          {/* Description */}
          <Text
            style={[
              styles.description,
              {
                color: colors.textSecondary,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.medium,
              },
            ]}
          >
            {step.description}
          </Text>
        </View>

        {/* Features */}
        <Card style={styles.featuresCard}>
          {step.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={[styles.featureBullet, { backgroundColor: colors.primary }]}>
                <Text style={styles.featureBulletText}>{'\u2713'}</Text>
              </View>
              <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Button
          title={isLastStep ? "Let's Start!" : 'Next'}
          onPress={handleNext}
          variant="gradient"
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  skipContainer: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
  },
  skipButton: {
    fontSize: fontSize.base,
    textDecorationLine: 'underline',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  dot: {
    height: 8,
    borderRadius: borderRadius.full,
  },
  headerWrap: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: spacing.xl,
  },
  headerBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.lg,
  },
  headerBgEnd: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: '50%',
    borderTopRightRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    textAlign: 'center',
    maxWidth: 400,
  },
  featuresCard: {
    width: '100%',
    maxWidth: 500,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  featureBullet: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureBulletText: {
    color: '#ffffff',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  featureText: {
    fontSize: fontSize.base,
    flex: 1,
  },
  bottomContainer: {
    padding: spacing.lg,
    borderTopWidth: 1,
  },
});
