import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, fontSize, fontWeight } from '@/constants/theme';

interface UnreadDividerProps {
  count: number;
}

export const UnreadDivider = React.memo(function UnreadDivider({ count }: UnreadDividerProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.line, { backgroundColor: colors.primary }]} />
      <Text style={[styles.text, { color: colors.primary }]}>
        {count} unread message{count !== 1 ? 's' : ''}
      </Text>
      <View style={[styles.line, { backgroundColor: colors.primary }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  line: {
    flex: 1,
    height: 1,
    opacity: 0.4,
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
});
