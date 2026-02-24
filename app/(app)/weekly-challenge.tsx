import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getCurrentWeeklyChallenge, getWeeklyPuzzles, grantWeeklyXP } from '@/lib/weeklyChallenge';
import { PuzzleRenderer } from '@/components/puzzle/PuzzleRenderer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { WeeklyChallenge as WCType } from '@/lib/types';
import type { Puzzle } from '@/lib/puzzles';

export default function WeeklyChallenge() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<WCType | null>(null);
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      setUserId(userData.user?.id ?? null);

      const wc = await getCurrentWeeklyChallenge();
      setChallenge(wc);

      if (wc) {
        const p = await getWeeklyPuzzles(wc.theme);
        setPuzzles(p);
      }
    } catch (e) {
      console.error('Weekly challenge error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswer(selectedIndex: number) {
    const puzzle = puzzles[currentIndex];
    if (!puzzle) return;

    const correct = selectedIndex === puzzle.answer_index;
    if (correct) {
      const multiplier = challenge?.point_multiplier ?? 1.5;
      const points = Math.floor(100 * multiplier);
      setScore((s) => s + points);
    }

    // Move to next after delay
    setTimeout(() => {
      if (currentIndex + 1 < puzzles.length) {
        setCurrentIndex((i) => i + 1);
      } else {
        setCompleted(true);
        if (userId && score > 0) {
          grantWeeklyXP(userId, score, challenge?.point_multiplier ?? 1.5);
        }
      }
    }, 1500);
  }

  const currentPuzzle = puzzles[currentIndex] ?? null;
  const daysLeft = challenge ? Math.max(0, Math.ceil((new Date(challenge.ends_at).getTime() - Date.now()) / 86400000)) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Weekly Challenge</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !challenge ? (
        <View style={styles.loadingWrap}>
          <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Active Challenge</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Check back soon for the next weekly challenge!
          </Text>
          <Button title="Back to Home" onPress={() => router.back()} variant="outline" style={{ marginTop: spacing.md }} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
          showsVerticalScrollIndicator={false}
        >
          <Card padding="lg" style={[styles.challengeHeader, { borderColor: `${colors.primary}30` }]}>
            <View style={styles.challengeTopRow}>
              <View>
                <Text style={[styles.challengeTitle, { color: colors.text }]}>{challenge.title}</Text>
                <Text style={[styles.challengeDesc, { color: colors.textSecondary }]}>{challenge.description}</Text>
              </View>
              <View style={[styles.multiplierBadge, { backgroundColor: `${colors.warning}15` }]}>
                <Text style={[styles.multiplierText, { color: colors.warning }]}>{challenge.point_multiplier}x</Text>
              </View>
            </View>
            <View style={styles.challengeStatsRow}>
              <View style={[styles.challengeStat, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.challengeStatValue, { color: colors.primary }]}>{currentIndex + 1}/{puzzles.length}</Text>
                <Text style={[styles.challengeStatLabel, { color: colors.textSecondary }]}>Progress</Text>
              </View>
              <View style={[styles.challengeStat, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.challengeStatValue, { color: colors.warning }]}>{score}</Text>
                <Text style={[styles.challengeStatLabel, { color: colors.textSecondary }]}>Score</Text>
              </View>
              <View style={[styles.challengeStat, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.challengeStatValue, { color: colors.textSecondary }]}>{daysLeft}d</Text>
                <Text style={[styles.challengeStatLabel, { color: colors.textSecondary }]}>Left</Text>
              </View>
            </View>
          </Card>

          {!completed && currentPuzzle && (
            <PuzzleRenderer
              key={currentIndex}
              puzzle={currentPuzzle}
              onSubmit={handleAnswer}
              hideTimer
              hideResultNav
              modeLabel={`Weekly - ${challenge.theme}`}
            />
          )}

          {completed && (
            <Card padding="lg" style={styles.completedCard}>
              <Ionicons name="ribbon-outline" size={48} color={colors.primary} style={{ alignSelf: 'center' }} />
              <Text style={[styles.completedTitle, { color: colors.text }]}>Challenge Complete!</Text>
              <Text style={[styles.completedScore, { color: colors.primary }]}>Total Score: {score}</Text>
              <Button title="Back to Home" onPress={() => router.back()} variant="gradient" fullWidth size="lg" />
            </Card>
          )}

          <View style={{ height: spacing.xxl + 70 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { padding: spacing.xs },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  emptyDesc: { fontSize: fontSize.base, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
  challengeHeader: { marginBottom: spacing.md, borderWidth: 1 },
  challengeTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  challengeTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black },
  challengeDesc: { fontSize: fontSize.sm, marginTop: 2 },
  multiplierBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
  multiplierText: { fontSize: fontSize.sm, fontWeight: fontWeight.black },
  challengeStatsRow: { flexDirection: 'row', gap: spacing.sm },
  challengeStat: { flex: 1, padding: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  challengeStatValue: { fontSize: fontSize.base, fontWeight: fontWeight.black },
  challengeStatLabel: { fontSize: fontSize.xs, marginTop: 2 },
  completedCard: { alignItems: 'center', gap: spacing.md },
  completedTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  completedScore: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
});
