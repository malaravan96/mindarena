import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { GameModeLeaderboard } from '@/components/gameModes/GameModeLeaderboard';
import { JigsawArtwork } from '@/components/gameModes/JigsawArtwork';
import { JigsawBoard } from '@/components/gameModes/JigsawBoard';
import { borderRadius, fontSize, fontWeight, isDesktop, spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { showAlert } from '@/lib/alert';
import {
  builtInJigsawPuzzles,
  formatDuration,
  getBuiltInJigsaw,
  getJigsawReward,
  JIGSAW_GRID_SIZES,
  type JigsawGridSize,
} from '@/lib/gameModes/jigsaw';
import {
  getJigsawLeaderboard,
  getJigsawPersonalBest,
  saveJigsawCompletion,
  type GameModeLeaderboardEntry,
  type PersonalBest,
} from '@/lib/gameModes/records';
import { supabase } from '@/lib/supabase';

type Mode = 'system' | 'custom';

export default function JigsawPuzzlesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>('system');
  const [gridSize, setGridSize] = useState<JigsawGridSize>(4);
  const [selectedPuzzleKey, setSelectedPuzzleKey] = useState<string | null>(null);
  const [customImageUri, setCustomImageUri] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [leaderboard, setLeaderboard] = useState<GameModeLeaderboardEntry[]>([]);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);

  const selectedPuzzle = useMemo(
    () => (selectedPuzzleKey ? getBuiltInJigsaw(selectedPuzzleKey) : null),
    [selectedPuzzleKey],
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const loadBuiltInStats = useCallback(
    async (puzzleKey: string, size: JigsawGridSize) => {
      setLoadingStats(true);
      try {
        const [nextLeaderboard, nextBest] = await Promise.all([
          getJigsawLeaderboard(puzzleKey, size),
          userId ? getJigsawPersonalBest(userId, puzzleKey, size) : Promise.resolve(null),
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
    if (mode !== 'system' || !selectedPuzzleKey) return;
    loadBuiltInStats(selectedPuzzleKey, gridSize).catch(() => null);
  }, [gridSize, loadBuiltInStats, mode, selectedPuzzleKey]);

  async function pickCustomImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]?.uri) return;
    setCustomImageUri(result.assets[0].uri);
  }

  function handleBack() {
    if (mode === 'system' && selectedPuzzleKey) {
      setSelectedPuzzleKey(null);
      setLeaderboard([]);
      setPersonalBest(null);
      return;
    }

    if (mode === 'custom' && customImageUri) {
      setCustomImageUri(null);
      return;
    }

    router.back();
  }

  async function handleBuiltInComplete(result: { ms: number; moves: number }) {
    if (!userId || !selectedPuzzleKey) return;
    const reward = getJigsawReward(gridSize);
    const saveResult = await saveJigsawCompletion({
      userId,
      puzzleKey: selectedPuzzleKey,
      gridSize,
      ms: result.ms,
      moves: result.moves,
      points: reward.points,
      xp: reward.xp,
    });

    await loadBuiltInStats(selectedPuzzleKey, gridSize);

    if (saveResult.awardedRewards) {
      showAlert('First clear reward', `You earned ${reward.points} points and ${reward.xp} XP.`);
    } else if (saveResult.improvedBest) {
      showAlert('Personal best', 'Your new fastest time is now on the board.');
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Jigsaw Puzzles</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            System puzzles or your own uploaded image
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.segmentRow}>
          {([
            { key: 'system', label: 'System Puzzles', icon: 'grid-outline' },
            { key: 'custom', label: 'Create Your Own', icon: 'image-outline' },
          ] as const).map((item) => {
            const active = mode === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setMode(item.key)}
                style={[
                  styles.segmentBtn,
                  {
                    backgroundColor: active ? `${colors.primary}12` : colors.surface,
                    borderColor: active ? `${colors.primary}50` : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={active ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.segmentText, { color: active ? colors.primary : colors.textSecondary }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sizeRow}>
          {JIGSAW_GRID_SIZES.map((size) => {
            const active = gridSize === size;
            return (
              <Pressable
                key={size}
                onPress={() => setGridSize(size)}
                style={[
                  styles.sizeChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.sizeChipText, { color: active ? '#fff' : colors.text }]}>
                  {size} x {size}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'system' ? (
          selectedPuzzle ? (
            <>
              <JigsawBoard
                puzzleKey={selectedPuzzle.puzzleKey}
                title={selectedPuzzle.title}
                subtitle={selectedPuzzle.subtitle}
                gridSize={gridSize}
                artwork={selectedPuzzle.artwork}
                competitive
                onComplete={handleBuiltInComplete}
                onBack={() => {
                  setSelectedPuzzleKey(null);
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
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>First clear reward</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {getJigsawReward(gridSize).points} pts
                  </Text>
                  <Text style={[styles.infoMeta, { color: colors.textSecondary }]}>
                    +{getJigsawReward(gridSize).xp} XP
                  </Text>
                </Card>
              </View>

              {loadingStats ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                <GameModeLeaderboard
                  title={`Top ${selectedPuzzle.title} Times`}
                  entries={leaderboard}
                />
              )}
            </>
          ) : (
            <View style={styles.cardGrid}>
              {builtInJigsawPuzzles.map((puzzle) => (
                <Pressable key={puzzle.puzzleKey} onPress={() => setSelectedPuzzleKey(puzzle.puzzleKey)}>
                  <Card padding="md" style={styles.libraryCard}>
                    <View style={styles.libraryPreview}>
                      <JigsawArtwork size={128} artwork={puzzle.artwork} />
                    </View>
                    <Text style={[styles.libraryTitle, { color: colors.text }]}>{puzzle.title}</Text>
                    <Text style={[styles.librarySubtitle, { color: colors.textSecondary }]}>
                      {puzzle.subtitle}
                    </Text>
                    <View style={styles.libraryFooter}>
                      <Text style={[styles.libraryMeta, { color: colors.textSecondary }]}>
                        Ranked at {gridSize} x {gridSize}
                      </Text>
                      <Ionicons name="arrow-forward-circle-outline" size={22} color={colors.primary} />
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          )
        ) : customImageUri ? (
          <>
            <JigsawBoard
              puzzleKey="custom"
              title="Custom Jigsaw"
              subtitle="Your uploaded image stays local to this session."
              gridSize={gridSize}
              imageUri={customImageUri}
              competitive={false}
              onComplete={async () => {}}
              onBack={() => setCustomImageUri(null)}
            />

            <Card padding="lg" style={styles.noteCard}>
              <Text style={[styles.noteTitle, { color: colors.text }]}>Local-only custom mode</Text>
              <Text style={[styles.noteBody, { color: colors.textSecondary }]}>
                Uploaded jigsaws are not saved to Supabase and do not affect global rankings. Pick a new image anytime to generate another puzzle.
              </Text>
            </Card>
          </>
        ) : (
          <Card padding="lg" style={styles.createCard}>
            <View style={[styles.createIconWrap, { backgroundColor: `${colors.primary}14` }]}>
              <Ionicons name="images-outline" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.createTitle, { color: colors.text }]}>Create a jigsaw from your own photo</Text>
            <Text style={[styles.createBody, { color: colors.textSecondary }]}>
              Pick an image from your library, choose 4 x 4 or 5 x 5, and solve it with the same drag-and-snap board used by the system puzzles.
            </Text>
            <Button title="Choose Image" onPress={pickCustomImage} variant="gradient" fullWidth />
          </Card>
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
  segmentRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  segmentBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  segmentText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  sizeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  sizeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  sizeChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  cardGrid: { gap: spacing.md },
  libraryCard: { borderRadius: borderRadius.xl },
  libraryPreview: {
    alignSelf: 'center',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  libraryTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, marginBottom: 4 },
  librarySubtitle: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.45 },
  libraryFooter: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  libraryMeta: { fontSize: fontSize.xs },
  infoGrid: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  infoCard: { flex: 1, borderRadius: borderRadius.lg },
  infoLabel: { fontSize: fontSize.xs, textTransform: 'uppercase' },
  infoValue: { fontSize: fontSize.xl, fontWeight: fontWeight.black, marginTop: 4 },
  infoMeta: { fontSize: fontSize.xs, marginTop: 4 },
  loadingRow: { paddingVertical: spacing.md, alignItems: 'center' },
  createCard: { borderRadius: borderRadius.xl, alignItems: 'center' },
  createIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  createTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black, textAlign: 'center', marginBottom: spacing.sm },
  createBody: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5, textAlign: 'center', marginBottom: spacing.md },
  noteCard: { marginTop: spacing.md, borderRadius: borderRadius.xl },
  noteTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: spacing.xs },
  noteBody: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.45 },
});
