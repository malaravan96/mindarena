import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing, chatModal } from '@/constants/theme';
import { TwemojiSvg } from '@/components/chat/TwemojiSvg';
import BottomSheet from '@/components/chat/BottomSheet';

const RECENT_STORAGE_KEY = 'emoji_picker_recent';
const MAX_RECENT = 30;

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

// Flatten all emojis for search
const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap((cat) =>
  cat.emojis.map((emoji) => ({ emoji, category: cat.label })),
);

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
}

const CategoryRow = React.memo(function CategoryRow({ cat, index, visible, colors, onSelect }: CategoryRowProps) {
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
            onPress={() => onSelect(emoji)}
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
  const [searchQuery, setSearchQuery] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  // Load recent emojis on mount
  useEffect(() => {
    if (visible) {
      SecureStore.getItemAsync(RECENT_STORAGE_KEY).then((val) => {
        if (val) {
          try {
            setRecentEmojis(JSON.parse(val));
          } catch {
            /* ignore */
          }
        }
      });
    } else {
      setSearchQuery('');
    }
  }, [visible]);

  const saveRecent = useCallback(async (emoji: string) => {
    const updated = [emoji, ...recentEmojis.filter((e) => e !== emoji)].slice(0, MAX_RECENT);
    setRecentEmojis(updated);
    await SecureStore.setItemAsync(RECENT_STORAGE_KEY, JSON.stringify(updated));
  }, [recentEmojis]);

  const handleSelect = useCallback((emoji: string) => {
    saveRecent(emoji);
    onSelect(emoji);
    onClose();
  }, [saveRecent, onSelect, onClose]);

  // Search filtering
  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return ALL_EMOJIS.filter((e) => e.category.toLowerCase().includes(q)).map((e) => e.emoji);
  }, [searchQuery]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Emoji">
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
        <Ionicons name="search" size={16} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search emoji..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {filteredResults ? (
          // Search results
          <View style={styles.category}>
            <Text style={[styles.catLabel, { color: colors.textSecondary }]}>Search Results</Text>
            {filteredResults.length > 0 ? (
              <View style={styles.emojiGrid}>
                {filteredResults.map((emoji) => (
                  <AnimatedEmoji key={emoji} emoji={emoji} onPress={() => handleSelect(emoji)} />
                ))}
              </View>
            ) : (
              <Text style={[styles.emptySearch, { color: colors.textTertiary }]}>
                No emojis found
              </Text>
            )}
          </View>
        ) : (
          <>
            {/* Recently Used */}
            {recentEmojis.length > 0 && (
              <View style={styles.category}>
                <Text style={[styles.catLabel, { color: colors.textSecondary }]}>Recently Used</Text>
                <View style={styles.emojiGrid}>
                  {recentEmojis.map((emoji) => (
                    <AnimatedEmoji key={`recent-${emoji}`} emoji={emoji} onPress={() => handleSelect(emoji)} />
                  ))}
                </View>
              </View>
            )}

            {/* All categories */}
            {EMOJI_CATEGORIES.map((cat, i) => (
              <CategoryRow
                key={cat.label}
                cat={cat}
                index={i + (recentEmojis.length > 0 ? 1 : 0)}
                visible={visible}
                colors={colors}
                onSelect={handleSelect}
              />
            ))}
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    padding: 0,
    margin: 0,
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
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearch: {
    textAlign: 'center',
    paddingVertical: spacing.lg,
    fontSize: fontSize.sm,
  },
});
