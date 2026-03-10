import React from 'react';
import { Pressable, Share, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing } from '@/constants/theme';

interface ProfileShareButtonProps {
  displayName: string;
  username: string | null;
  level: number;
  totalPoints: number;
}

export function ProfileShareButton({ displayName, username, level, totalPoints }: ProfileShareButtonProps) {
  const { colors } = useTheme();

  async function handleShare() {
    const handle = username ? ` @${username}` : '';
    const message = `Check out ${displayName} on MindArena! Level ${level} with ${totalPoints} points.${handle}`;
    try {
      await Share.share({ message });
    } catch {
      // user cancelled
    }
  }

  return (
    <Pressable
      onPress={handleShare}
      hitSlop={8}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: `${colors.primary}12`, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name="share-outline" size={18} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
});
