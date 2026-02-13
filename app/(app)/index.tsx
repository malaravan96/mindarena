import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { showAlert, showConfirm } from '@/lib/alert';
import { offlinePuzzles, Puzzle } from '@/lib/puzzles';
import { todayKey } from '@/lib/date';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';

type DbPuzzle = {
  id: string;
  date_key: string;
  title: string;
  prompt: string;
  type: string;
  options: string[];
  answer_index: number;
};

type ExistingAttempt = {
  selected_index: number;
  is_correct: boolean;
  ms_taken: number;
};

export default function Home() {
  const router = useRouter();
  const { colors } = useTheme();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [loading, setLoading] = useState(true);
  const [existingAttempt, setExistingAttempt] = useState<ExistingAttempt | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dayKey = useMemo(() => todayKey(), []);

  // Live timer
  useEffect(() => {
    if (status === 'idle' && startedAt && !existingAttempt) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, startedAt, existingAttempt]);

  useEffect(() => {
    loadPuzzle();
  }, [dayKey]);

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
        const p: Puzzle = {
          id: data.id,
          date_key: data.date_key,
          title: data.title,
          prompt: data.prompt,
          type: data.type as Puzzle['type'],
          options: data.options,
          answer_index: data.answer_index,
        };
        setPuzzle(p);

        // Check if user already attempted this puzzle
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (uid) {
          const { data: attempt } = await supabase
            .from('attempts')
            .select('selected_index, is_correct, ms_taken')
            .eq('user_id', uid)
            .eq('puzzle_id', data.id)
            .maybeSingle<ExistingAttempt>();

          if (attempt) {
            setExistingAttempt(attempt);
            setSelected(attempt.selected_index);
            setStatus(attempt.is_correct ? 'correct' : 'wrong');
            setElapsed(Math.floor(attempt.ms_taken / 1000));
            return;
          }
        }
      } else {
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
    if (!puzzle || selected === null || !startedAt) return;

    const ms = Date.now() - startedAt;
    const correct = selected === puzzle.answer_index;
    setStatus(correct ? 'correct' : 'wrong');
    setElapsed(Math.floor(ms / 1000));

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
        });

        if (error) {
          if (error.code === '23505') {
            // Duplicate - user already submitted (race condition guard)
            return;
          }
          throw error;
        }
      } catch (e: any) {
        if (e?.code !== '23505') {
          showAlert('Save failed', e?.message ?? 'Unknown error');
        }
      } finally {
        setSubmitting(false);
      }
    }
  }

  async function signOut() {
    const confirmed = await showConfirm('Sign out', 'Are you sure you want to sign out?', 'Sign out');
    if (confirmed) {
      await supabase.auth.signOut();
    }
  }

  const getPuzzleTypeColor = (type: string) => {
    switch (type) {
      case 'pattern': return '#f59e0b';
      case 'logic': return '#8b5cf6';
      case 'math': return '#10b981';
      default: return colors.primary;
    }
  };

  const getPuzzleTypeEmoji = (type: string) => {
    switch (type) {
      case 'pattern': return '🔍';
      case 'logic': return '🧩';
      case 'math': return '🔢';
      default: return '🧠';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading today's puzzle...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!puzzle) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <Text style={[styles.errorText, { color: colors.error }]}>Failed to load puzzle</Text>
          <Button title="Try Again" onPress={loadPuzzle} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  const alreadyAnswered = !!existingAttempt || status !== 'idle';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.appTitle, { color: colors.text }]}>MindArena</Text>
          <View style={[styles.dateBadge, { backgroundColor: `${colors.warning}20` }]}>
            <Text style={[styles.dateBadgeText, { color: colors.warning }]}>{dayKey}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => router.push('/leaderboard')}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceVariant }]}
          >
            <Text style={styles.iconBtnText}>🏆</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/profile')}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceVariant }]}
          >
            <Text style={styles.iconBtnText}>👤</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 720 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Type + Timer */}
        <View style={styles.metaRow}>
          <View style={[styles.typeBadge, { backgroundColor: `${getPuzzleTypeColor(puzzle.type)}15` }]}>
            <Text style={styles.typeEmoji}>{getPuzzleTypeEmoji(puzzle.type)}</Text>
            <Text style={[styles.typeText, { color: getPuzzleTypeColor(puzzle.type) }]}>
              {puzzle.type.charAt(0).toUpperCase() + puzzle.type.slice(1)}
            </Text>
          </View>
          <View style={[styles.timerBadge, { backgroundColor: colors.surfaceVariant }]}>
            <Text style={[styles.timerText, { color: colors.textSecondary }]}>
              ⏱ {elapsed}s
            </Text>
          </View>
        </View>

        {/* Puzzle */}
        <Card style={styles.puzzleCard} padding="lg">
          <Text style={[styles.puzzleTitle, { color: colors.text }]}>{puzzle.title}</Text>
          <Text style={[styles.puzzlePrompt, { color: colors.text }]}>{puzzle.prompt}</Text>

          {/* Options */}
          <View style={styles.optionsWrap}>
            {puzzle.options.map((opt, i) => {
              const active = selected === i;
              const showAnswer = status !== 'idle';
              const isCorrect = i === puzzle.answer_index;
              const isWrong = showAnswer && active && !isCorrect;

              let borderColor = colors.border;
              let bgColor = colors.surface;
              let textColor = colors.text;
              let letterBg = 'transparent';
              let badge: string | null = null;

              if (active && !showAnswer) {
                borderColor = colors.primary;
                bgColor = `${colors.primary}08`;
                textColor = colors.primary;
              }
              if (showAnswer && isCorrect) {
                borderColor = colors.correct;
                bgColor = `${colors.correct}10`;
                textColor = colors.correct;
                badge = '✓';
              }
              if (isWrong) {
                borderColor = colors.wrong;
                bgColor = `${colors.wrong}10`;
                textColor = colors.wrong;
                badge = '✗';
              }

              return (
                <Pressable
                  key={i}
                  onPress={() => !alreadyAnswered && setSelected(i)}
                  disabled={alreadyAnswered}
                  style={[styles.option, { borderColor, backgroundColor: bgColor }]}
                >
                  <View style={styles.optionContent}>
                    <View style={[styles.optionLetter, { borderColor }]}>
                      <Text style={[styles.optionLetterText, { color: textColor }]}>
                        {String.fromCharCode(65 + i)}
                      </Text>
                    </View>
                    <Text style={[styles.optionText, { color: textColor }]}>{opt}</Text>
                  </View>
                  {badge && (
                    <View
                      style={[
                        styles.optionBadge,
                        { backgroundColor: isWrong ? colors.wrong : colors.correct },
                      ]}
                    >
                      <Text style={styles.optionBadgeText}>{badge}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Submit */}
          {status === 'idle' && !existingAttempt && (
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

          {/* Results */}
          {status === 'correct' && (
            <View style={[styles.resultCard, { backgroundColor: `${colors.correct}10` }]}>
              <Text style={styles.resultEmoji}>🎉</Text>
              <Text style={[styles.resultTitle, { color: colors.correct }]}>Correct!</Text>
              <Text style={[styles.resultMsg, { color: colors.textSecondary }]}>
                {existingAttempt
                  ? `You solved it in ${(existingAttempt.ms_taken / 1000).toFixed(1)}s`
                  : `Solved in ${elapsed}s`}
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
              <Text style={[styles.resultMsg, { color: colors.textSecondary }]}>
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
          <View style={[styles.offlineBar, { backgroundColor: colors.surfaceVariant }]}>
            <Text style={[styles.offlineText, { color: colors.textSecondary }]}>
              📱 Offline mode - connect Supabase for leaderboards
            </Text>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickRow}>
          <Pressable
            style={[styles.quickAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/leaderboard')}
          >
            <Text style={styles.quickIcon}>🏆</Text>
            <Text style={[styles.quickLabel, { color: colors.text }]}>Leaderboard</Text>
          </Pressable>
          <Pressable
            style={[styles.quickAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/profile')}
          >
            <Text style={styles.quickIcon}>👤</Text>
            <Text style={[styles.quickLabel, { color: colors.text }]}>Profile</Text>
          </Pressable>
          <Pressable
            style={[styles.quickAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={signOut}
          >
            <Text style={styles.quickIcon}>🚪</Text>
            <Text style={[styles.quickLabel, { color: colors.text }]}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { fontSize: fontSize.base, fontWeight: fontWeight.medium },
  errorText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  appTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  dateBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  dateBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  headerRight: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnText: { fontSize: 18 },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%', paddingBottom: spacing.xl },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  typeEmoji: { fontSize: fontSize.lg },
  typeText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  timerBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  timerText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  puzzleCard: { marginBottom: spacing.md },
  puzzleTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.black,
    marginBottom: spacing.sm,
  },
  puzzlePrompt: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.lg * 1.6,
    marginBottom: spacing.lg,
  },
  optionsWrap: { gap: spacing.sm },
  option: {
    borderWidth: 2,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  optionLetter: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLetterText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  optionText: { fontSize: fontSize.base, flex: 1 },
  optionBadge: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionBadgeText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  resultCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  resultEmoji: { fontSize: 48, marginBottom: spacing.sm },
  resultTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black, marginBottom: spacing.xs },
  resultMsg: { fontSize: fontSize.base, textAlign: 'center', marginBottom: spacing.sm },

  offlineBar: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  offlineText: { fontSize: fontSize.sm },

  quickRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  quickIcon: { fontSize: 24, marginBottom: spacing.xs },
  quickLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
