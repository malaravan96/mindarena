import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { ProfileSectionHeading } from './ProfileSectionHeading';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';
import type { UserStats } from '@/lib/types';

interface ProfileStatsSectionProps {
  stats: UserStats;
  connectionCount: number;
  winRate: number;
  isOwnProfile: boolean;
  dmUnread?: number;
  onChatPress?: () => void;
}

function StatBox({
  label,
  value,
  color,
  index,
}: {
  label: string;
  value: string;
  color: string;
  index: number;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeIn.delay(300 + index * 60).duration(300)}
      style={[statStyles.box, { backgroundColor: colors.surfaceVariant, borderColor: `${color}28` }]}
    >
      <View style={[statStyles.dot, { backgroundColor: color }]} />
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={[statStyles.label, { color: colors.textSecondary }]}>{label}</Text>
    </Animated.View>
  );
}

export const ProfileStatsSection = React.memo(function ProfileStatsSection({
  stats,
  connectionCount,
  winRate,
  isOwnProfile,
  dmUnread = 0,
  onChatPress,
}: ProfileStatsSectionProps) {
  const { colors } = useTheme();
  const accuracy =
    stats.total_attempts > 0
      ? Math.round((stats.correct_attempts / stats.total_attempts) * 100)
      : 0;

  const statItems = [
    { label: 'Attempts', value: String(stats.total_attempts), color: colors.primary },
    { label: 'Correct', value: String(stats.correct_attempts), color: colors.success },
    { label: 'Accuracy', value: `${accuracy}%`, color: colors.secondary },
    {
      label: 'Best Time',
      value: stats.best_time > 0 ? `${(stats.best_time / 1000).toFixed(1)}s` : '-',
      color: colors.warning,
    },
    {
      label: 'Avg Time',
      value: stats.avg_time > 0 ? `${(stats.avg_time / 1000).toFixed(1)}s` : '-',
      color: colors.text,
    },
    { label: 'Connections', value: String(connectionCount), color: colors.primary },
    { label: 'Win Rate', value: `${winRate}%`, color: colors.correct },
  ];

  return (
    <Card style={styles.card} padding="lg">
      {isOwnProfile && onChatPress && (
        <Pressable
          onPress={onChatPress}
          style={[styles.messagesRow, { borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
        >
          <View style={styles.messagesLeft}>
            <View style={[styles.messagesIcon, { backgroundColor: `${colors.primary}16` }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.messagesTitle, { color: colors.text }]}>Chat</Text>
              <Text style={[styles.messagesHint, { color: colors.textSecondary }]}>Open your DM inbox</Text>
            </View>
          </View>
          <View style={styles.messagesRight}>
            {dmUnread > 0 && (
              <View style={[styles.messagesBadge, { backgroundColor: colors.wrong }]}>
                <Text style={styles.messagesBadgeText}>{dmUnread > 99 ? '99+' : dmUnread}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </View>
        </Pressable>
      )}

      <ProfileSectionHeading
        icon="stats-chart-outline"
        title="Your Statistics"
        subtitle="Performance overview"
      />
      <View style={styles.statsGrid}>
        {statItems.map((item, index) => (
          <StatBox key={item.label} label={item.label} value={item.value} color={item.color} index={index} />
        ))}
      </View>
    </Card>
  );
});

const statStyles = StyleSheet.create({
  box: {
    flex: 1,
    minWidth: 100,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 9999, marginBottom: spacing.xs },
  value: { fontSize: fontSize.xl, fontWeight: fontWeight.black, marginBottom: 2 },
  label: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, textAlign: 'center' },
});

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  messagesRow: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  messagesLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  messagesIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
  messagesHint: { fontSize: fontSize.xs, marginTop: 2 },
  messagesRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  messagesBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesBadgeText: { color: '#fff', fontSize: 11, fontWeight: fontWeight.bold },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
