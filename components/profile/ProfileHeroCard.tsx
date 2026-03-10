import React from 'react';
import { View, Text, Pressable, Image, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card } from '@/components/Card';
import { XPProgressBar } from '@/components/rewards/XPProgressBar';
import { ProfileCompletenessRing } from './ProfileCompletenessRing';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';
import type { LevelInfo, Team } from '@/lib/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface HeroStats {
  totalPoints: number;
  streak: number;
  completion?: number;
}

interface ProfileHeroCardProps {
  avatarUrl: string | null;
  displayName: string;
  username: string | null;
  email?: string;
  bio?: string | null;
  isOnline?: boolean;
  levelInfo: LevelInfo | null;
  userTitle: string | null;
  stats: HeroStats;
  team: Team | null;
  isOwnProfile: boolean;
  onAvatarPress?: () => void;
  uploadingAvatar?: boolean;
}

function HeroStatPill({
  icon,
  value,
  label,
  accent,
}: {
  icon: IconName;
  value: string;
  label: string;
  accent: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.heroStat, { borderColor: `${accent}30`, backgroundColor: `${colors.surface}95` }]}>
      <View style={[styles.heroStatIcon, { backgroundColor: `${accent}15` }]}>
        <Ionicons name={icon} size={14} color={accent} />
      </View>
      <Text style={[styles.heroStatValue, { color: accent }]}>{value}</Text>
      <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

export const ProfileHeroCard = React.memo(function ProfileHeroCard({
  avatarUrl,
  displayName,
  username,
  email,
  bio,
  isOnline,
  levelInfo,
  userTitle,
  stats,
  team,
  isOwnProfile,
  onAvatarPress,
  uploadingAvatar,
}: ProfileHeroCardProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const profileName = displayName || username || (isOwnProfile ? 'MindArena Player' : 'Player');
  const initials = displayName
    ? displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : (email?.[0] ?? username?.[0] ?? '?').toUpperCase();

  const avatarContent = avatarUrl ? (
    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
  ) : (
    <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );

  return (
    <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.wrapper}>
      <Card style={styles.heroCard} padding="lg">
        <View style={[styles.blobOne, { backgroundColor: `${colors.primary}18` }]} />
        <View style={[styles.blobTwo, { backgroundColor: `${colors.secondary}16` }]} />

        <View style={styles.topRow}>
          {isOwnProfile && onAvatarPress ? (
            <Pressable
              onPress={onAvatarPress}
              disabled={uploadingAvatar}
              style={({ pressed }) => [
                styles.avatarWrapper,
                { borderColor: `${colors.surface}90`, transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              {avatarContent}
              <View style={[styles.cameraBadge, { backgroundColor: colors.surface }]}>
                <Ionicons name="camera" size={16} color={colors.primary} />
              </View>
              {uploadingAvatar && (
                <View style={[styles.avatarOverlay, { backgroundColor: colors.overlay }]}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </Pressable>
          ) : (
            <View style={[styles.avatarWrapper, { borderColor: `${colors.surface}90` }]}>
              {avatarContent}
              {isOnline && (
                <View style={[styles.onlineDot, { backgroundColor: colors.correct, borderColor: colors.surface }]} />
              )}
            </View>
          )}

          <View style={styles.identity}>
            <View
              style={[
                styles.identityPill,
                { backgroundColor: `${colors.primary}16`, borderColor: `${colors.primary}35` },
              ]}
            >
              <Ionicons name="sparkles" size={13} color={colors.primary} />
              <Text style={[styles.identityPillText, { color: colors.primary }]}>
                {userTitle ? `Lv.${levelInfo?.level ?? 1} ${userTitle}` : 'Puzzle Challenger'}
              </Text>
            </View>
            <View style={styles.nameRow}>
              <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={1}>
                {profileName}
              </Text>
              {!isOwnProfile && isOnline == null ? null : null}
            </View>
            {isOwnProfile && email ? (
              <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
            {!isOwnProfile && username ? (
              <Text style={[styles.usernameText, { color: colors.textSecondary }]}>@{username}</Text>
            ) : null}
            {!isOwnProfile && bio ? (
              <Text style={[styles.bioText, { color: colors.textSecondary }]} numberOfLines={3}>
                {bio}
              </Text>
            ) : null}
          </View>

          {isOwnProfile && stats.completion != null && (
            <ProfileCompletenessRing completion={stats.completion} />
          )}
        </View>

        <View style={styles.statsRow}>
          <HeroStatPill
            icon="trophy-outline"
            label="Points"
            value={String(stats.totalPoints)}
            accent={colors.primary}
          />
          <HeroStatPill
            icon="flame-outline"
            label="Streak"
            value={String(stats.streak)}
            accent={colors.warning}
          />
          {!isOwnProfile && (
            <HeroStatPill
              icon="shield-half-outline"
              label="Level"
              value={String(levelInfo?.level ?? 1)}
              accent={colors.correct}
            />
          )}
        </View>

        {levelInfo && (
          <View style={{ marginTop: spacing.md }}>
            <XPProgressBar
              level={levelInfo.level}
              xp={levelInfo.xp}
              xpForCurrent={levelInfo.xpForCurrent}
              xpForNext={levelInfo.xpForNext}
              progress={levelInfo.progress}
              title={levelInfo.title}
              compact
            />
          </View>
        )}

        {team && (
          <Pressable
            onPress={() => router.push({ pathname: '/team-detail', params: { id: team.id } })}
            style={[styles.teamPill, { backgroundColor: `${colors.secondary}15`, borderColor: `${colors.secondary}35` }]}
          >
            <Ionicons name="people" size={14} color={colors.secondary} />
            <Text style={[styles.teamPillText, { color: colors.secondary }]}>{team.name}</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.secondary} />
          </Pressable>
        )}
      </Card>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  heroCard: { overflow: 'hidden' },
  blobOne: {
    position: 'absolute',
    top: -36,
    right: -24,
    width: 132,
    height: 132,
    borderRadius: 66,
  },
  blobTwo: {
    position: 'absolute',
    bottom: -56,
    left: -34,
    width: 156,
    height: 156,
    borderRadius: 78,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    borderWidth: 3,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black, color: '#fff' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  identity: { flex: 1, minWidth: 0 },
  identityPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  identityPillText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heroName: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  email: { fontSize: fontSize.sm, marginTop: 2 },
  usernameText: { fontSize: fontSize.sm, marginTop: 2 },
  bioText: { fontSize: fontSize.sm, marginTop: spacing.xs, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  heroStat: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  heroStatIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  heroStatValue: { fontSize: fontSize.base, fontWeight: fontWeight.black },
  heroStatLabel: { fontSize: fontSize.xs, marginTop: 2 },
  teamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  teamPillText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
