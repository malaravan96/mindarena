import React, { useEffect } from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, spacing } from '@/constants/theme';
import { TwemojiSvg } from '@/components/chat/TwemojiSvg';

const QUICK_REACTIONS = ['👍', '🔥', '🧠', '⚡', '😂', '❤️'];

interface ReactionPickerProps {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

interface ReactionItemProps {
  emoji: string;
  index: number;
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const ReactionItem = React.memo(function ReactionItem({ emoji, index, visible, onSelect, onClose }: ReactionItemProps) {
  const scale = useSharedValue(0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      scale.value = withDelay(index * 40, withSpring(1, { damping: 8, stiffness: 200, mass: 0.6 }));
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
    // Scale up selected, then fire callback
    scale.value = withSpring(1.5, { damping: 4, stiffness: 300, mass: 0.5 });
    pressScale.value = withTiming(0, { duration: 200 });
    // Small delay for the visual before closing
    setTimeout(() => {
      onSelect(emoji);
      onClose();
    }, 150);
  };

  return (
    <Pressable onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.emojiBtn}>
      <Animated.View style={animStyle}>
        <TwemojiSvg emoji={emoji} size={28} />
      </Animated.View>
    </Pressable>
  );
});

export function ReactionPicker({ visible, onSelect, onClose }: ReactionPickerProps) {
  const { colors } = useTheme();
  const containerY = useSharedValue(-30);
  const containerOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.centeredWrap} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.pill,
            { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.text },
            containerStyle,
          ]}
        >
          {QUICK_REACTIONS.map((emoji, i) => (
            <ReactionItem
              key={emoji}
              emoji={emoji}
              index={i}
              visible={visible}
              onSelect={onSelect}
              onClose={onClose}
            />
          ))}
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
});
