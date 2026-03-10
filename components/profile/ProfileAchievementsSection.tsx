import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { BadgeGrid } from '@/components/rewards/BadgeGrid';
import { ProfileSectionHeading } from './ProfileSectionHeading';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing } from '@/constants/theme';
import type { AvailableBadge } from '@/lib/types';

interface ProfileAchievementsSectionProps {
  badges: AvailableBadge[];
  earnedIds: Set<string>;
  isOwnProfile: boolean;
  onViewAll?: () => void;
}

export const ProfileAchievementsSection = React.memo(function ProfileAchievementsSection({
  badges,
  earnedIds,
  isOwnProfile,
  onViewAll,
}: ProfileAchievementsSectionProps) {
  const { colors } = useTheme();

  return (
    <Animated.View entering={FadeIn.delay(400).duration(400)}>
      <Card style={styles.card} padding="lg">
        <ProfileSectionHeading
          icon="ribbon-outline"
          title="Achievements"
          subtitle={`${earnedIds.size} badge${earnedIds.size !== 1 ? 's' : ''} earned`}
        />
        {badges.length > 0 ? (
          <BadgeGrid badges={badges} earnedIds={earnedIds} />
        ) : (
          <View style={styles.emptyWrap}>
            <Ionicons name="ribbon-outline" size={20} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No badges earned yet. Keep solving puzzles!
            </Text>
          </View>
        )}
        {isOwnProfile && onViewAll && (
          <Pressable
            onPress={onViewAll}
            style={[styles.viewAllRow, { borderTopColor: colors.border }]}
          >
            <Text style={[styles.viewAllText, { color: colors.primary }]}>View All Badges</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        )}
      </Card>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  emptyText: { fontSize: fontSize.base, textAlign: 'center' },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  viewAllText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
