import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { startStreakSession, updateStreakSession, getStreakPuzzle, getDifficultyForStreak, grantStreakXP } from '@/lib/puzzleStreak';
import { checkAndAwardAchievements } from '@/lib/achievements';
import { PuzzleRenderer } from '@/components/puzzle/PuzzleRenderer';
import { StreakProgressBar } from '@/components/puzzle/StreakProgressBar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { Puzzle } from '@/lib/puzzles';

type Phase = 'ready' | 'playing' | 'gameover';

export default function PuzzleStreak() {
  const router = useRouter();
  const { colors } = useTheme();
  const [phase, setPhase] = useState<Phase>('ready');
  const [streakLength, setStreakLength] = useState(0);
  const [score, setScore] = useState(0);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [puzzleKey, setPuzzleKey] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function startGame() {
    if (!userId) return;
    setLoading(true);
    try {
      const sid = await startStreakSession(userId);
      setSessionId(sid);
      setStreakLength(0);
      setScore(0);
      const p = await getStreakPuzzle(0);
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
      const newStreak = streakLength + 1;
      const points = 100 + (newStreak * 15);
      setStreakLength(newStreak);
      setScore((s) => s + points);

      if (sessionId) {
        await updateStreakSession(sessionId, newStreak, score + points, false);
      }

      setTimeout(async () => {
        const next = await getStreakPuzzle(newStreak);
        setPuzzle(next);
        setPuzzleKey((k) => k + 1);
      }, 1000);
    } else {
      // Game over
      setPhase('gameover');
      if (sessionId && userId) {
        await updateStreakSession(sessionId, streakLength, score, true);
        await grantStreakXP(userId, streakLength);
        await checkAndAwardAchievements(userId);
      }
    }
  }

  const difficulty = getDifficultyForStreak(streakLength);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Puzzle Streak</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        {phase === 'ready' && (
          <Card padding="lg" style={styles.readyCard}>
            <Ionicons name="trending-up-outline" size={48} color={colors.primary} style={{ alignSelf: 'center' }} />
            <Text style={[styles.readyTitle, { color: colors.text }]}>Puzzle Streak</Text>
            <Text style={[styles.readyDesc, { color: colors.textSecondary }]}>
              Chain correct answers in a row. Difficulty increases every 5 puzzles. One wrong answer ends the streak!
            </Text>
            <Button title="Start Streak" onPress={startGame} variant="gradient" fullWidth size="lg" disabled={loading || !userId} loading={loading} />
          </Card>
        )}

        {phase === 'playing' && puzzle && (
          <>
            <StreakProgressBar streakLength={streakLength} difficulty={difficulty} />
            <PuzzleRenderer
              key={puzzleKey}
              puzzle={puzzle}
              onSubmit={handleAnswer}
              hideTimer
              hideResultNav
              modeLabel={`Streak - ${difficulty}`}
            />
          </>
        )}

        {phase === 'gameover' && (
          <Card padding="lg" style={styles.gameoverCard}>
            <Ionicons name="skull-outline" size={48} color={colors.wrong} style={{ alignSelf: 'center' }} />
            <Text style={[styles.gameoverTitle, { color: colors.text }]}>Streak Over!</Text>
            <View style={styles.statsRow}>
              <View style={[styles.stat, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{streakLength}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Streak</Text>
              </View>
              <View style={[styles.stat, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.statValue, { color: colors.warning }]}>{score}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Score</Text>
              </View>
              <View style={[styles.stat, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.statValue, { color: colors.correct }]}>{difficulty}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Max Diff</Text>
              </View>
            </View>
            <Button title="Try Again" onPress={() => { setPhase('ready'); }} variant="gradient" fullWidth size="lg" />
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
  readyCard: { alignItems: 'center', gap: spacing.md },
  readyTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  readyDesc: { fontSize: fontSize.base, textAlign: 'center' },
  gameoverCard: { alignItems: 'center', gap: spacing.md },
  gameoverTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  statsRow: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  stat: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  statLabel: { fontSize: fontSize.xs, marginTop: 2 },
});
