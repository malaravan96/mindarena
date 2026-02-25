import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing } from '@/constants/theme';

const DISMISSED_KEY = 'screenshot_warning_dismissed_v1';

export function ScreenshotWarningBanner() {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(DISMISSED_KEY)
      .then((val) => {
        if (val !== 'true') setVisible(true);
      })
      .catch(() => setVisible(true));
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    SecureStore.setItemAsync(DISMISSED_KEY, 'true').catch(() => null);
  };

  return (
    <View style={[styles.banner, { backgroundColor: `${colors.warning}18`, borderColor: `${colors.warning}40` }]}>
      <Ionicons name="camera-outline" size={16} color={colors.warning} />
      <Text style={[styles.text, { color: colors.warning }]} numberOfLines={2}>
        Screenshots in this chat may be visible to the recipient. Messages are end-to-end encrypted.
      </Text>
      <Pressable onPress={dismiss} style={styles.closeBtn} hitSlop={8}>
        <Ionicons name="close" size={14} color={colors.warning} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    gap: spacing.xs,
  },
  text: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
});
