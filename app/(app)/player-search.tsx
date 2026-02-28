import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { searchPlayers } from '@/lib/playerSearch';
import { Input } from '@/components/Input';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';

type PlayerResult = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_points: number;
  is_online?: boolean;
  level?: number;
};

export default function PlayerSearch() {
  const router = useRouter();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    let active = true;
    const text = query.trim();

    if (text.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError('');
      return () => {
        active = false;
      };
    }

    setSearching(true);
    setSearchError('');
    const timer = setTimeout(async () => {
      try {
        const data = await searchPlayers(text);
        if (!active) return;
        setResults(data as PlayerResult[]);
      } catch (e) {
        console.error('Search error:', e);
        if (active) {
          setSearchError('Could not search players right now. Please try again.');
          setResults([]);
        }
      } finally {
        if (active) setSearching(false);
      }
    }, 260);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Find Players</Text>
      </View>

      <View style={styles.searchWrap}>
        <Input
          placeholder="Search by username..."
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          icon="search-outline"
          clearable
          helperText={
            query.trim().length < 2
              ? 'Type at least 2 characters to search.'
              : undefined
          }
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        {searching && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        {searchError ? (
          <Text style={[styles.noResults, { color: colors.error }]}>{searchError}</Text>
        ) : null}

        {results.map((player) => (
          <Pressable
            key={player.id}
            onPress={() => router.push({ pathname: '/player-profile', params: { id: player.id } })}
            style={[styles.playerRow, { borderColor: colors.border }]}
          >
            {player.avatar_url ? (
              <Image source={{ uri: player.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>
                  {(player.display_name || player.username || '?')[0]?.toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.playerInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.playerName, { color: colors.text }]}>
                  {player.display_name || player.username || 'Player'}
                </Text>
                {player.is_online && <View style={[styles.onlineDot, { backgroundColor: colors.correct }]} />}
              </View>
              <Text style={[styles.playerStats, { color: colors.textSecondary }]}>
                {player.total_points} pts{player.level ? ` - Lv.${player.level}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </Pressable>
        ))}

        {query.length >= 2 && !searching && results.length === 0 && (
          <Text style={[styles.noResults, { color: colors.textSecondary }]}>No players found</Text>
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
  searchWrap: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  loadingWrap: { padding: spacing.md, alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, alignSelf: 'center', width: '100%' },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  playerInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  playerName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  playerStats: { fontSize: fontSize.xs, marginTop: 2 },
  noResults: { textAlign: 'center', padding: spacing.lg, fontSize: fontSize.base },
});
