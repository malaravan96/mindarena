import React, { useEffect } from 'react';
import { Modal, View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import { TwemojiSvg } from '@/components/chat/TwemojiSvg';

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫'],
  },
  {
    label: 'People',
    emojis: ['👋','🤚','🖐','✋','🖖','👌','🤌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝'],
  },
  {
    label: 'Nature',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄'],
  },
  {
    label: 'Food',
    emojis: ['🍎','🍊','🍋','🍇','🍓','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌽','🌶','🥕','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨'],
  },
  {
    label: 'Activities',
    emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🥍','🏑','🏏','🥅','⛳','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸','🤺','🏋️'],
  },
  {
    label: 'Travel',
    emojis: ['🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🛵','🏍','🛺','🚲','🛴','🛹','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚝'],
  },
  {
    label: 'Objects',
    emojis: ['⌚','📱','💻','🖥','🖨','⌨️','🖱','🖲','💽','💾','💿','📀','📷','📸','📹','🎥','📽','🎞','📞','☎️','📟','📠','📺','📻','🧭','⏱','⏰','⏲','⌛','⏳'],
  },
  {
    label: 'Symbols',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','✡️','🔯','🕎','☯️','☦️','🛐','♈'],
  },
];

interface AnimatedEmojiProps {
  emoji: string;
  onPress: () => void;
}

const AnimatedEmoji = React.memo(function AnimatedEmoji({ emoji, onPress }: AnimatedEmojiProps) {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.72, { damping: 8, stiffness: 200, mass: 0.5 });
    rotation.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-4, { duration: 40 }),
      withTiming(0, { duration: 40 }),
    );
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 6, stiffness: 120, mass: 0.8 });
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.emojiBtn}>
      <Animated.View style={animStyle}>
        <TwemojiSvg emoji={emoji} size={24} />
      </Animated.View>
    </Pressable>
  );
});

interface CategoryRowProps {
  cat: { label: string; emojis: string[] };
  index: number;
  visible: boolean;
  colors: any;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const CategoryRow = React.memo(function CategoryRow({ cat, index, visible, colors, onSelect, onClose }: CategoryRowProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    if (visible) {
      opacity.value = withDelay(index * 40, withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) }));
      translateY.value = withDelay(index * 40, withSpring(0, { damping: 18, stiffness: 160, mass: 1 }));
    } else {
      opacity.value = 0;
      translateY.value = 20;
    }
  }, [visible, index, opacity, translateY]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.category, rowStyle]}>
      <Text style={[styles.catLabel, { color: colors.textSecondary }]}>{cat.label}</Text>
      <View style={styles.emojiGrid}>
        {cat.emojis.map((emoji) => (
          <AnimatedEmoji
            key={emoji}
            emoji={emoji}
            onPress={() => { onSelect(emoji); onClose(); }}
          />
        ))}
      </View>
    </Animated.View>
  );
});

interface EmojiPickerProps {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ visible, onSelect, onClose }: EmojiPickerProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {EMOJI_CATEGORIES.map((cat, i) => (
            <CategoryRow
              key={cat.label}
              cat={cat}
              index={i}
              visible={visible}
              colors={colors}
              onSelect={onSelect}
              onClose={onClose}
            />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    maxHeight: '55%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  category: { gap: spacing.xs },
  catLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  emojiBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
