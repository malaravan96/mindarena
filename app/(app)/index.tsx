import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { offlinePuzzles, Puzzle, PuzzleType } from '@/lib/puzzles';
import { todayKey } from '@/lib/date';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

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

const puzzleCategories: { type: PuzzleType; label: string; icon: IconName }[] = [
  { type: 'pattern', label: 'Pattern', icon: 'color-filter-outline' },
  { type: 'logic', label: 'Logic', icon: 'git-merge-outline' },
  { type: 'math', label: 'Math', icon: 'calculator-outline' },
  { type: 'word', label: 'Word', icon: 'text-outline' },
  { type: 'memory', label: 'Memory', icon: 'albums-outline' },
  { type: 'visual', label: 'Visual', icon: 'eye-outline' },
  { type: 'spatial', label: 'Spatial', icon: 'grid-outline' },
  { type: 'trivia', label: 'Trivia', icon: 'help-circle-outline' },
];

const dailyTips = [
  'Regular puzzle-solving can improve cognitive flexibility and problem-solving skills.',
  'Taking short breaks between puzzles helps your brain consolidate what you learned.',
  'Try to solve puzzles at the same time each day to build a healthy habit.',
  'Working on different puzzle types exercises different parts of your brain.',
  'Speed improves with practice - focus on accuracy first, then build speed.',
  'Discuss puzzles with friends to see different approaches and learn new strategies.',
  'Sleep plays a crucial role in memory consolidation - rest well to think well.',
];

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
  const [userStreak, setUserStreak] = useState(0);
  const [userPoints, setUserPoints] = useState(0);
  const [solversCount, setSolversCount] = useState(0);
  const [userRank, setUserRank] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const dayKey = useMemo(() => todayKey(), []);
  const dailyTip = useMemo(() => dailyTips[new Date().getDate() % dailyTips.length], []);

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
    loadUserInfo();
  }, [dayKey]);

  async function loadUserInfo() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('total_points, streak_count')
        .eq('id', uid)
        .maybeSingle<{ total_points: number; streak_count: number }>();

      if (profileData) {
        setUserStreak(profileData.streak_count ?? 0);
        setUserPoints(profileData.total_points ?? 0);
      }
    } catch {
      // silently fail
    }
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

        const { count } = await supabase
          .from('attempts')
          .select('*', { count: 'exact', head: true })
          .eq('puzzle_id', data.id)
          .eq('is_correct', true);
        setSolversCount(count ?? 0);

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

            if (attempt.is_correct) {
              const { count: fasterCount } = await supabase
                .from('attempts')
                .select('*', { count: 'exact', head: true })
                .eq('puzzle_id', data.id)
                .eq('is_correct', true)
                .lt('ms_taken', attempt.ms_taken);
              setUserRank((fasterCount ?? 0) + 1);
            }
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

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.985,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

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
          if (error.code === '23505') return;
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading today&apos;s challenge...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!puzzle) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>Failed to load puzzle</Text>
          <Button title="Try Again" onPress={loadPuzzle} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  const alreadyAnswered = !!existingAttempt || status !== 'idle';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.backgroundLayer} pointerEvents="none">
        <View style={[styles.bgOrbTop, { backgroundColor: `${colors.primary}18` }]} />
        <View style={[styles.bgOrbBottom, { backgroundColor: `${colors.secondary}16` }]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroGlow} />
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroEyebrow}>Daily Challenge</Text>
              <Text style={styles.heroTitle}>MindArena</Text>
            </View>
            <View style={styles.dayBadge}>
              <Ionicons name="calendar-outline" size={14} color="#ffffff" />
              <Text style={styles.dayBadgeText}>{dayKey}</Text>
            </View>
          </View>
          <Text style={styles.heroSubtitle}>Solve today&apos;s puzzle and keep your momentum.</Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatPill}>
              <Ionicons name="flame-outline" size={16} color="#ffffff" />
              <View>
                <Text style={styles.heroStatValue}>{userStreak}</Text>
                <Text style={styles.heroStatLabel}>Day streak</Text>
              </View>
            </View>
            <View style={styles.heroStatPill}>
              <Ionicons name="star-outline" size={16} color="#ffffff" />
              <View>
                <Text style={styles.heroStatValue}>{userPoints}</Text>
                <Text style={styles.heroStatLabel}>Total points</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.sectionRow}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Puzzle Tracks</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Today&apos;s category is highlighted
            </Text>
          </View>
          <FlatList
            horizontal
            data={puzzleCategories}
            keyExtractor={(item) => item.type}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesRow}
            renderItem={({ item }) => {
              const active = puzzle.type === item.type;
              return (
                <View
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: active ? `${colors.primary}14` : colors.surface,
                      borderColor: active ? `${colors.primary}45` : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={active ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      { color: active ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              );
            }}
          />
        </View>

        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Card style={styles.challengeCard} padding="lg">
            <View style={styles.challengeMetaRow}>
              <View style={[styles.typePill, { backgroundColor: `${colors.primary}12` }]}>
                <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                <Text style={[styles.typePillText, { color: colors.primary }]}>
                  Daily {puzzle.type.charAt(0).toUpperCase() + puzzle.type.slice(1)}
                </Text>
              </View>
              <View style={[styles.timerPill, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.timerPillText, { color: colors.textSecondary }]}>{elapsed}s</Text>
              </View>
            </View>

            <Text style={[styles.challengeTitle, { color: colors.text }]}>{puzzle.title}</Text>
            <Text style={[styles.challengePrompt, { color: colors.text }]}>{puzzle.prompt}</Text>

            <View style={styles.optionsWrap}>
              {puzzle.options.map((opt, i) => {
                const active = selected === i;
                const showAnswer = status !== 'idle';
                const isCorrect = i === puzzle.answer_index;
                const isWrong = showAnswer && active && !isCorrect;

                let borderColor = colors.border;
                let bgColor = colors.surface;
                let textColor = colors.text;
                let badgeIcon: 'checkmark-circle' | 'close-circle' | null = null;
                let badgeColor = '';

                if (active && !showAnswer) {
                  borderColor = colors.primary;
                  bgColor = `${colors.primary}08`;
                  textColor = colors.primary;
                }

                if (showAnswer) {
                  if (isCorrect) {
                    borderColor = colors.correct;
                    bgColor = `${colors.correct}10`;
                    textColor = colors.correct;
                    badgeIcon = 'checkmark-circle';
                    badgeColor = colors.correct;
                  } else if (isWrong) {
                    borderColor = colors.wrong;
                    bgColor = `${colors.wrong}10`;
                    textColor = colors.wrong;
                    badgeIcon = 'close-circle';
                    badgeColor = colors.wrong;
                  } else {
                    textColor = colors.textTertiary;
                  }
                }

                return (
                  <Pressable
                    key={i}
                    onPressIn={alreadyAnswered ? undefined : handlePressIn}
                    onPressOut={alreadyAnswered ? undefined : handlePressOut}
                    onPress={() => !alreadyAnswered && setSelected(i)}
                    disabled={alreadyAnswered}
                    style={[
                      styles.option,
                      {
                        borderColor,
                        backgroundColor: bgColor,
                        opacity: showAnswer && !isCorrect && !isWrong ? 0.6 : 1,
                      },
                    ]}
                  >
                    <View style={styles.optionContent}>
                      <View
                        style={[
                          styles.optionLetter,
                          {
                            borderColor,
                            backgroundColor:
                              active && !showAnswer
                                ? borderColor
                                : showAnswer && isCorrect
                                  ? borderColor
                                  : 'transparent',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionLetterText,
                            {
                              color:
                                active && !showAnswer
                                  ? '#fff'
                                  : showAnswer && isCorrect
                                    ? '#fff'
                                    : textColor,
                            },
                          ]}
                        >
                          {String.fromCharCode(65 + i)}
                        </Text>
                      </View>
                      <Text style={[styles.optionText, { color: textColor }]}>{opt}</Text>
                    </View>
                    {badgeIcon && <Ionicons name={badgeIcon} size={22} color={badgeColor} />}
                  </Pressable>
                );
              })}
            </View>

            {status === 'idle' && !existingAttempt && (
              <Button
                title={submitting ? 'Submitting...' : 'Submit Answer'}
                onPress={submit}
                disabled={submitting || selected === null}
                loading={submitting}
                variant="gradient"
                fullWidth
                size="lg"
                style={styles.submitBtn}
              />
            )}

            {status === 'correct' && (
              <View style={[styles.resultCard, { backgroundColor: `${colors.correct}14` }]}>
                <Ionicons name="trophy-outline" size={28} color={colors.correct} />
                <View style={styles.resultTextWrap}>
                  <Text style={[styles.resultTitle, { color: colors.correct }]}>Correct answer</Text>
                  <Text style={[styles.resultMsg, { color: colors.textSecondary }]}>
                    {existingAttempt
                      ? `You solved it in ${(existingAttempt.ms_taken / 1000).toFixed(1)}s`
                      : `Solved in ${elapsed}s`}
                    {userRank ? ` - Rank #${userRank}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => router.push('/leaderboard')}>
                  <Ionicons name="arrow-forward-circle" size={28} color={colors.correct} />
                </Pressable>
              </View>
            )}

            {status === 'wrong' && (
              <View style={[styles.resultCard, { backgroundColor: `${colors.wrong}14` }]}>
                <Ionicons name="alert-circle-outline" size={28} color={colors.wrong} />
                <View style={styles.resultTextWrap}>
                  <Text style={[styles.resultTitle, { color: colors.wrong }]}>Not quite</Text>
                  <Text style={[styles.resultMsg, { color: colors.textSecondary }]}>
                    The correct option is highlighted. Try the next challenge tomorrow.
                  </Text>
                </View>
                <Pressable onPress={() => router.push('/leaderboard')}>
                  <Ionicons name="arrow-forward-circle" size={28} color={colors.wrong} />
                </Pressable>
              </View>
            )}
          </Card>
        </Animated.View>

        <View style={styles.insightGrid}>
          <Card style={styles.insightCard} padding="md">
            <View style={styles.insightHead}>
              <Ionicons name="people-outline" size={16} color={colors.primary} />
              <Text style={[styles.insightTitle, { color: colors.textSecondary }]}>Solvers today</Text>
            </View>
            <Text style={[styles.insightValue, { color: colors.text }]}>{solversCount}</Text>
          </Card>
          <Card style={styles.insightCard} padding="md">
            <View style={styles.insightHead}>
              <Ionicons name="trophy-outline" size={16} color={colors.secondary} />
              <Text style={[styles.insightTitle, { color: colors.textSecondary }]}>Your rank</Text>
            </View>
            <Text style={[styles.insightValue, { color: colors.text }]}>
              {userRank ? `#${userRank}` : '-'}
            </Text>
          </Card>
        </View>

        <Card style={styles.tipCard} padding="lg">
          <View style={styles.tipHeader}>
            <View style={[styles.tipIconWrap, { backgroundColor: `${colors.warning}16` }]}>
              <Ionicons name="bulb-outline" size={16} color={colors.warning} />
            </View>
            <View style={styles.tipTextWrap}>
              <Text style={[styles.tipTitle, { color: colors.text }]}>Daily Tip</Text>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>{dailyTip}</Text>
            </View>
          </View>
        </Card>

        {puzzle.id.startsWith('offline') && (
          <View style={[styles.offlineBar, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons
              name="cloud-offline-outline"
              size={16}
              color={colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.offlineText, { color: colors.textSecondary }]}>
              Offline mode - connect for live leaderboards
            </Text>
          </View>
        )}

        <View style={{ height: spacing.xxl + 70 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundLayer: { ...StyleSheet.absoluteFillObject },
  bgOrbTop: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -90,
    right: -70,
  },
  bgOrbBottom: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    bottom: 120,
    left: -90,
  },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { fontSize: fontSize.base, fontWeight: fontWeight.medium },
  errorText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: spacing.sm },

  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: spacing.xl,
  },

  heroCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    top: -70,
    right: -45,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  heroTitle: { color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  dayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  dayBadgeText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  heroStatsRow: { flexDirection: 'row', gap: spacing.sm },
  heroStatPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  heroStatValue: { color: '#fff', fontSize: fontSize.base, fontWeight: fontWeight.black },
  heroStatLabel: { color: 'rgba(255,255,255,0.82)', fontSize: fontSize.xs },

  sectionRow: { marginBottom: spacing.md },
  sectionHeader: { marginBottom: spacing.sm, paddingHorizontal: 2 },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black },
  sectionSubtitle: { fontSize: fontSize.xs, marginTop: 2 },
  categoriesRow: { gap: spacing.sm, paddingRight: spacing.md },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  categoryLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  challengeCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
  },
  challengeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  typePillText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  timerPillText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  challengeTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black, marginBottom: spacing.xs },
  challengePrompt: {
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * 1.45,
    marginBottom: spacing.lg,
  },

  optionsWrap: { gap: spacing.sm },
  option: {
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  optionLetter: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLetterText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  optionText: { fontSize: fontSize.base, flex: 1, fontWeight: fontWeight.medium },

  submitBtn: { marginTop: spacing.lg, borderRadius: borderRadius.full },
  resultCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultTextWrap: { flex: 1, minWidth: 0 },
  resultTitle: { fontSize: fontSize.base, fontWeight: fontWeight.black, marginBottom: 2 },
  resultMsg: { fontSize: fontSize.sm },

  insightGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  insightCard: { flex: 1, borderRadius: borderRadius.lg },
  insightHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  insightTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  insightValue: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },

  tipCard: { marginBottom: spacing.md, borderRadius: borderRadius.lg },
  tipHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  tipIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  tipTextWrap: { flex: 1 },
  tipTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: 4 },
  tipText: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.45 },

  offlineBar: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
});
