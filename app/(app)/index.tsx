import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { offlinePuzzles, Puzzle } from '@/lib/puzzles';
import { todayKey } from '@/lib/date';
import { PrimaryButton } from '@/components/PrimaryButton';

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
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle'|'correct'|'wrong'>('idle');

  const dayKey = useMemo(() => todayKey(), []);
  const userId = supabase.auth.getUser ? undefined : undefined;

  useEffect(() => {
    (async () => {
      try {
        // Try to fetch today's puzzle from Supabase
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
      }
    })();
  }, [dayKey]);

  async function submit() {
    if (!puzzle) return;
    if (selected === null) {
      Alert.alert('Pick an answer');
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
    await supabase.auth.signOut();
  }

  if (!puzzle) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Daily Puzzle</Text>
          <Text style={styles.h2}>{puzzle.title} • {dayKey}</Text>
        </View>
        <Pressable onPress={() => router.push('/profile')}>
          <Text style={styles.link}>Profile</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.prompt}>{puzzle.prompt}</Text>

        <View style={{ height: 12 }} />

        {puzzle.options.map((opt, i) => {
          const active = selected === i;
          return (
            <Pressable
              key={i}
              onPress={() => setSelected(i)}
              style={[styles.option, active ? styles.optionActive : null]}
            >
              <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>
                {String.fromCharCode(65 + i)}. {opt}
              </Text>
            </Pressable>
          );
        })}

        <View style={{ height: 14 }} />

        <PrimaryButton
          title={submitting ? 'Submitting...' : 'Submit Answer'}
          onPress={submit}
          disabled={submitting || status !== 'idle'}
        />

        {status !== 'idle' && (
          <Text style={[styles.result, status === 'correct' ? styles.correct : styles.wrong]}>
            {status === 'correct' ? '✅ Correct!' : '❌ Wrong — try again tomorrow!'}
          </Text>
        )}

        <View style={{ height: 10 }} />
        <Link href="/leaderboard" asChild>
          <Pressable>
            <Text style={styles.link}>View Leaderboard →</Text>
          </Pressable>
        </Link>

        <View style={{ height: 18 }} />
        <Pressable onPress={signOut}>
          <Text style={[styles.link, { opacity: 0.7 }]}>Sign out</Text>
        </Pressable>

        {!puzzle.id.startsWith('offline') ? null : (
          <Text style={styles.offline}>Offline puzzle (set up Supabase to enable leaderboard + saving)</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 },
  h1: { fontSize: 28, fontWeight: '900' },
  h2: { fontSize: 13, opacity: 0.65, marginTop: 2 },
  link: { fontSize: 14, fontWeight: '800' },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: 16 },
  prompt: { fontSize: 18, fontWeight: '800' },
  option: { padding: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginTop: 10 },
  optionActive: { borderColor: '#111827', backgroundColor: '#f3f4f6' },
  optionText: { fontSize: 15, fontWeight: '700' },
  optionTextActive: { color: '#111827' },
  result: { marginTop: 12, fontSize: 14, fontWeight: '800' },
  correct: { },
  wrong: { },
  offline: { marginTop: 10, fontSize: 12, opacity: 0.65 },
});
