import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { ProfileSectionHeading } from './ProfileSectionHeading';
import { getEventDescription, getEventIcon } from '@/lib/activityFeed';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';
import type { PuzzleAttempt, ActivityFeedItem } from '@/lib/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface ProfileActivitySectionProps {
  recentAttempts: PuzzleAttempt[];
  activityFeed: ActivityFeedItem[];
  isOwnProfile: boolean;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export const ProfileActivitySection = React.memo(function ProfileActivitySection({
  recentAttempts,
  activityFeed,
  isOwnProfile,
}: ProfileActivitySectionProps) {
  const { colors } = useTheme();

  return (
    <>
      <Card style={styles.card} padding="lg">
        <ProfileSectionHeading
          icon="time-outline"
          title="Recent Puzzles"
          subtitle="Your latest attempts"
        />
        {recentAttempts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="hourglass-outline" size={20} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No puzzle attempts yet. Solve your first puzzle!
            </Text>
          </View>
        ) : (
          recentAttempts.map((attempt, index) => (
            <Animated.View
              key={attempt.id}
              entering={FadeIn.delay(100 + index * 50).duration(250)}
              style={[
                styles.historyRow,
                { borderColor: colors.border, backgroundColor: colors.surfaceVariant },
              ]}
            >
              <View
                style={[
                  styles.historyIndicator,
                  { backgroundColor: attempt.is_correct ? colors.correct : colors.wrong },
                ]}
              />
              <View style={styles.historyInfo}>
                <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>
                  {attempt.puzzle_title}
                </Text>
                <Text style={[styles.historyMeta, { color: colors.textSecondary }]}>
                  {new Date(attempt.created_at).toLocaleDateString()} -{' '}
                  {(attempt.ms_taken / 1000).toFixed(1)}s
                </Text>
              </View>
              <View
                style={[
                  styles.resultPill,
                  {
                    backgroundColor: attempt.is_correct
                      ? `${colors.correct}15`
                      : `${colors.wrong}15`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.historyResult,
                    { color: attempt.is_correct ? colors.correct : colors.wrong },
                  ]}
                >
                  {attempt.is_correct ? 'Correct' : 'Wrong'}
                </Text>
              </View>
            </Animated.View>
          ))
        )}
      </Card>

      {activityFeed.length > 0 && (
        <Card style={styles.card} padding="lg">
          <ProfileSectionHeading
            icon="newspaper-outline"
            title="Activity Feed"
            subtitle="Recent milestones and events"
          />
          {activityFeed.map((event, index) => (
            <Animated.View
              key={event.id}
              entering={FadeIn.delay(100 + index * 50).duration(250)}
              style={[styles.feedRow, { borderColor: colors.border }]}
            >
              <View style={[styles.feedIcon, { backgroundColor: `${colors.primary}12` }]}>
                <Ionicons
                  name={getEventIcon(event.event_type) as IconName}
                  size={16}
                  color={colors.primary}
                />
              </View>
              <View style={styles.feedInfo}>
                <Text style={[styles.feedText, { color: colors.text }]} numberOfLines={2}>
                  {getEventDescription(event)}
                </Text>
                <Text style={[styles.feedTime, { color: colors.textTertiary }]}>
                  {timeAgo(event.created_at)}
                </Text>
              </View>
            </Animated.View>
          ))}
        </Card>
      )}
    </>
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
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  historyIndicator: {
    width: 9,
    height: 9,
    borderRadius: 9999,
  },
  historyInfo: { flex: 1, minWidth: 0 },
  historyTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  historyMeta: { fontSize: fontSize.xs, marginTop: 2 },
  resultPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  historyResult: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  feedIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedInfo: { flex: 1 },
  feedText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  feedTime: { fontSize: fontSize.xs, marginTop: 2 },
});
