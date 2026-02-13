import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';

interface AuthHeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function AuthHeader({ icon, title, subtitle, onBack }: AuthHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* Pseudo-gradient background */}
      <View style={[styles.bgLayer, { backgroundColor: colors.gradientStart, opacity: 0.12 }]} />
      <View style={[styles.bgLayerEnd, { backgroundColor: colors.gradientEnd, opacity: 0.08 }]} />

      {/* Back button */}
      {onBack && (
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <Text style={[styles.backArrow, { color: colors.text }]}>{'\u2190'}</Text>
        </Pressable>
      )}

      {/* Icon circle */}
      <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

      {/* Subtitle */}
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    position: 'relative',
  },
  bgLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.lg,
  },
  bgLayerEnd: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: '50%',
    borderTopRightRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  backBtn: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconText: {
    fontSize: 36,
  },
  title: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.black,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 340,
  },
});
