import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';

interface AuthHeaderProps {
  icon: React.ReactNode;
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
        <Pressable
          onPress={onBack}
          style={[styles.backBtn, { backgroundColor: `${colors.text}10` }]}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
      )}

      {/* Icon circle */}
      <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
        {icon}
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
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
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
