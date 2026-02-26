import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import { castVote, loadPoll } from '@/lib/polls';
import { showAlert } from '@/lib/alert';
import type { ChatPoll } from '@/lib/types';

interface PollBubbleProps {
  pollId: string;
  currentUserId: string | null;
}

export function PollBubble({ pollId, currentUserId }: PollBubbleProps) {
  const { colors } = useTheme();
  const [poll, setPoll] = useState<ChatPoll | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  const reload = async () => {
    if (!currentUserId) return;
    try {
      const data = await loadPoll(pollId, currentUserId);
      setPoll(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollId, currentUserId]);

  async function handleVote(optionId: string) {
    if (!poll || voting) return;
    const isEnded = poll.ends_at && new Date(poll.ends_at) < new Date();
    if (isEnded) return;

    const alreadyVoted = !poll.is_multiple_choice && poll.options.some((o) => o.voted_by_me);
    if (alreadyVoted) return;

    setVoting(true);
    try {
      await castVote(poll.id, optionId);
      if (currentUserId) {
        const updated = await loadPoll(poll.id, currentUserId);
        setPoll(updated);
      }
    } catch (e: any) {
      showAlert('Vote failed', e?.message ?? 'Could not record vote');
    } finally {
      setVoting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!poll) {
    return (
      <Text style={[styles.errorText, { color: colors.textSecondary }]}>Poll unavailable</Text>
    );
  }

  const totalVotes = poll.options.reduce((sum, o) => sum + o.vote_count, 0);
  const isEnded = poll.ends_at ? new Date(poll.ends_at) < new Date() : false;
  const hasVotedSingle = !poll.is_multiple_choice && poll.options.some((o) => o.voted_by_me);
  const canVote = !isEnded && !hasVotedSingle;

  return (
    <View style={[styles.container, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}30`, borderWidth: 1, borderRadius: borderRadius.lg }]}>
      <View style={styles.headerRow}>
        <Ionicons name="bar-chart-outline" size={14} color={colors.primary} />
        <Text style={[styles.pollLabel, { color: colors.primary }]}>
          {poll.is_multiple_choice ? 'Multiple choice' : 'Poll'}{isEnded ? ' · Ended' : ''}
        </Text>
      </View>
      <Text style={[styles.question, { color: colors.text }]}>{poll.question}</Text>
      <View style={styles.options}>
        {poll.options.map((option) => {
          const percent = totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0;
          const isSelected = option.voted_by_me;
          return (
            <Pressable
              key={option.id}
              onPress={() => canVote && handleVote(option.id)}
              disabled={!canVote || voting}
              style={[styles.optionRow, { borderColor: isSelected ? colors.primary : colors.border }]}
            >
              <View style={styles.optionBarWrap}>
                <View
                  style={[
                    styles.optionBar,
                    {
                      width: `${percent}%`,
                      backgroundColor: isSelected ? `${colors.primary}30` : `${colors.textTertiary}20`,
                    },
                  ]}
                />
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionText, { color: colors.text }]} numberOfLines={2}>
                  {option.text}
                </Text>
                {(hasVotedSingle || isEnded) && (
                  <Text style={[styles.optionPercent, { color: isSelected ? colors.primary : colors.textSecondary }]}>
                    {percent}%
                  </Text>
                )}
              </View>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={styles.checkmark} />
              )}
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.footer, { color: colors.textTertiary }]}>
        {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        {isEnded ? '' : canVote ? ' · Tap to vote' : ' · Voted'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { padding: spacing.md, alignItems: 'center' },
  errorText: { fontSize: fontSize.sm, fontStyle: 'italic' },
  container: { padding: spacing.sm, gap: spacing.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pollLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  question: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, lineHeight: fontSize.sm * 1.4 },
  options: { gap: spacing.xs },
  optionRow: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 36,
    justifyContent: 'center',
  },
  optionBarWrap: { ...StyleSheet.absoluteFillObject },
  optionBar: { height: '100%' },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: spacing.xs,
  },
  optionText: { flex: 1, fontSize: fontSize.sm },
  optionPercent: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, minWidth: 32, textAlign: 'right' },
  checkmark: { marginRight: spacing.xs },
  footer: { fontSize: fontSize.xs, textAlign: 'right' },
});
