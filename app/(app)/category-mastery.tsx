import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getUserMastery, incrementCategoryProgress, getMasteryProgress, MASTERY_CATEGORIES } from '@/lib/categoryMastery';
import { getTimedPuzzle } from '@/lib/timedChallenge';
import { PuzzleRenderer } from '@/components/puzzle/PuzzleRenderer';
import { CategoryMasteryCard } from '@/components/puzzle/CategoryMasteryCard';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { Puzzle, PuzzleType } from '@/lib/puzzles';
import type { CategoryMastery as MasteryType } from '@/lib/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const CATEGORY_ICONS: Record<string, IconName> = {
  pattern: 'color-filter-outline',
  logic: 'git-merge-outline',
  math: 'calculator-outline',
  word: 'text-outline',
  memory: 'albums-outline',
  visual: 'eye-outline',
  spatial: 'grid-outline',
  trivia: 'help-circle-outline',
};

export default function CategoryMasteryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [mastery, setMastery] = useState<MasteryType[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<PuzzleType | null>(null);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [puzzleKey, setPuzzleKey] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      setUserId(uid);
      const data = await getUserMastery(uid);
      setMastery(data);
    } catch (e) {
      console.error('Mastery load error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function selectCategory(cat: PuzzleType) {
    setSelectedCategory(cat);
    // Get a puzzle for this category
    const { data } = await supabase
      .from('puzzles')
      .select('id, date_key, title, prompt, type, options, answer_index')
      .eq('type', cat)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data && data.length > 0) {
      const random = data[Math.floor(Math.random() * data.length)];
      setPuzzle({
        id: random.id,
        date_key: random.date_key,
        title: random.title,
        prompt: random.prompt,
        type: random.type as Puzzle['type'],
        options: random.options,
        answer_index: random.answer_index,
      });
    } else {
      // Fallback
      const p = await getTimedPuzzle();
      setPuzzle(p);
    }
    setPuzzleKey((k) => k + 1);
  }

  async function handleAnswer(selectedIndex: number) {
    if (!puzzle || !userId || !selectedCategory) return;
    const correct = selectedIndex === puzzle.answer_index;

    if (correct) {
      await incrementCategoryProgress(userId, selectedCategory);
    }

    // Load next puzzle after delay
    setTimeout(() => selectCategory(selectedCategory), 1500);
  }

  function getMasteryForCategory(category: string) {
    const m = mastery.find((m) => m.category === category);
    return m ? getMasteryProgress(m.puzzles_completed) : { level: 0, progress: 0, puzzlesInLevel: 0 };
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={selectedCategory ? () => { setSelectedCategory(null); setPuzzle(null); } : () => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {selectedCategory ? `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Mastery` : 'Category Mastery'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
          showsVerticalScrollIndicator={false}
        >
          {!selectedCategory ? (
            <>
              <Text style={[styles.desc, { color: colors.textSecondary }]}>
                Complete 20 puzzles per category to level up. Master all 5 levels!
              </Text>
              <View style={styles.categoryGrid}>
                {MASTERY_CATEGORIES.map((cat) => {
                  const m = mastery.find((m) => m.category === cat.type);
                  const progress = getMasteryProgress(m?.puzzles_completed ?? 0);
                  return (
                    <Pressable key={cat.type} onPress={() => selectCategory(cat.type)}>
                      <CategoryMasteryCard
                        category={cat.label}
                        icon={CATEGORY_ICONS[cat.type] ?? 'help-outline'}
                        level={progress.level}
                        progress={progress.progress}
                        puzzlesCompleted={m?.puzzles_completed ?? 0}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : puzzle ? (
            <PuzzleRenderer
              key={puzzleKey}
              puzzle={puzzle}
              onSubmit={handleAnswer}
              hideTimer
              hideResultNav
              modeLabel={`${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Mastery`}
            />
          ) : (
            <Card padding="lg">
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No puzzles available for this category yet.</Text>
              <Button title="Back" onPress={() => { setSelectedCategory(null); }} variant="outline" fullWidth />
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
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
  desc: { fontSize: fontSize.base, textAlign: 'center', marginBottom: spacing.md },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emptyText: { fontSize: fontSize.base, textAlign: 'center', marginBottom: spacing.md },
});
