import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface ProfileTab {
  key: string;
  label: string;
  icon: IconName;
}

interface ProfileTabBarProps {
  tabs: ProfileTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function ProfileTabBar({ tabs, activeTab, onTabChange }: ProfileTabBarProps) {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(300)}
      style={[styles.container, { borderBottomColor: colors.border }]}
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            style={[
              styles.tab,
              {
                borderColor: active ? `${colors.primary}40` : colors.border,
                backgroundColor: active ? `${colors.primary}15` : colors.surface,
              },
            ]}
          >
            <Ionicons
              name={tab.icon}
              size={14}
              color={active ? colors.primary : colors.textTertiary}
            />
            <Text
              style={[
                styles.label,
                { color: active ? colors.primary : colors.text },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
});
