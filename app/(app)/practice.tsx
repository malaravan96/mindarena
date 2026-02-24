import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getTimedPuzzle } from '@/lib/timedChallenge';
import { PuzzleRenderer } from '@/components/puzzle/PuzzleRenderer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, isDesktop } from '@/constants/theme';
import type { Puzzle } from '@/lib/puzzles';

export default function Practice() {
  const router = useRouter();
  const { colors } = useTheme();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [puzzleKey, setPuzzleKey] = useState(0);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    loadPuzzle();
  }, []);

  async function loadPuzzle() {
    setAnswered(false);
    const p = await getTimedPuzzle();
    setPuzzle(p);
    setPuzzleKey((k) => k + 1);
  }

  function handleAnswer(_selectedIndex: number) {
    setAnswered(true);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Practice Mode</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>No points, no pressure</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        <Card padding="md" style={styles.infoBanner}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Practice mode does not award points or XP. Use it to sharpen your skills!
            </Text>
          </View>
        </Card>

        {puzzle && (
          <PuzzleRenderer
            key={puzzleKey}
            puzzle={puzzle}
            onSubmit={handleAnswer}
            hideTimer
            hideResultNav
            modeLabel="Practice"
          />
        )}

        {answered && (
          <Button
            title="Next Puzzle"
            onPress={loadPuzzle}
            variant="gradient"
            fullWidth
            size="lg"
            style={{ marginTop: spacing.sm }}
          />
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
  headerSubtitle: { fontSize: fontSize.xs, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
  infoBanner: { marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  infoText: { fontSize: fontSize.sm, flex: 1 },
});
