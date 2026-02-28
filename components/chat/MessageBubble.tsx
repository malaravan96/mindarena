import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Image, Modal } from 'react-native';
import Animated, {
  makeMutable,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  interpolate,
  Easing,
  runOnJS,
  FadeIn,
  FadeOut,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import type { DmMessage, DmMessageStatus, DmReactionGroup } from '@/lib/types';
import { PollBubble } from '@/components/chat/PollBubble';
import { isSingleEmoji } from '@/lib/emojiUtils';
import { TwemojiSvg } from '@/components/chat/TwemojiSvg';

interface MessageBubbleProps {
  item: DmMessage;
  isOwn: boolean;
  onImagePress?: (url: string) => void;
  onVoicePress?: (url: string, messageId: string) => void;
  playingVoiceId?: string | null;
  reactions?: DmReactionGroup[];
  onReactionPress?: (emoji: string) => void;
  onLongPress?: () => void;
  replyTo?: DmMessage | null;
  onReplyQuotePress?: () => void;
  onSwipeReply?: () => void;
  peerName?: string;
  currentUserId?: string;
  isPinned?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onForward?: () => void;
}

function StatusIcon({ status }: { status?: DmMessageStatus }) {
  const { colors } = useTheme();
  if (!status || status === 'sent') {
    return <Ionicons name="checkmark" size={12} color={colors.textTertiary} />;
  }
  if (status === 'delivered') {
    return (
      <View style={{ flexDirection: 'row' }}>
        <Ionicons name="checkmark" size={12} color={colors.textTertiary} />
        <Ionicons name="checkmark" size={12} color={colors.textTertiary} style={{ marginLeft: -6 }} />
      </View>
    );
  }
  // seen
  return (
    <View style={{ flexDirection: 'row' }}>
      <Ionicons name="checkmark" size={12} color={colors.primary} />
      <Ionicons name="checkmark" size={12} color={colors.primary} style={{ marginLeft: -6 }} />
    </View>
  );
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(secs?: number | null): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getReplyPreview(msg: DmMessage): string {
  const type = msg.message_type ?? 'text';
  if (type === 'image') return '[image]';
  if (type === 'voice') return '[voice message]';
  if (type === 'video') return '[video]';
  if (type === 'file') return '[file]';
  return msg.body || '';
}

interface ReplyQuoteBoxProps {
  replyTo: DmMessage;
  senderName: string;
  onPress?: () => void;
  primaryColor: string;
  textColor: string;
  surfaceColor: string;
}

function ReplyQuoteBox({ replyTo, senderName, onPress, primaryColor, textColor, surfaceColor }: ReplyQuoteBoxProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.replyQuoteBox, { borderLeftColor: primaryColor, backgroundColor: surfaceColor }]}
    >
      <Text style={[styles.replyQuoteName, { color: primaryColor }]} numberOfLines={1}>
        {senderName}
      </Text>
      <Text style={[styles.replyQuoteBody, { color: textColor }]} numberOfLines={2}>
        {getReplyPreview(replyTo)}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Reaction pills with TwemojiSvg + animated entrance
// ---------------------------------------------------------------------------

interface ReactionPillsRowProps {
  reactions: DmReactionGroup[];
  onReactionPress?: (emoji: string) => void;
  isOwn: boolean;
  primaryColor: string;
  surfaceColor: string;
  borderColor: string;
  textColor: string;
}

const AnimatedReactionPill = React.memo(function AnimatedReactionPill({
  group,
  index,
  onReactionPress,
  primaryColor,
  surfaceColor,
  borderColor,
  textColor,
}: {
  group: DmReactionGroup;
  index: number;
  onReactionPress?: (emoji: string) => void;
  primaryColor: string;
  surfaceColor: string;
  borderColor: string;
  textColor: string;
}) {
  return (
    <Animated.View entering={FadeIn.delay(index * 50).springify().damping(12).stiffness(180)} exiting={FadeOut.duration(200)}>
      <Pressable
        onPress={() => onReactionPress?.(group.emoji)}
        style={[
          styles.reactionPill,
          {
            backgroundColor: group.reactedByMe ? `${primaryColor}18` : surfaceColor,
            borderColor: group.reactedByMe ? primaryColor : borderColor,
          },
        ]}
      >
        <TwemojiSvg emoji={group.emoji} size={14} />
        {group.count > 1 && (
          <Text style={[styles.reactionCount, { color: group.reactedByMe ? primaryColor : textColor }]}>
            {group.count}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
});

function ReactionPillsRow({ reactions, onReactionPress, isOwn, primaryColor, surfaceColor, borderColor, textColor }: ReactionPillsRowProps) {
  return (
    <View style={[styles.reactionRow, { justifyContent: isOwn ? 'flex-end' : 'flex-start' }]}>
      {reactions.map((group, i) => (
        <AnimatedReactionPill
          key={group.emoji}
          group={group}
          index={i}
          onReactionPress={onReactionPress}
          primaryColor={primaryColor}
          surfaceColor={surfaceColor}
          borderColor={borderColor}
          textColor={textColor}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// BurstOverlay — "Supernova" effect: squash → 12 multi-ring particles → sparkle settle
// ---------------------------------------------------------------------------

const BURST_INNER = 4;
const BURST_MID = 4;
const BURST_OUTER = 4;
const TOTAL_PARTICLES = BURST_INNER + BURST_MID + BURST_OUTER;
const SPARKLE_COUNT = 6;

interface BurstOverlayProps {
  visible: boolean;
  origin: { x: number; y: number };
  emoji: string;
  onDone: () => void;
}

interface ParticleConfig {
  angle: number; // radians
  radius: number;
  duration: number;
  sizeMultiplier: number;
}

function generateParticles(): ParticleConfig[] {
  const particles: ParticleConfig[] = [];
  // Inner ring: fast, short distance
  for (let i = 0; i < BURST_INNER; i++) {
    const angle = ((360 / BURST_INNER) * i + 15) * (Math.PI / 180);
    particles.push({ angle, radius: 80, duration: 450, sizeMultiplier: 0.7 });
  }
  // Mid ring: medium
  for (let i = 0; i < BURST_MID; i++) {
    const angle = ((360 / BURST_MID) * i + 0) * (Math.PI / 180);
    particles.push({ angle, radius: 140, duration: 550, sizeMultiplier: 1.0 });
  }
  // Outer ring: slow, far
  for (let i = 0; i < BURST_OUTER; i++) {
    const angle = ((360 / BURST_OUTER) * i + 30) * (Math.PI / 180);
    particles.push({ angle, radius: 200, duration: 650, sizeMultiplier: 0.6 });
  }
  return particles;
}

const PARTICLE_CONFIGS = generateParticles();

// Pre-computed sparkle positions (random-ish offsets around center)
const SPARKLE_OFFSETS = [
  { x: -50, y: -40 }, { x: 45, y: -35 },
  { x: -35, y: 30 }, { x: 55, y: 25 },
  { x: -15, y: -55 }, { x: 20, y: 50 },
];

const BurstOverlay = React.memo(function BurstOverlay({ visible, origin, emoji, onDone }: BurstOverlayProps) {
  // Main emoji squash/stretch
  const mainScale = useSharedValue(1);
  // Particle progress values (0 → 1)
  const particleProgress = useMemo(() => PARTICLE_CONFIGS.map(() => makeMutable(0)), []);
  // Sparkle scales
  const sparkleScales = useMemo(() => SPARKLE_OFFSETS.map(() => makeMutable(0)), []);

  useEffect(() => {
    if (!visible) return;

    // Reset
    mainScale.value = 1;
    particleProgress.forEach((p) => { p.value = 0; });
    sparkleScales.forEach((s) => { s.value = 0; });

    // Phase 1: Squash & stretch (0-300ms)
    mainScale.value = withSequence(
      withTiming(0.7, { duration: 80 }),
      withSpring(1.2, { damping: 4, stiffness: 300, mass: 0.6 }),
      withSpring(1.0, { damping: 10, stiffness: 120, mass: 1 }),
    );

    // Phase 2: Particle burst (100-700ms)
    particleProgress.forEach((p, i) => {
      const config = PARTICLE_CONFIGS[i];
      p.value = withDelay(80 + i * 15, withTiming(1, { duration: config.duration, easing: Easing.out(Easing.cubic) }));
    });

    // Phase 3: Sparkle twinkle (400-900ms)
    sparkleScales.forEach((s, i) => {
      s.value = withDelay(
        400 + i * 60,
        withSequence(
          withSpring(1, { damping: 6, stiffness: 200, mass: 0.4 }),
          withDelay(150, withTiming(0, { duration: 200 })),
        ),
      );
    });

    // Auto-close after animation
    const timer = setTimeout(onDone, 950);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onDone}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDone}>
        {/* Main emoji with squash/stretch */}
        <AnimatedBurstEmoji emoji={emoji} origin={origin} scaleValue={mainScale} size={72} />

        {/* Shockwave ring */}
        <ShockwaveRing origin={origin} />

        {/* Particles */}
        {PARTICLE_CONFIGS.map((config, i) => (
          <BurstParticle
            key={`p-${i}`}
            emoji={emoji}
            origin={origin}
            config={config}
            progress={particleProgress[i]}
          />
        ))}

        {/* Sparkles */}
        {SPARKLE_OFFSETS.map((offset, i) => (
          <SparkleView key={`s-${i}`} origin={origin} offset={offset} scale={sparkleScales[i]} />
        ))}
      </Pressable>
    </Modal>
  );
});

function AnimatedBurstEmoji({
  emoji, origin, scaleValue, size,
}: { emoji: string; origin: { x: number; y: number }; scaleValue: SharedValue<number>; size: number }) {
  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: origin.x - size / 2,
    top: origin.y - size / 2,
    transform: [{ scale: scaleValue.value }],
  }));

  return (
    <Animated.View style={style}>
      <TwemojiSvg emoji={emoji} size={size} />
    </Animated.View>
  );
}

function BurstParticle({
  emoji, origin, config, progress,
}: { emoji: string; origin: { x: number; y: number }; config: ParticleConfig; progress: SharedValue<number> }) {
  const particleSize = 32 * config.sizeMultiplier;
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const tx = Math.cos(config.angle) * config.radius * p;
    // Curved path: add a slight perpendicular offset that peaks at midpoint
    const perpendicular = Math.sin(config.angle + Math.PI / 2);
    const ty = Math.sin(config.angle) * config.radius * p + perpendicular * 20 * Math.sin(p * Math.PI);
    const s = interpolate(p, [0, 0.2, 0.5, 1], [0.2, 1.3, 1.0, 0.3]);
    const opacity = interpolate(p, [0, 0.15, 0.7, 1], [0, 1, 0.8, 0]);
    const rotation = p * 360 * (config.sizeMultiplier > 0.8 ? 1 : -1);

    return {
      position: 'absolute' as const,
      left: origin.x - particleSize / 2,
      top: origin.y - particleSize / 2,
      opacity,
      transform: [
        { translateX: tx },
        { translateY: ty },
        { scale: s },
        { rotate: `${rotation}deg` },
      ],
    };
  });

  return (
    <Animated.View style={style}>
      <TwemojiSvg emoji={emoji} size={particleSize} />
    </Animated.View>
  );
}

function ShockwaveRing({ origin }: { origin: { x: number; y: number } }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, []);

  const style = useAnimatedStyle(() => {
    const size = interpolate(progress.value, [0, 1], [20, 160]);
    const opacity = interpolate(progress.value, [0, 0.3, 1], [0.4, 0.2, 0]);
    return {
      position: 'absolute' as const,
      left: origin.x - size / 2,
      top: origin.y - size / 2,
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 2,
      borderColor: `rgba(255,255,255,${opacity})`,
    };
  });

  return <Animated.View style={style} />;
}

function SparkleView({
  origin, offset, scale,
}: { origin: { x: number; y: number }; offset: { x: number; y: number }; scale: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const s = scale.value;
    const rotation = s * 90;
    return {
      position: 'absolute' as const,
      left: origin.x + offset.x - 6,
      top: origin.y + offset.y - 6,
      width: 12,
      height: 12,
      opacity: s,
      transform: [{ scale: s }, { rotate: `${rotation}deg` }],
    };
  });

  return (
    <Animated.View style={style}>
      <View style={sparkleStyles.star}>
        <View style={sparkleStyles.horizontal} />
        <View style={sparkleStyles.vertical} />
      </View>
    </Animated.View>
  );
}

const sparkleStyles = StyleSheet.create({
  star: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  horizontal: { position: 'absolute', width: 12, height: 2, backgroundColor: '#FFD700', borderRadius: 1 },
  vertical: { position: 'absolute', width: 2, height: 12, backgroundColor: '#FFD700', borderRadius: 1 },
});

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

export function MessageBubble({
  item,
  isOwn,
  onImagePress,
  onVoicePress,
  playingVoiceId,
  reactions,
  onReactionPress,
  onLongPress,
  replyTo,
  onReplyQuotePress,
  onSwipeReply,
  peerName,
  currentUserId,
  isPinned,
}: MessageBubbleProps) {
  const { colors } = useTheme();
  const msgType = item.message_type ?? 'text';
  const isDeleted = item.is_deleted === true;
  const isEdited = !isDeleted && !!item.edited_at;
  const timeStr = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const bubbleBg = isOwn ? `${colors.primary}16` : colors.surfaceVariant;
  const bubbleBorder = isOwn ? `${colors.primary}35` : colors.border;

  // --- Swipe-to-reply gesture (Reanimated + Gesture Handler) ---
  const swipeX = useSharedValue(0);

  const fireSwipeReply = useCallback(() => {
    onSwipeReply?.();
  }, [onSwipeReply]);

  const panGesture = Gesture.Pan()
    .activeOffsetX(8)
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      if (e.translationX > 0) {
        swipeX.value = Math.min(e.translationX, 80);
      }
    })
    .onEnd((e) => {
      if (e.translationX > 50) {
        runOnJS(fireSwipeReply)();
      }
      swipeX.value = withSpring(0, { damping: 10, stiffness: 80, mass: 1 });
    });

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));

  const replyIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(swipeX.value, [0, 40], [0, 1], 'clamp'),
  }));

  // --- Big emoji detection ---
  const replyQuoteSenderName = replyTo
    ? replyTo.sender_id === currentUserId
      ? 'You'
      : peerName ?? 'Peer'
    : '';

  const isBigEmoji =
    msgType === 'text' && !isDeleted && !replyTo && isSingleEmoji(item.body ?? '');

  // --- Big emoji idle: compound "Breathe & Hover" animation ---
  const floatY = useSharedValue(0);
  const wiggleRot = useSharedValue(0);
  const breatheScale = useSharedValue(1);

  useEffect(() => {
    if (!isBigEmoji) return;

    // Float: 0 → -4 → 0, period 2000ms
    floatY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // infinite
      true,
    );

    // Wiggle: -2deg → 2deg, period 2400ms
    wiggleRot.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(2, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // Breathe: 1.0 → 1.04, period 1600ms
    breatheScale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    return () => {
      floatY.value = 0;
      wiggleRot.value = 0;
      breatheScale.value = 1;
    };
  }, [isBigEmoji]);

  const bigEmojiIdleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { rotate: `${wiggleRot.value}deg` },
      { scale: breatheScale.value },
    ],
  }));

  // --- Burst state ---
  const emojiRef = useRef<View>(null);
  const [burstVisible, setBurstVisible] = useState(false);
  const [burstOrigin, setBurstOrigin] = useState({ x: 0, y: 0 });

  const handleBigEmojiPress = () => {
    emojiRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      setBurstOrigin({ x: pageX + width / 2, y: pageY + height / 2 });
      setBurstVisible(true);
    });
  };

  // --- Emoji-only message entrance ---
  const entranceScale = useSharedValue(isBigEmoji ? 0 : 1);
  const entranceY = useSharedValue(isBigEmoji ? 30 : 0);

  useEffect(() => {
    if (!isBigEmoji) return;
    entranceScale.value = withSpring(1, { damping: 6, stiffness: 150, mass: 0.8 });
    entranceY.value = withSpring(0, { damping: 8, stiffness: 120, mass: 0.8 });
  }, [isBigEmoji]);

  const entranceStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: entranceScale.value },
      { translateY: entranceY.value },
    ],
  }));

  const renderContent = () => {
    if (isDeleted) {
      return (
        <Text style={[styles.deletedText, { color: colors.textSecondary }]}>
          This message was deleted
        </Text>
      );
    }

    if (msgType === 'poll') {
      let pollId: string | null = null;
      try { pollId = JSON.parse(item.body)?.poll_id ?? null; } catch { /* ignore */ }
      if (pollId) {
        return <PollBubble pollId={pollId} currentUserId={currentUserId ?? null} />;
      }
      return <Text style={[styles.msgBody, { color: colors.textSecondary, fontStyle: 'italic' }]}>Poll unavailable</Text>;
    }

    if (msgType === 'image' && item.attachment_url) {
      return (
        <Pressable onPress={() => onImagePress?.(item.attachment_url!)}>
          <Image
            source={{ uri: item.attachment_url }}
            style={styles.imageThumbnail}
            resizeMode="cover"
          />
          {item.body ? (
            <Text style={[styles.msgBody, { color: colors.text, marginTop: spacing.xs }]}>{item.body}</Text>
          ) : null}
        </Pressable>
      );
    }

    if (msgType === 'voice' && item.attachment_url) {
      const isPlaying = playingVoiceId === item.id;
      return (
        <Pressable
          style={styles.voiceRow}
          onPress={() => onVoicePress?.(item.attachment_url!, item.id)}
        >
          <View style={[styles.voiceIconWrap, { backgroundColor: `${colors.primary}20` }]}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={18}
              color={colors.primary}
            />
          </View>
          <View>
            <Text style={[styles.voiceLabel, { color: colors.text }]}>Voice message</Text>
            {item.attachment_duration ? (
              <Text style={[styles.voiceDuration, { color: colors.textSecondary }]}>
                {formatDuration(item.attachment_duration)}
              </Text>
            ) : null}
          </View>
        </Pressable>
      );
    }

    if (msgType === 'video' && item.attachment_url) {
      return (
        <Pressable
          style={styles.videoThumb}
          onPress={() => onImagePress?.(item.attachment_url!)}
        >
          <View style={[styles.videoOverlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
            <Ionicons name="play-circle" size={36} color="#fff" />
          </View>
          {item.body ? (
            <Text style={[styles.msgBody, { color: colors.text, marginTop: spacing.xs }]}>{item.body}</Text>
          ) : null}
        </Pressable>
      );
    }

    if (msgType === 'file' && item.attachment_url) {
      const filename = item.body || 'File';
      return (
        <Pressable
          style={styles.fileRow}
          onPress={() => Linking.openURL(item.attachment_url!).catch(() => null)}
        >
          <View style={[styles.fileIcon, { backgroundColor: `${colors.secondary}20` }]}>
            <Ionicons name="document-outline" size={20} color={colors.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={2}>{filename}</Text>
            {item.attachment_size ? (
              <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
                {formatBytes(item.attachment_size)}
              </Text>
            ) : null}
          </View>
          <Ionicons name="download-outline" size={16} color={colors.textSecondary} />
        </Pressable>
      );
    }

    // Default: text
    if (isBigEmoji) {
      return (
        <Animated.View style={entranceStyle}>
          <View ref={emojiRef} style={styles.bigEmojiWrap} collapsable={false}>
            <Pressable onPress={handleBigEmojiPress} hitSlop={12}>
              <Animated.View style={bigEmojiIdleStyle}>
                <TwemojiSvg emoji={item.body ?? ''} size={72} />
              </Animated.View>
            </Pressable>
          </View>
        </Animated.View>
      );
    }
    return (
      <View>
        <Text style={[styles.msgBody, { color: colors.text }]}>{item.body}</Text>
        {isEdited && (
          <Text style={[styles.editedLabel, { color: colors.textTertiary }]}>(edited)</Text>
        )}
      </View>
    );
  };

  const hasReactions = !isDeleted && reactions && reactions.length > 0;

  return (
    <View style={{ position: 'relative' }}>
      {/* Reply icon revealed as bubble slides right */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 4,
            top: 0,
            bottom: 0,
            justifyContent: 'center',
            zIndex: 0,
          },
          replyIconStyle,
        ]}
      >
        <View style={{ backgroundColor: `${colors.primary}20`, borderRadius: 20, padding: 6 }}>
          <Ionicons name="return-up-forward" size={18} color={colors.primary} />
        </View>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[styles.msgRow, { alignItems: isOwn ? 'flex-end' : 'flex-start' }, swipeStyle]}
        >
          <Pressable onLongPress={!isDeleted ? onLongPress : undefined} delayLongPress={350}>
            <View
              style={[
                styles.bubble,
                isBigEmoji
                  ? styles.bigEmojiBubble
                  : {
                      backgroundColor: isDeleted ? `${colors.textTertiary}10` : bubbleBg,
                      borderColor: isDeleted ? colors.border : bubbleBorder,
                    },
              ]}
            >
              {isPinned && !isDeleted && (
                <View style={styles.pinBadge}>
                  <Ionicons name="pin" size={10} color={colors.primary} />
                </View>
              )}
              {replyTo && !isDeleted && (
                <ReplyQuoteBox
                  replyTo={replyTo}
                  senderName={replyQuoteSenderName}
                  onPress={onReplyQuotePress}
                  primaryColor={colors.primary}
                  textColor={colors.textSecondary}
                  surfaceColor={`${colors.primary}0d`}
                />
              )}
              {renderContent()}
            </View>
          </Pressable>
          <View style={styles.metaRow}>
            <Text style={[styles.msgTime, { color: colors.textTertiary }]}>{timeStr}</Text>
            {isOwn && !isDeleted && <StatusIcon status={item.status} />}
          </View>
          {hasReactions && (
            <ReactionPillsRow
              reactions={reactions!}
              onReactionPress={onReactionPress}
              isOwn={isOwn}
              primaryColor={colors.primary}
              surfaceColor={colors.surface}
              borderColor={colors.border}
              textColor={colors.textSecondary}
            />
          )}
        </Animated.View>
      </GestureDetector>

      {isBigEmoji && (
        <BurstOverlay
          visible={burstVisible}
          origin={burstOrigin}
          emoji={item.body ?? ''}
          onDone={() => setBurstVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  msgRow: { gap: 4 },
  bubble: {
    maxWidth: '84%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  msgBody: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  msgTime: { fontSize: fontSize.xs },
  imageThumbnail: { width: 200, height: 150, borderRadius: borderRadius.md },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  voiceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  voiceDuration: { fontSize: fontSize.xs, marginTop: 2 },
  videoThumb: {
    width: 200,
    height: 150,
    borderRadius: borderRadius.md,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  fileSize: { fontSize: fontSize.xs, marginTop: 2 },
  deletedText: { fontSize: fontSize.sm, fontStyle: 'italic' },
  editedLabel: { fontSize: 10, fontStyle: 'italic', marginTop: 2, textAlign: 'right' },
  pinBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 1,
  },
  // Reply quote box
  replyQuoteBox: {
    borderLeftWidth: 3,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.xs,
    gap: 2,
  },
  replyQuoteName: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  replyQuoteBody: { fontSize: fontSize.xs, lineHeight: fontSize.xs * 1.4 },
  // Reaction pills
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    maxWidth: '84%',
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  reactionCount: { fontSize: 11, fontWeight: fontWeight.semibold },
  // Big emoji
  bigEmojiBubble: { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0 },
  bigEmojiWrap: { alignItems: 'center', justifyContent: 'center', padding: spacing.xs },
});
