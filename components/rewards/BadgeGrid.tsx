import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BadgeCard } from '@/components/rewards/BadgeCard';
import { spacing } from '@/constants/theme';
import type { AvailableBadge } from '@/lib/types';

type Props = {
  badges: AvailableBadge[];
  earnedIds: Set<string>;
};

export function BadgeGrid({ badges, earnedIds }: Props) {
  return (
    <View style={styles.grid}>
      {badges.map((badge) => (
        <BadgeCard
          key={badge.id}
          title={badge.title}
          description={badge.description}
          icon={badge.icon}
          rarity={badge.rarity}
          unlocked={earnedIds.has(badge.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
