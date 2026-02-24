import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getAllFrames, getUnlockedFrames, equipFrame } from '@/lib/avatarFrames';
import { getUserTitles, equipTitle } from '@/lib/achievements';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { showAlert } from '@/lib/alert';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { AvatarFrame } from '@/lib/types';

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280',
  uncommon: '#10b981',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

export default function AvatarCustomization() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [frames, setFrames] = useState<AvatarFrame[]>([]);
  const [unlockedFrames, setUnlockedFrames] = useState<string[]>([]);
  const [equippedFrame, setEquippedFrame] = useState<string>('default');
  const [titles, setTitles] = useState<string[]>([]);
  const [equippedTitle, setEquippedTitle] = useState<string>('Newcomer');
  const [userId, setUserId] = useState<string | null>(null);

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

      const [allFrames, unlocked, userTitles, profileData] = await Promise.all([
        getAllFrames(),
        getUnlockedFrames(uid),
        getUserTitles(uid),
        supabase.from('profiles').select('avatar_frame, title').eq('id', uid).maybeSingle<{ avatar_frame: string; title: string }>(),
      ]);

      setFrames(allFrames);
      setUnlockedFrames(unlocked);
      setTitles(userTitles.length > 0 ? userTitles : ['Newcomer']);
      setEquippedFrame(profileData.data?.avatar_frame ?? 'default');
      setEquippedTitle(profileData.data?.title ?? 'Newcomer');
    } catch (e) {
      console.error('Customization load error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleEquipFrame(frameId: string) {
    if (!userId) return;
    const success = await equipFrame(userId, frameId);
    if (success) {
      setEquippedFrame(frameId);
      showAlert('Frame equipped', 'Your avatar frame has been updated!');
    }
  }

  async function handleEquipTitle(title: string) {
    if (!userId) return;
    await equipTitle(userId, title);
    setEquippedTitle(title);
    showAlert('Title equipped', `Your title is now "${title}"!`);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Customize Avatar</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 720 : undefined }]}
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.sectionCard} padding="lg">
            <View style={styles.sectionHeader}>
              <Ionicons name="ellipse-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Avatar Frames</Text>
            </View>
            <View style={styles.frameGrid}>
              {frames.map((frame) => {
                const isUnlocked = unlockedFrames.includes(frame.id);
                const isEquipped = equippedFrame === frame.id;
                const rarityColor = RARITY_COLORS[frame.rarity] ?? RARITY_COLORS.common;

                return (
                  <Pressable
                    key={frame.id}
                    onPress={() => isUnlocked && handleEquipFrame(frame.id)}
                    disabled={!isUnlocked}
                    style={[
                      styles.frameCard,
                      {
                        borderColor: isEquipped ? colors.primary : isUnlocked ? `${rarityColor}40` : colors.border,
                        backgroundColor: isEquipped ? `${colors.primary}10` : isUnlocked ? colors.surface : colors.surfaceVariant,
                        opacity: isUnlocked ? 1 : 0.5,
                      },
                    ]}
                  >
                    <View style={[styles.framePreview, { borderColor: frame.border_color, borderWidth: frame.border_width }]}>
                      <Ionicons name="person" size={20} color={isUnlocked ? frame.border_color : colors.textTertiary} />
                    </View>
                    <Text style={[styles.frameName, { color: isUnlocked ? colors.text : colors.textTertiary }]} numberOfLines={1}>
                      {frame.name}
                    </Text>
                    <Text style={[styles.frameRarity, { color: rarityColor }]}>
                      {frame.rarity.charAt(0).toUpperCase() + frame.rarity.slice(1)}
                    </Text>
                    {!isUnlocked && (
                      <Text style={[styles.lockText, { color: colors.textTertiary }]}>Lv.{frame.unlock_level}</Text>
                    )}
                    {isEquipped && (
                      <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card style={styles.sectionCard} padding="lg">
            <View style={styles.sectionHeader}>
              <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Titles</Text>
            </View>
            <View style={styles.titleGrid}>
              {titles.map((title) => {
                const isEquipped = equippedTitle === title;
                return (
                  <Pressable
                    key={title}
                    onPress={() => handleEquipTitle(title)}
                    style={[
                      styles.titleChip,
                      {
                        borderColor: isEquipped ? colors.primary : colors.border,
                        backgroundColor: isEquipped ? `${colors.primary}12` : colors.surface,
                      },
                    ]}
                  >
                    <Text style={[styles.titleText, { color: isEquipped ? colors.primary : colors.text }]}>
                      {title}
                    </Text>
                    {isEquipped && <Ionicons name="checkmark-circle" size={14} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <View style={{ height: spacing.xxl + 70 }} />
        </ScrollView>
      )}
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
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
  sectionCard: { marginBottom: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black },
  frameGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  frameCard: {
    width: '30%' as any,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 4,
  },
  framePreview: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  frameName: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textAlign: 'center' },
  frameRarity: { fontSize: 10, fontWeight: fontWeight.semibold },
  lockText: { fontSize: 10, fontWeight: fontWeight.medium },
  titleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  titleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  titleText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
