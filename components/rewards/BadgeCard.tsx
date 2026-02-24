import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280',
  uncommon: '#10b981',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

type Props = {
  title: string;
  description: string;
  icon: string;
  rarity: string;
  unlocked: boolean;
  earnedAt?: string;
};

export function BadgeCard({ title, description, icon, rarity, unlocked, earnedAt }: Props) {
  const { colors } = useTheme();
  const rarityColor = RARITY_COLORS[rarity] ?? RARITY_COLORS.common;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: unlocked ? `${rarityColor}10` : colors.surfaceVariant,
          borderColor: unlocked ? `${rarityColor}40` : colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: unlocked ? `${rarityColor}18` : `${colors.textTertiary}15` },
        ]}
      >
        <Ionicons
          name={icon as IconName}
          size={20}
          color={unlocked ? rarityColor : colors.textTertiary}
        />
      </View>
      <Text
        style={[styles.title, { color: unlocked ? colors.text : colors.textTertiary }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text
        style={[styles.desc, { color: unlocked ? colors.textSecondary : colors.textTertiary }]}
        numberOfLines={2}
      >
        {description}
      </Text>
      <View style={styles.bottomRow}>
        <View style={[styles.rarityPill, { backgroundColor: `${rarityColor}18` }]}>
          <Text style={[styles.rarityText, { color: rarityColor }]}>
            {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
          </Text>
        </View>
        {unlocked && (
          <Ionicons name="checkmark-circle" size={16} color={colors.correct} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: '48%' as any,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    marginBottom: 2,
    textAlign: 'center',
  },
  desc: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rarityPill: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
});
