import React, { ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeAccessButton } from '@/components/ThemeAccessButton';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, isDesktop, isTablet, spacing } from '@/constants/theme';

interface AuthScaffoldProps {
  children: ReactNode;
  animatedStyle?: any;
  maxWidth?: ViewStyle['maxWidth'];
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

export function AuthScaffold({
  children,
  animatedStyle,
  maxWidth,
  scrollable = false,
  contentStyle,
}: AuthScaffoldProps) {
  const { colors } = useTheme();
  const resolvedMaxWidth: ViewStyle['maxWidth'] =
    maxWidth ?? (isDesktop ? 520 : isTablet ? 580 : '100%');

  const content = (
    <Animated.View
      style={[
        styles.content,
        {
          maxWidth: resolvedMaxWidth,
          width: '100%',
        },
        animatedStyle,
        contentStyle,
      ]}
    >
      {children}
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.wrap, { backgroundColor: colors.background }]}
    >
      <ThemeAccessButton />

      <View style={styles.background} pointerEvents="none">
        <LinearGradient
          colors={[`${colors.gradientStart}24`, `${colors.gradientEnd}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.glowTop, { borderRadius: borderRadius.full }]}
        />
        <LinearGradient
          colors={[`${colors.secondary}1f`, `${colors.gradientEnd}00`]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.glowBottom, { borderRadius: borderRadius.full }]}
        />
      </View>

      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  glowTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    top: -120,
    right: -90,
  },
  glowBottom: {
    position: 'absolute',
    width: 280,
    height: 280,
    bottom: -90,
    left: -110,
  },
  scroll: {
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  content: {
    alignSelf: 'center',
    padding: spacing.lg,
    alignItems: 'center',
  },
});
