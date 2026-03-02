import React, { useEffect, useState, useCallback } from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, spacing } from '@/constants/theme';
import { TwemojiSvg } from '@/components/chat/TwemojiSvg';

const REACTION_FREQ_KEY = 'reaction_frequencies';
const DEFAULT_REACTIONS = ['👍', '❤️', '😂', '🔥', '🧠', '⚡', '😢', '👏'];
const DISPLAY_COUNT = 8;

async function getTopReactions(): Promise<string[]> {
  try {
    const stored = await SecureStore.getItemAsync(REACTION_FREQ_KEY);
    if (!stored) return DEFAULT_REACTIONS;
    const freq: Record<string, number> = JSON.parse(stored);
    const sorted = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([emoji]) => emoji);
    if (sorted.length >= DISPLAY_COUNT) return sorted.slice(0, DISPLAY_COUNT);
    // Pad with defaults that aren't already in sorted
    const result = [...sorted];
    for (const d of DEFAULT_REACTIONS) {
      if (result.length >= DISPLAY_COUNT) break;
      if (!result.includes(d)) result.push(d);
    }
    return result;
  } catch {
    return DEFAULT_REACTIONS;
  }
}

async function recordReactionUsage(emoji: string): Promise<void> {
  try {
    const stored = await SecureStore.getItemAsync(REACTION_FREQ_KEY);
    const freq: Record<string, number> = stored ? JSON.parse(stored) : {};
    freq[emoji] = (freq[emoji] ?? 0) + 1;
    await SecureStore.setItemAsync(REACTION_FREQ_KEY, JSON.stringify(freq));
  } catch {
    /* ignore */
  }
}

interface ReactionItemProps {
  emoji: string;
  index: number;
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const ReactionItem = React.memo(function ReactionItem({
  emoji,
  index,
  visible,
  onSelect,
  onClose,
}: ReactionItemProps) {
  const scale = useSharedValue(0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      scale.value = withDelay(
        index * 35,
        withSpring(1, { damping: 8, stiffness: 200, mass: 0.6 }),
      );
    } else {
      scale.value = 0;
    }
  }, [visible, index, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pressScale.value }],
  }));

  const handlePressIn = () => {
    pressScale.value = withSpring(1.3, { damping: 6, stiffness: 200, mass: 0.5 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 8, stiffness: 150, mass: 0.6 });
  };

  const handlePress = () => {
    scale.value = withSpring(1.5, { damping: 4, stiffness: 300, mass: 0.5 });
    pressScale.value = withTiming(0, { duration: 200 });
    recordReactionUsage(emoji);
    setTimeout(() => {
      onSelect(emoji);
      onClose();
    }, 150);
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.emojiBtn}
    >
      <Animated.View style={animStyle}>
        <TwemojiSvg emoji={emoji} size={28} />
      </Animated.View>
    </Pressable>
  );
});

interface ReactionPickerProps {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  onOpenFullPicker?: () => void;
}

export function ReactionPicker({
  visible,
  onSelect,
  onClose,
  onOpenFullPicker,
}: ReactionPickerProps) {
  const { colors } = useTheme();
  const [reactions, setReactions] = useState<string[]>(DEFAULT_REACTIONS);

  const containerY = useSharedValue(-30);
  const containerOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      getTopReactions().then(setReactions);
      containerOpacity.value = withTiming(1, { duration: 150 });
      containerY.value = withSpring(0, { damping: 12, stiffness: 180, mass: 0.8 });
    } else {
      containerOpacity.value = 0;
      containerY.value = -30;
    }
  }, [visible, containerOpacity, containerY]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ translateY: containerY.value }],
  }));

  const handleOpenFull = useCallback(() => {
    onClose();
    onOpenFullPicker?.();
  }, [onClose, onOpenFullPicker]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.centeredWrap} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.pill,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.text,
            },
            containerStyle,
          ]}
        >
          {reactions.map((emoji, i) => (
            <ReactionItem
              key={emoji}
              emoji={emoji}
              index={i}
              visible={visible}
              onSelect={onSelect}
              onClose={onClose}
            />
          ))}
          {/* "+" button to open full emoji picker */}
          {onOpenFullPicker && (
            <Pressable onPress={handleOpenFull} style={styles.addBtn}>
              <Ionicons name="add-circle-outline" size={26} color={colors.textSecondary} />
            </Pressable>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  centeredWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  addBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
});
