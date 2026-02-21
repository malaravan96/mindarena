import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ThemeAccessButton } from '@/components/ThemeAccessButton';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  features: string[];
}

function getSteps(primaryColor: string): OnboardingStep[] {
  return [
    {
      title: 'Welcome to MindArena',
      description: 'Challenge your mind with daily puzzles and compete with others.',
      icon: <MaterialCommunityIcons name="brain" size={56} color="#ffffff" />,
      iconBg: primaryColor,
      features: [
        'Solve unique puzzles every day',
        'Track your progress over time',
        'Build your solving streak',
      ],
    },
    {
      title: 'Climb the Leaderboard',
      description: 'Compete globally and prove your skills in every category.',
      icon: <Ionicons name="trophy" size={56} color="#ffffff" />,
      iconBg: '#f59e0b',
      features: [
        'Earn points for correct answers',
        'Faster solutions bring more points',
        'See your global ranking in real time',
      ],
    },
    {
      title: 'Build Your Streak',
      description: 'Consistency compounds. Stay active to grow your edge.',
      icon: <Ionicons name="flame" size={56} color="#ffffff" />,
      iconBg: '#ef4444',
      features: [
        'Daily puzzles keep you sharp',
        'Streak bonuses reward consistency',
        'Watch your skills improve over time',
      ],
    },
  ];
}

export default function Onboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const { colors } = useTheme();

  const steps = getSteps(colors.primary);
  const isLastStep = currentStep === steps.length - 1;
  const step = steps[currentStep];
  const progress = (currentStep + 1) / steps.length;

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
      <ThemeAccessButton />

      <View style={styles.backgroundLayer} pointerEvents="none">
        <LinearGradient
          colors={[`${colors.gradientStart}24`, `${colors.gradientEnd}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.glowTop}
        />
        <LinearGradient
          colors={[`${colors.secondary}1f`, `${colors.gradientEnd}00`]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.glowBottom}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View style={[styles.stepChip, { backgroundColor: `${colors.primary}16` }]}>
            <Text style={[styles.stepChipText, { color: colors.primary }]}>
              Step {currentStep + 1} of {steps.length}
            </Text>
          </View>

          {!isLastStep && (
            <Pressable onPress={handleSkip}>
              <Text style={[styles.skipButton, { color: colors.textSecondary }]}>Skip</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}> 
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress * 100}%` }]} />
        </View>

        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroGlow} />
          <View style={[styles.iconContainer, { backgroundColor: step.iconBg }]}>{step.icon}</View>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
        </LinearGradient>

        <Card style={styles.featuresCard}>
          <Text style={[styles.featuresTitle, { color: colors.text }]}>What you unlock</Text>

          {step.features.map((feature, index) => (
            <View key={feature} style={styles.featureItem}>
              <View style={[styles.featureBullet, { backgroundColor: `${colors.primary}18` }]}>
                <Ionicons name="checkmark" size={14} color={colors.primary} />
              </View>
              <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
              <Text style={[styles.featureIndex, { color: colors.textTertiary }]}>0{index + 1}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>

      <View style={[styles.bottomContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}> 
        <Button
          title={isLastStep ? "Let's Start" : 'Next'}
          onPress={handleNext}
          variant="gradient"
          fullWidth
          size="lg"
          style={styles.bottomButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  glowTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    top: -120,
    right: -90,
    borderRadius: borderRadius.full,
  },
  glowBottom: {
    position: 'absolute',
    width: 260,
    height: 260,
    bottom: -80,
    left: -100,
    borderRadius: borderRadius.full,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stepChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  stepChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
  },
  skipButton: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textDecorationLine: 'underline',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  heroCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    alignItems: 'center',
  },
  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    top: -60,
    right: -40,
  },
  iconContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    textAlign: 'center',
    color: '#ffffff',
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.black,
    marginBottom: spacing.sm,
  },
  description: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.9)',
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.4,
  },
  featuresCard: {
    borderRadius: borderRadius.xl,
  },
  featuresTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  featureBullet: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: fontSize.base,
  },
  featureIndex: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  bottomContainer: {
    padding: spacing.lg,
    borderTopWidth: 1,
  },
  bottomButton: {
    borderRadius: borderRadius.full,
  },
});
