import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { startTimedSession, endTimedSession, getTimedPuzzle, grantTimedXP } from '@/lib/timedChallenge';
import { checkAndAwardAchievements } from '@/lib/achievements';
import { PuzzleRenderer } from '@/components/puzzle/PuzzleRenderer';
import { TimedChallengeHUD } from '@/components/puzzle/TimedChallengeHUD';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { Puzzle } from '@/lib/puzzles';

type Duration = 180 | 300 | 600;
type Phase = 'setup' | 'playing' | 'results';

const DURATIONS: { value: Duration; label: string }[] = [
  { value: 180, label: '3 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
];

export default function TimedChallenge() {
  const router = useRouter();
  const { colors } = useTheme();
  const [phase, setPhase] = useState<Phase>('setup');
  const [duration, setDuration] = useState<Duration>(300);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [solved, setSolved] = useState(0);
  const [streak, setStreak] = useState(0);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [puzzleKey, setPuzzleKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (phase === 'playing' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            finishGame();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const finishGame = useCallback(async () => {
    setPhase('results');
    if (sessionId && userId) {
      await endTimedSession(sessionId, solved, score);
      await grantTimedXP(userId, solved);
      await checkAndAwardAchievements(userId);
    }
  }, [sessionId, userId, solved, score]);

  async function startGame() {
    if (!userId) return;
    setLoading(true);
    try {
      const sid = await startTimedSession(userId, duration);
      setSessionId(sid);
      setTimeLeft(duration);
      setScore(0);
      setSolved(0);
      setStreak(0);
      const p = await getTimedPuzzle();
      setPuzzle(p);
      setPuzzleKey(0);
      setPhase('playing');
    } catch (e) {
      console.error('Start error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswer(selectedIndex: number) {
    if (!puzzle) return;
    const correct = selectedIndex === puzzle.answer_index;
    if (correct) {
      const newStreak = streak + 1;
      const points = 100 + (newStreak > 1 ? newStreak * 10 : 0);
      setScore((s) => s + points);
      setSolved((s) => s + 1);
      setStreak(newStreak);
    } else {
      setStreak(0);
    }

    // Load next puzzle after a brief delay
    setTimeout(async () => {
      const next = await getTimedPuzzle();
      setPuzzle(next);
      setPuzzleKey((k) => k + 1);
    }, 1200);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Timed Challenge</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        {phase === 'setup' && (
          <Card padding="lg" style={styles.setupCard}>
            <Ionicons name="timer-outline" size={48} color={colors.primary} style={{ alignSelf: 'center' }} />
            <Text style={[styles.setupTitle, { color: colors.text }]}>Choose Duration</Text>
            <Text style={[styles.setupDesc, { color: colors.textSecondary }]}>
              Solve as many puzzles as you can before time runs out!
            </Text>
            <View style={styles.durationRow}>
              {DURATIONS.map((d) => (
                <Pressable
                  key={d.value}
                  onPress={() => setDuration(d.value)}
                  style={[
                    styles.durationBtn,
                    {
                      borderColor: duration === d.value ? colors.primary : colors.border,
                      backgroundColor: duration === d.value ? `${colors.primary}12` : colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.durationText, { color: duration === d.value ? colors.primary : colors.text }]}>
                    {d.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Button
              title={loading ? 'Starting...' : 'Start Challenge'}
              onPress={startGame}
              variant="gradient"
              fullWidth
              size="lg"
              disabled={loading || !userId}
              loading={loading}
            />
          </Card>
        )}

        {phase === 'playing' && puzzle && (
          <>
            <TimedChallengeHUD timeLeft={timeLeft} score={score} solved={solved} streak={streak} />
            <PuzzleRenderer
              key={puzzleKey}
              puzzle={puzzle}
              onSubmit={handleAnswer}
              hideTimer
              hideResultNav
              modeLabel="Timed"
            />
          </>
        )}

        {phase === 'results' && (
          <Card padding="lg" style={styles.resultsCard}>
            <Ionicons name="flag-outline" size={48} color={colors.primary} style={{ alignSelf: 'center' }} />
            <Text style={[styles.resultsTitle, { color: colors.text }]}>Time's Up!</Text>
            <View style={styles.resultsGrid}>
              <View style={[styles.resultStat, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.resultStatValue, { color: colors.primary }]}>{solved}</Text>
                <Text style={[styles.resultStatLabel, { color: colors.textSecondary }]}>Solved</Text>
              </View>
              <View style={[styles.resultStat, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.resultStatValue, { color: colors.warning }]}>{score}</Text>
                <Text style={[styles.resultStatLabel, { color: colors.textSecondary }]}>Score</Text>
              </View>
            </View>
            <Button title="Play Again" onPress={() => setPhase('setup')} variant="gradient" fullWidth size="lg" />
            <Button title="Back to Home" onPress={() => router.back()} variant="outline" fullWidth style={{ marginTop: spacing.sm }} />
          </Card>
        )}

        <View style={{ height: spacing.xxl + 70 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { padding: spacing.xs },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
  setupCard: { alignItems: 'center', gap: spacing.md },
  setupTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  setupDesc: { fontSize: fontSize.base, textAlign: 'center' },
  durationRow: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  durationBtn: { flex: 1, borderWidth: 1.5, borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: 'center' },
  durationText: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
  resultsCard: { alignItems: 'center', gap: spacing.md },
  resultsTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  resultsGrid: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  resultStat: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  resultStatValue: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  resultStatLabel: { fontSize: fontSize.xs, marginTop: 2 },
});
