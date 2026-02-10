import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { offlinePuzzles, Puzzle } from '@/lib/puzzles';
import { todayKey } from '@/lib/date';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Container } from '@/components/Container';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop, isTablet } from '@/constants/theme';

type DbPuzzle = {
  id: string;
  date_key: string;
  title: string;
  prompt: string;
  type: string;
  options: string[];
  answer_index: number;
};

export default function Home() {
  const router = useRouter();
  const { colors } = useTheme();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  const dayKey = useMemo(() => todayKey(), []);

  useEffect(() => {
    loadPuzzle();
    loadUserInfo();
  }, [dayKey]);

  async function loadUserInfo() {
    const { data: userData } = await supabase.auth.getUser();
    setUserEmail(userData.user?.email ?? '');
  }

  async function loadPuzzle() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('puzzles')
        .select('*')
        .eq('date_key', dayKey)
        .limit(1)
        .maybeSingle<DbPuzzle>();

      if (error) throw error;
      if (data) {
        setPuzzle({
          id: data.id,
          date_key: data.date_key,
          title: data.title,
          prompt: data.prompt,
          type: data.type as any,
          options: data.options,
          answer_index: data.answer_index,
        });
      } else {
        // Offline fallback
        setPuzzle(offlinePuzzles[new Date().getDate() % offlinePuzzles.length]);
      }
    } catch {
      setPuzzle(offlinePuzzles[new Date().getDate() % offlinePuzzles.length]);
    } finally {
      setStartedAt(Date.now());
      setLoading(false);
    }
  }

  async function submit() {
    if (!puzzle) return;
    if (selected === null) {
      Alert.alert('Select an answer', 'Please choose one of the options before submitting.');
      return;
    }
    if (!startedAt) return;

    const ms = Date.now() - startedAt;
    const correct = selected === puzzle.answer_index;
    setStatus(correct ? 'correct' : 'wrong');

    // Save attempt only if puzzle is from Supabase (not offline)
    if (!puzzle.id.startsWith('offline')) {
      setSubmitting(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) throw new Error('Not signed in');

        const { error } = await supabase.from('attempts').insert({
          user_id: uid,
          puzzle_id: puzzle.id,
          ms_taken: ms,
          is_correct: correct,
          selected_index: selected,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      } catch (e: any) {
        Alert.alert('Save failed', e?.message ?? 'Unknown error');
      } finally {
        setSubmitting(false);
      }
    }
  }

  async function signOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  const getPuzzleTypeColor = (type: string) => {
    switch (type) {
      case 'pattern':
        return '#f59e0b';
      case 'logic':
        return '#8b5cf6';
      case 'math':
        return '#10b981';
      default:
        return colors.primary;
    }
  };

  const getPuzzleTypeEmoji = (type: string) => {
    switch (type) {
      case 'pattern':
        return '🔍';
      case 'logic':
        return '🧩';
      case 'math':
        return '🔢';
      default:
        return '🧠';
    }
  };

  if (loading) {
    return (
      <Container centered>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: spacing.md }]}>
          Loading today's puzzle...
        </Text>
      </Container>
    );
  }

  if (!puzzle) {
    return (
      <Container centered>
        <Text style={[styles.errorText, { color: colors.error }]}>Failed to load puzzle</Text>
        <Button title="Try Again" onPress={loadPuzzle} style={{ marginTop: spacing.lg }} />
      </Container>
    );
  }

  const timeElapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.appTitle, { color: colors.text }]}>MindArena</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>🔥 {dayKey}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => router.push('/leaderboard')}
            style={[styles.iconButton, { backgroundColor: colors.surfaceVariant }]}
          >
            <Text style={styles.iconButtonText}>🏆</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/profile')}
            style={[styles.iconButton, { backgroundColor: colors.surfaceVariant }]}
          >
            <Text style={styles.iconButtonText}>👤</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 800 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Puzzle Type Badge */}
        <View style={styles.puzzleTypeContainer}>
          <View
            style={[
              styles.puzzleTypeBadge,
              { backgroundColor: `${getPuzzleTypeColor(puzzle.type)}20` },
            ]}
          >
            <Text style={styles.puzzleTypeEmoji}>{getPuzzleTypeEmoji(puzzle.type)}</Text>
            <Text
              style={[
                styles.puzzleTypeText,
                { color: getPuzzleTypeColor(puzzle.type), fontWeight: fontWeight.bold },
              ]}
            >
              {puzzle.title}
            </Text>
          </View>
          {status === 'idle' && (
            <View style={[styles.timerBadge, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.timerText, { color: colors.textSecondary }]}>
                ⏱️ {timeElapsed}s
              </Text>
            </View>
          )}
        </View>

        {/* Puzzle Card */}
        <Card style={styles.puzzleCard}>
          <Text style={[styles.puzzleTitle, { color: colors.text }]}>Today's Challenge</Text>
          <Text style={[styles.puzzlePrompt, { color: colors.text }]}>{puzzle.prompt}</Text>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {puzzle.options.map((opt, i) => {
              const active = selected === i;
              const showAnswer = status !== 'idle';
              const isCorrect = i === puzzle.answer_index;
              const isWrong = showAnswer && active && !isCorrect;

              const optionStyle: any[] = [
                styles.option,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ];
              const optionTextStyle: any[] = [styles.optionText, { color: colors.text }];
              let badgeStyle: any = null;

              if (active && status === 'idle') {
                optionStyle.push({
                  borderColor: colors.primary,
                  backgroundColor: `${colors.primary}10`,
                });
                optionTextStyle.push({ color: colors.primary, fontWeight: fontWeight.bold });
              }

              if (showAnswer && isCorrect) {
                optionStyle.push({
                  borderColor: colors.correct,
                  backgroundColor: `${colors.correct}10`,
                });
                optionTextStyle.push({ color: colors.correct, fontWeight: fontWeight.bold });
                badgeStyle = { backgroundColor: colors.correct };
              }

              if (isWrong) {
                optionStyle.push({
                  borderColor: colors.wrong,
                  backgroundColor: `${colors.wrong}10`,
                });
                optionTextStyle.push({ color: colors.wrong, fontWeight: fontWeight.bold });
                badgeStyle = { backgroundColor: colors.wrong };
              }

              return (
                <Pressable
                  key={i}
                  onPress={() => status === 'idle' && setSelected(i)}
                  disabled={status !== 'idle'}
                  style={optionStyle}
                >
                  <View style={styles.optionContent}>
                    <View style={[styles.optionLetter, { borderColor: colors.border }]}>
                      <Text style={[styles.optionLetterText, { color: colors.textSecondary }]}>
                        {String.fromCharCode(65 + i)}
                      </Text>
                    </View>
                    <Text style={optionTextStyle}>{opt}</Text>
                  </View>
                  {showAnswer && isCorrect && (
                    <View style={[styles.optionBadge, badgeStyle]}>
                      <Text style={styles.optionBadgeText}>✓</Text>
                    </View>
                  )}
                  {isWrong && (
                    <View style={[styles.optionBadge, badgeStyle]}>
                      <Text style={styles.optionBadgeText}>✗</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Submit Button */}
          {status === 'idle' && (
            <Button
              title={submitting ? 'Submitting...' : 'Submit Answer'}
              onPress={submit}
              disabled={submitting || selected === null}
              loading={submitting}
              fullWidth
              size="lg"
              style={{ marginTop: spacing.lg }}
            />
          )}

          {/* Result */}
          {status === 'correct' && (
            <View style={[styles.resultCard, { backgroundColor: `${colors.correct}10` }]}>
              <Text style={styles.resultEmoji}>🎉</Text>
              <Text style={[styles.resultTitle, { color: colors.correct }]}>Correct!</Text>
              <Text style={[styles.resultMessage, { color: colors.textSecondary }]}>
                You solved it in {Math.floor(timeElapsed)} seconds!
              </Text>
              <Button
                title="View Leaderboard"
                onPress={() => router.push('/leaderboard')}
                variant="secondary"
                fullWidth
                style={{ marginTop: spacing.md }}
              />
            </View>
          )}

          {status === 'wrong' && (
            <View style={[styles.resultCard, { backgroundColor: `${colors.wrong}10` }]}>
              <Text style={styles.resultEmoji}>😔</Text>
              <Text style={[styles.resultTitle, { color: colors.wrong }]}>Not quite!</Text>
              <Text style={[styles.resultMessage, { color: colors.textSecondary }]}>
                The correct answer is highlighted above. Try again tomorrow!
              </Text>
              <Button
                title="View Leaderboard"
                onPress={() => router.push('/leaderboard')}
                variant="outline"
                fullWidth
                style={{ marginTop: spacing.md }}
              />
            </View>
          )}
        </Card>

        {/* Offline Notice */}
        {puzzle.id.startsWith('offline') && (
          <Card style={styles.offlineCard} elevated={false}>
            <View style={{ backgroundColor: colors.surfaceVariant, padding: spacing.md, borderRadius: borderRadius.md }}>
              <Text style={[styles.offlineTitle, { color: colors.textSecondary }]}>
                📱 Offline Mode
              </Text>
              <Text style={[styles.offlineText, { color: colors.textTertiary }]}>
                Connect to Supabase to enable leaderboards and save your progress
              </Text>
            </View>
          </Card>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Pressable
            style={[styles.quickAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/leaderboard')}
          >
            <Text style={styles.quickActionIcon}>🏆</Text>
            <Text style={[styles.quickActionText, { color: colors.text }]}>Leaderboard</Text>
          </Pressable>
          <Pressable
            style={[styles.quickAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/profile')}
          >
            <Text style={styles.quickActionIcon}>👤</Text>
            <Text style={[styles.quickActionText, { color: colors.text }]}>Profile</Text>
          </Pressable>
          <Pressable
            style={[styles.quickAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={signOut}
          >
            <Text style={styles.quickActionIcon}>🚪</Text>
            <Text style={[styles.quickActionText, { color: colors.text }]}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  appTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black,
  },
  headerBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    backgroundColor: '#fef3c7',
  },
  headerBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  headerRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonText: {
    fontSize: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    alignSelf: 'center',
    width: '100%',
  },
  puzzleTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  puzzleTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  puzzleTypeEmoji: {
    fontSize: fontSize.lg,
  },
  puzzleTypeText: {
    fontSize: fontSize.base,
  },
  timerBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  timerText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  puzzleCard: {
    marginBottom: spacing.md,
  },
  puzzleTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.black,
    marginBottom: spacing.md,
  },
  puzzlePrompt: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.lg * 1.5,
    marginBottom: spacing.lg,
  },
  optionsContainer: {
    gap: spacing.md,
  },
  option: {
    borderWidth: 2,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  optionLetter: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLetterText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  optionText: {
    fontSize: fontSize.base,
    flex: 1,
  },
  optionBadge: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionBadgeText: {
    color: '#ffffff',
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  resultCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  resultEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  resultTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.black,
    marginBottom: spacing.xs,
  },
  resultMessage: {
    fontSize: fontSize.base,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  offlineCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  offlineTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  offlineText: {
    fontSize: fontSize.sm,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  quickActionIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  quickActionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  loadingText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  errorText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
});
