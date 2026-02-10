import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Alert } from 'react-native';
import { todayKey } from '@/lib/date';
import { supabase } from '@/lib/supabase';

type Row = {
  user_id: string;
  ms_taken: number;
  created_at: string;
  profiles?: { display_name: string | null } | null;
};

export default function Leaderboard() {
  const dayKey = useMemo(() => todayKey(), []);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [puzzleId, setPuzzleId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: puzzle, error: pErr } = await supabase
          .from('puzzles')
          .select('id')
          .eq('date_key', dayKey)
          .limit(1)
          .maybeSingle<{ id: string }>();

        if (pErr) throw pErr;
        if (!puzzle) {
          setPuzzleId(null);
          setRows([]);
          return;
        }
        setPuzzleId(puzzle.id);

        const { data, error } = await supabase
          .from('attempts')
          .select('user_id, ms_taken, created_at, profiles(display_name)')
          .eq('puzzle_id', puzzle.id)
          .eq('is_correct', true)
          .order('ms_taken', { ascending: true })
          .limit(50);

        if (error) throw error;
        setRows((data as any) ?? []);
      } catch (e: any) {
        Alert.alert('Leaderboard error', e?.message ?? 'Unknown error');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [dayKey]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Leaderboard</Text>
      <Text style={styles.h2}>Top correct times • {dayKey}</Text>

      {loading ? (
        <View style={{ marginTop: 24 }}>
          <ActivityIndicator />
        </View>
      ) : !puzzleId ? (
        <Text style={styles.empty}>No Supabase puzzle for today yet. Insert one in the `puzzles` table.</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>No correct submissions yet. Be the first!</Text>
      ) : (
        <View style={styles.card}>
          {rows.map((r, idx) => {
            const name = r.profiles?.display_name || r.user_id.slice(0, 6) + '…';
            const sec = (r.ms_taken / 1000).toFixed(2);
            return (
              <View key={idx} style={styles.row}>
                <Text style={styles.rank}>#{idx + 1}</Text>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.time}>{sec}s</Text>
              </View>
            );
          })}
        </View>
      )}

      <Pressable onPress={() => Alert.alert('Tip', 'You can seed puzzles in Supabase using the SQL in supabase/seed.sql')}>
        <Text style={styles.tip}>How do I add today’s puzzle?</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: 'white' },
  h1: { fontSize: 28, fontWeight: '900' },
  h2: { fontSize: 13, opacity: 0.65, marginTop: 2, marginBottom: 14 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rank: { width: 44, fontWeight: '900' },
  name: { flex: 1, fontWeight: '800' },
  time: { width: 72, textAlign: 'right', fontWeight: '900' },
  empty: { marginTop: 22, opacity: 0.7, fontSize: 14 },
  tip: { marginTop: 18, fontWeight: '900' },
});
