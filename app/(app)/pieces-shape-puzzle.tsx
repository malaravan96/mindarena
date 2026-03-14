import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { GameModeLeaderboard } from '@/components/gameModes/GameModeLeaderboard';
import { PiecesShapeBoard } from '@/components/gameModes/PiecesShapeBoard';
import { borderRadius, fontSize, fontWeight, isDesktop, spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { showAlert } from '@/lib/alert';
import {
  formatDuration,
  getPiecesShapeLevel,
  piecesShapeLevels,
  type PiecesShapeLevel,
} from '@/lib/gameModes/piecesShapePuzzle';
import {
  getShapePuzzleLeaderboard,
  getShapePuzzlePersonalBest,
  saveShapePuzzleCompletion,
  type GameModeLeaderboardEntry,
  type PersonalBest,
} from '@/lib/gameModes/records';
import { supabase } from '@/lib/supabase';

export default function PiecesShapePuzzleScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [selectedLevelKey, setSelectedLevelKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [leaderboard, setLeaderboard] = useState<GameModeLeaderboardEntry[]>([]);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);

  const selectedLevel = useMemo(
    () => (selectedLevelKey ? getPiecesShapeLevel(selectedLevelKey) : null),
    [selectedLevelKey],
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const loadLevelStats = useCallback(
    async (levelKey: string) => {
      setLoadingStats(true);
      try {
        const [nextLeaderboard, nextBest] = await Promise.all([
          getShapePuzzleLeaderboard(levelKey),
          userId ? getShapePuzzlePersonalBest(userId, levelKey) : Promise.resolve(null),
        ]);
        setLeaderboard(nextLeaderboard);
        setPersonalBest(nextBest);
      } finally {
        setLoadingStats(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!selectedLevelKey) return;
    loadLevelStats(selectedLevelKey).catch(() => null);
  }, [loadLevelStats, selectedLevelKey]);

  async function handleComplete(result: { ms: number; moves: number }) {
    if (!userId || !selectedLevel) return;

    const saveResult = await saveShapePuzzleCompletion({
      userId,
      levelKey: selectedLevel.levelKey,
      ms: result.ms,
      moves: result.moves,
      points: selectedLevel.points,
      xp: selectedLevel.xp,
    });

    await loadLevelStats(selectedLevel.levelKey);

    if (saveResult.awardedRewards) {
      showAlert('Level clear reward', `You earned ${selectedLevel.points} points and ${selectedLevel.xp} XP.`);
    } else if (saveResult.improvedBest) {
      showAlert('Personal best', 'Your improved time has been recorded for this level.');
    }
  }

  function renderLevelCard(level: PiecesShapeLevel) {
    return (
      <Pressable key={level.levelKey} onPress={() => setSelectedLevelKey(level.levelKey)}>
        <Card padding="md" style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View style={[styles.levelBadge, { backgroundColor: `${colors.primary}12` }]}>
              <Text style={[styles.levelBadgeText, { color: colors.primary }]}>
                {level.boardSize} x {level.boardSize}
              </Text>
            </View>
            <Text style={[styles.levelDifficulty, { color: colors.textSecondary }]}>
              {level.difficulty.toUpperCase()}
            </Text>
          </View>

          <Text style={[styles.levelTitle, { color: colors.text }]}>{level.title}</Text>
          <Text style={[styles.levelDesc, { color: colors.textSecondary }]}>{level.description}</Text>

          <View style={styles.levelFooter}>
            <Text style={[styles.levelMeta, { color: colors.textSecondary }]}>
              {level.pieces.length} pieces · {level.points} pts · +{level.xp} XP
            </Text>
            <Ionicons name="arrow-forward-circle-outline" size={22} color={colors.primary} />
          </View>
        </Card>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => {
            if (selectedLevelKey) {
              setSelectedLevelKey(null);
              setLeaderboard([]);
              setPersonalBest(null);
              return;
            }
            router.back();
          }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Pieces Shape Puzzle</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Drag colorful shapes until they fill the square perfectly
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        {selectedLevel ? (
          <>
            <PiecesShapeBoard
              level={selectedLevel}
              onComplete={handleComplete}
              onBack={() => {
                setSelectedLevelKey(null);
                setLeaderboard([]);
                setPersonalBest(null);
              }}
            />

            <View style={styles.infoGrid}>
              <Card padding="md" style={styles.infoCard}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Your best</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {personalBest ? formatDuration(personalBest.bestMs) : '--'}
                </Text>
                <Text style={[styles.infoMeta, { color: colors.textSecondary }]}>
                  {personalBest ? `${personalBest.bestMoves} moves` : 'Complete once to set a time'}
                </Text>
              </Card>
              <Card padding="md" style={styles.infoCard}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Level reward</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{selectedLevel.points} pts</Text>
                <Text style={[styles.infoMeta, { color: colors.textSecondary }]}>
                  +{selectedLevel.xp} XP on first clear
                </Text>
              </Card>
            </View>

            {loadingStats ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <GameModeLeaderboard
                title={`Top ${selectedLevel.title} Times`}
                entries={leaderboard}
              />
            )}
          </>
        ) : (
          <>
            <Card padding="lg" style={styles.copyCard}>
              <Text style={[styles.copyTitle, { color: colors.text }]}>Pieces Shape Puzzle</Text>
              <Text style={[styles.copyBody, { color: colors.textSecondary }]}>
                Pieces Shape Puzzle is a colorful challenge where you use different shapes to perfectly fill a square. This brain-teasing puzzle is fun for kids and adults alike and makes a great classroom activity.
              </Text>
              <Text style={[styles.copyHeading, { color: colors.text }]}>How to Play</Text>
              <Text style={[styles.copyBullet, { color: colors.textSecondary }]}>. Drag the colored shapes onto the board.</Text>
              <Text style={[styles.copyBullet, { color: colors.textSecondary }]}>. Fit all the pieces together until they fill the square completely.</Text>
              <Text style={[styles.copyBody, { color: colors.textSecondary }]}>
                Pieces Shape Puzzle is safe, kid-friendly, and works on desktop, tablet, or mobile. Students practice geometry concepts and problem-solving while having fun. Ideal for indoor recess, enrichment, or at-home learning.
              </Text>
            </Card>

            <View style={styles.levelList}>
              {piecesShapeLevels.map(renderLevelCard)}
            </View>
          </>
        )}

        <View style={{ height: spacing.xxl + 70 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerSubtitle: { fontSize: fontSize.xs, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
  copyCard: { borderRadius: borderRadius.xl, marginBottom: spacing.md },
  copyTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black, marginBottom: spacing.sm },
  copyBody: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5, marginBottom: spacing.md },
  copyHeading: { fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: spacing.xs },
  copyBullet: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.45, marginBottom: spacing.xs },
  levelList: { gap: spacing.md },
  levelCard: { borderRadius: borderRadius.xl },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  levelBadge: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.full },
  levelBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  levelDifficulty: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  levelTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, marginBottom: 4 },
  levelDesc: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.45 },
  levelFooter: { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelMeta: { fontSize: fontSize.xs },
  infoGrid: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  infoCard: { flex: 1, borderRadius: borderRadius.lg },
  infoLabel: { fontSize: fontSize.xs, textTransform: 'uppercase' },
  infoValue: { fontSize: fontSize.xl, fontWeight: fontWeight.black, marginTop: 4 },
  infoMeta: { fontSize: fontSize.xs, marginTop: 4 },
  loadingRow: { paddingVertical: spacing.md, alignItems: 'center' },
});
