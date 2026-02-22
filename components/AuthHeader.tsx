import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';

interface AuthHeaderProps {
  icon?: React.ReactNode;
  logo?: any;
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function AuthHeader({ icon, logo, title, subtitle, onBack }: AuthHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[`${colors.gradientStart}1f`, `${colors.gradientEnd}08`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bgLayer}
      />

      {onBack && (
        <Pressable
          onPress={onBack}
          style={[styles.backBtn, { backgroundColor: `${colors.surface}cc`, borderColor: colors.border }]}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
      )}

      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconCircle}
      >
        {logo ? (
          <Image source={logo} style={styles.logoImage} resizeMode="contain" />
        ) : (
          icon
        )}
      </LinearGradient>

      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

      {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
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
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    position: 'relative',
  },
  bgLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.xl,
  },
  backBtn: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  logoImage: {
    width: 48,
    height: 48,
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
    maxWidth: 360,
    lineHeight: fontSize.base * 1.4,
  },
});
