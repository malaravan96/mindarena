import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listTournaments } from '@/lib/tournaments';
import { TournamentCard } from '@/components/tournament/TournamentCard';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { Tournament } from '@/lib/types';

type Tab = 'upcoming' | 'active' | 'completed';

const TABS: { key: Tab; label: string }[] = [
  { key: 'active', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Past' },
];

export default function Tournaments() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    loadTournaments();
  }, [tab]);

  async function loadTournaments() {
    setLoading(true);
    try {
      const data = await listTournaments(tab);
      setTournaments(data);
    } catch (e) {
      console.error('Tournaments load error:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Tournaments</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Compete for prizes and glory</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[
                styles.tab,
                {
                  borderColor: active ? `${colors.primary}40` : colors.border,
                  backgroundColor: active ? `${colors.primary}12` : colors.surface,
                },
              ]}
            >
              <Text style={[styles.tabText, { color: active ? colors.primary : colors.text }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : tournaments.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="trophy-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No tournaments</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            {tab === 'active' ? 'No live tournaments right now.' : tab === 'upcoming' ? 'No upcoming tournaments scheduled.' : 'No past tournaments found.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
          showsVerticalScrollIndicator={false}
        >
          {tournaments.map((t) => (
            <TournamentCard
              key={t.id}
              tournament={t}
              onPress={() => router.push({ pathname: '/tournament-detail', params: { id: t.id } })}
            />
          ))}
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
  headerSubtitle: { fontSize: fontSize.xs, marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  tab: { flex: 1, borderWidth: 1, borderRadius: borderRadius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  emptyDesc: { fontSize: fontSize.base, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
});
