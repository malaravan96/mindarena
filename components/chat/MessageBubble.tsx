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
import {
  borderRadius,
  fontSize,
  fontWeight,
  spacing,
  chatBubble,
  chatMedia,
  chatStatus,
} from '@/constants/theme';
import type { DmMessage, DmMessageStatus, DmReactionGroup } from '@/lib/types';
import { PollBubble } from '@/components/chat/PollBubble';
import { isSingleEmoji } from '@/lib/emojiUtils';
import { TwemojiSvg } from '@/components/chat/TwemojiSvg';
import { BubbleTail } from '@/components/chat/BubbleTail';
import { VoiceWaveform } from '@/components/chat/VoiceWaveform';
import { LinkPreviewCard } from '@/components/chat/LinkPreviewCard';
import { extractFirstUrl } from '@/lib/linkPreview';

// ── Props ────────────────────────────────────────────────────────

interface MessageBubbleProps {
  item: DmMessage;
  isOwn: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  onImagePress?: (url: string) => void;
  onVoicePress?: (url: string, messageId: string) => void;
  playingVoiceId?: string | null;
  reactions?: DmReactionGroup[];
  onReactionPress?: (messageId: string, emoji: string) => void;
  onLongPress?: (message: DmMessage) => void;
  replyTo?: DmMessage | null;
  onReplyQuotePress?: (replyToId: string) => void;
  onSwipeReply?: (message: DmMessage) => void;
  peerName?: string;
  currentUserId?: string;
  isPinned?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onForward?: () => void;
}

// ── Status Checkmarks (16px) ─────────────────────────────────────

function StatusIcon({ status }: { status?: DmMessageStatus }) {
  const size = chatStatus.iconSize;
  if (!status || status === 'sent') {
    return <Ionicons name="checkmark" size={size} color="#8696a0" />;
  }
  if (status === 'delivered') {
    return (
      <View style={{ flexDirection: 'row' }}>
        <Ionicons name="checkmark" size={size} color="#8696a0" />
        <Ionicons name="checkmark" size={size} color="#8696a0" style={{ marginLeft: -size * 0.45 }} />
      </View>
    );
  }
  // seen — blue
  return (
    <View style={{ flexDirection: 'row' }}>
      <Ionicons name="checkmark" size={size} color="#53bdeb" />
      <Ionicons name="checkmark" size={size} color="#53bdeb" style={{ marginLeft: -size * 0.45 }} />
    </View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function formatBytes(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getReplyPreview(msg: DmMessage): string {
  const type = msg.message_type ?? 'text';
  if (type === 'image') return 'Photo';
  if (type === 'voice') return 'Voice message';
  if (type === 'video') return 'Video';
  if (type === 'file') return 'File';
  return msg.body || '';
}

// ── Reply Quote ──────────────────────────────────────────────────

function ReplyQuoteBox({
  replyTo,
  senderName,
  onPress,
  accentColor,
  isOwn,
}: {
  replyTo: DmMessage;
  senderName: string;
  onPress?: () => void;
  accentColor: string;
  isOwn: boolean;
}) {
  const bgColor = isOwn ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)';
  const bodyColor = isOwn ? 'rgba(0,0,0,0.5)' : '#666';

  return (
    <Pressable
      onPress={onPress}
      style={[styles.replyQuoteBox, { borderLeftColor: accentColor, backgroundColor: bgColor }]}
    >
      <Text style={[styles.replyQuoteName, { color: accentColor }]} numberOfLines={1}>
        {senderName}
      </Text>
      <Text style={[styles.replyQuoteBody, { color: bodyColor }]} numberOfLines={2}>
        {getReplyPreview(replyTo)}
      </Text>
    </Pressable>
  );
}

// ── In-Bubble Meta (timestamp + edited + status) ─────────────────

const InBubbleMeta = React.memo(function InBubbleMeta({
  timeStr,
  isOwn,
  isEdited,
  isDeleted,
  status,
  overlay,
  unencrypted,
}: {
  timeStr: string;
  isOwn: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  status?: DmMessageStatus;
  overlay?: boolean;
  unencrypted?: boolean;
}) {
  const metaColor = overlay ? 'rgba(255,255,255,0.85)' : '#8696a0';

  return (
    <View style={[styles.inBubbleMeta, overlay && styles.inBubbleMetaOverlay]}>
      {unencrypted && (
        <Ionicons name="lock-open-outline" size={10} color="#e74c3c" style={{ marginRight: 2 }} />
      )}
      {isEdited && !isDeleted && (
        <Text style={[styles.editedLabel, { color: metaColor }]}>edited</Text>
      )}
      <Text style={[styles.inBubbleTime, { color: metaColor }]}>{timeStr}</Text>
      {isOwn && !isDeleted && <StatusIcon status={status} />}
    </View>
  );
});

// ── Reaction Pills ───────────────────────────────────────────────

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

function ReactionPillsRow({
  reactions,
  onReactionPress,
  isOwn,
  primaryColor,
  surfaceColor,
  borderColor,
  textColor,
}: {
  reactions: DmReactionGroup[];
  onReactionPress?: (emoji: string) => void;
  isOwn: boolean;
  primaryColor: string;
  surfaceColor: string;
  borderColor: string;
  textColor: string;
}) {
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

// ── Burst Overlay (Supernova effect) ─────────────────────────────

const BURST_INNER = 4;
const BURST_MID = 4;
const BURST_OUTER = 4;

interface ParticleConfig {
  angle: number;
  radius: number;
  duration: number;
  sizeMultiplier: number;
}

function generateParticles(): ParticleConfig[] {
  const particles: ParticleConfig[] = [];
  for (let i = 0; i < BURST_INNER; i++) {
    const angle = ((360 / BURST_INNER) * i + 15) * (Math.PI / 180);
    particles.push({ angle, radius: 80, duration: 450, sizeMultiplier: 0.7 });
  }
  for (let i = 0; i < BURST_MID; i++) {
    const angle = ((360 / BURST_MID) * i + 0) * (Math.PI / 180);
    particles.push({ angle, radius: 140, duration: 550, sizeMultiplier: 1.0 });
  }
  for (let i = 0; i < BURST_OUTER; i++) {
    const angle = ((360 / BURST_OUTER) * i + 30) * (Math.PI / 180);
    particles.push({ angle, radius: 200, duration: 650, sizeMultiplier: 0.6 });
  }
  return particles;
}

const PARTICLE_CONFIGS = generateParticles();

const SPARKLE_OFFSETS = [
  { x: -50, y: -40 }, { x: 45, y: -35 },
  { x: -35, y: 30 }, { x: 55, y: 25 },
  { x: -15, y: -55 }, { x: 20, y: 50 },
];

const BurstOverlay = React.memo(function BurstOverlay({
  visible,
  origin,
  emoji,
  onDone,
}: {
  visible: boolean;
  origin: { x: number; y: number };
  emoji: string;
  onDone: () => void;
}) {
  const mainScale = useSharedValue(1);
  const particleProgress = useMemo(() => PARTICLE_CONFIGS.map(() => makeMutable(0)), []);
  const sparkleScales = useMemo(() => SPARKLE_OFFSETS.map(() => makeMutable(0)), []);

  useEffect(() => {
    if (!visible) return;
    mainScale.value = 1;
    particleProgress.forEach((p) => { p.value = 0; });
    sparkleScales.forEach((s) => { s.value = 0; });

    mainScale.value = withSequence(
      withTiming(0.7, { duration: 80 }),
      withSpring(1.2, { damping: 4, stiffness: 300, mass: 0.6 }),
      withSpring(1.0, { damping: 10, stiffness: 120, mass: 1 }),
    );

    particleProgress.forEach((p, i) => {
      const config = PARTICLE_CONFIGS[i];
      p.value = withDelay(80 + i * 15, withTiming(1, { duration: config.duration, easing: Easing.out(Easing.cubic) }));
    });

    sparkleScales.forEach((s, i) => {
      s.value = withDelay(
        400 + i * 60,
        withSequence(
          withSpring(1, { damping: 6, stiffness: 200, mass: 0.4 }),
          withDelay(150, withTiming(0, { duration: 200 })),
        ),
      );
    });

    const timer = setTimeout(onDone, 950);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onDone}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDone}>
        <AnimatedBurstEmoji emoji={emoji} origin={origin} scaleValue={mainScale} size={72} />
        <ShockwaveRing origin={origin} />
        {PARTICLE_CONFIGS.map((config, i) => (
          <BurstParticle key={`p-${i}`} emoji={emoji} origin={origin} config={config} progress={particleProgress[i]} />
        ))}
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
        { translateX: tx }, { translateY: ty }, { scale: s }, { rotate: `${rotation}deg` },
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
    const rawOpacity = interpolate(progress.value, [0, 0.3, 1], [0.4, 0.2, 0]);
    const opacity = Math.round(rawOpacity * 1000) / 1000;
    return {
      position: 'absolute' as const,
      left: origin.x - size / 2, top: origin.y - size / 2,
      width: size, height: size, borderRadius: size / 2,
      borderWidth: 2, borderColor: `rgba(255,255,255,${opacity})`,
    };
  });
  return <Animated.View style={style} />;
}

function SparkleView({
  origin, offset, scale,
}: { origin: { x: number; y: number }; offset: { x: number; y: number }; scale: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const s = scale.value;
    return {
      position: 'absolute' as const,
      left: origin.x + offset.x - 6, top: origin.y + offset.y - 6,
      width: 12, height: 12, opacity: s,
      transform: [{ scale: s }, { rotate: `${s * 90}deg` }],
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

// ── Main MessageBubble ───────────────────────────────────────────

export const MessageBubble = React.memo(function MessageBubble({
  item,
  isOwn,
  isFirstInGroup = true,
  isLastInGroup = true,
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
  const isUnencrypted = item._unencrypted === true;
  const timeStr = new Date(item.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // ── WhatsApp-style bubble colors ──
  const ownBubbleBg = `${colors.primary}22`;
  const peerBubbleBg = colors.surface;
  const bubbleBg = isDeleted
    ? `${colors.textTertiary}10`
    : isOwn
      ? ownBubbleBg
      : peerBubbleBg;

  // ── Dynamic border radius (tail side is smaller on last-in-group) ──
  const bubbleRadiusStyle = {
    borderTopLeftRadius: chatBubble.radius,
    borderTopRightRadius: chatBubble.radius,
    borderBottomLeftRadius: isOwn
      ? chatBubble.radius
      : isLastInGroup
        ? chatBubble.tailRadius
        : chatBubble.radius,
    borderBottomRightRadius: isOwn
      ? isLastInGroup
        ? chatBubble.tailRadius
        : chatBubble.radius
      : chatBubble.radius,
  };

  const rowMarginTop = isFirstInGroup
    ? chatBubble.defaultMargin
    : chatBubble.groupedMargin;

  const textColor = colors.text;

  // ── Swipe-to-reply gesture ──
  const swipeX = useSharedValue(0);

  const fireSwipeReply = useCallback(() => {
    onSwipeReply?.(item);
  }, [onSwipeReply, item]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(item);
  }, [onLongPress, item]);

  const handleReplyQuotePress = useCallback(() => {
    if (item.reply_to_id) onReplyQuotePress?.(item.reply_to_id);
  }, [onReplyQuotePress, item.reply_to_id]);

  const handleReactionPress = useCallback((emoji: string) => {
    onReactionPress?.(item.id, emoji);
  }, [onReactionPress, item.id]);

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

  // ── Big emoji detection ──
  const replyQuoteSenderName = replyTo
    ? replyTo.sender_id === currentUserId
      ? 'You'
      : peerName ?? 'Peer'
    : '';

  const isBigEmoji =
    msgType === 'text' && !isDeleted && !replyTo && isSingleEmoji(item.body ?? '');

  // ── Big emoji idle animation ──
  const floatY = useSharedValue(0);
  const wiggleRot = useSharedValue(0);
  const breatheScale = useSharedValue(1);

  useEffect(() => {
    if (!isBigEmoji) return;
    floatY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    wiggleRot.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(2, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
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

  // ── Burst state ──
  const emojiRef = useRef<View>(null);
  const [burstVisible, setBurstVisible] = useState(false);
  const [burstOrigin, setBurstOrigin] = useState({ x: 0, y: 0 });

  const handleBigEmojiPress = () => {
    emojiRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
      setBurstOrigin({ x: pageX + w / 2, y: pageY + h / 2 });
      setBurstVisible(true);
    });
  };

  // ── Big emoji entrance ──
  const entranceScale = useSharedValue(isBigEmoji ? 0 : 1);
  const entranceY = useSharedValue(isBigEmoji ? 30 : 0);

  useEffect(() => {
    if (!isBigEmoji) return;
    entranceScale.value = withSpring(1, { damping: 6, stiffness: 150, mass: 0.8 });
    entranceY.value = withSpring(0, { damping: 8, stiffness: 120, mass: 0.8 });
  }, [isBigEmoji]);

  const entranceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: entranceScale.value }, { translateY: entranceY.value }],
  }));

  // ── Content renderer ──
  const renderContent = () => {
    if (isDeleted) {
      return (
        <View>
          <View style={styles.deletedRow}>
            <Ionicons name="ban-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.deletedText, { color: colors.textSecondary }]}>
              This message was deleted
            </Text>
          </View>
          <InBubbleMeta
            timeStr={timeStr}
            isOwn={isOwn}
            isEdited={false}
            isDeleted
            status={item.status}
            unencrypted={isUnencrypted}
          />
        </View>
      );
    }

    if (msgType === 'poll') {
      let pollId: string | null = null;
      try {
        pollId = JSON.parse(item.body)?.poll_id ?? null;
      } catch {
        /* ignore */
      }
      if (pollId) {
        return (
          <View>
            <PollBubble pollId={pollId} currentUserId={currentUserId ?? null} />
            <InBubbleMeta
              timeStr={timeStr}
              isOwn={isOwn}
              isEdited={isEdited}
              isDeleted={false}
              status={item.status}
              unencrypted={isUnencrypted}
            />
          </View>
        );
      }
      return (
        <Text style={[styles.msgBody, { color: colors.textSecondary, fontStyle: 'italic' }]}>
          Poll unavailable
        </Text>
      );
    }

    if (msgType === 'image' && item.attachment_url) {
      return (
        <View>
          <Pressable onPress={() => onImagePress?.(item.attachment_url!)}>
            <View style={styles.imageWrap}>
              <Image
                source={{ uri: item.attachment_url }}
                style={styles.imageThumbnail}
                resizeMode="cover"
              />
              {!item.body && (
                <InBubbleMeta
                  timeStr={timeStr}
                  isOwn={isOwn}
                  isEdited={isEdited}
                  isDeleted={false}
                  status={item.status}
                  overlay
                  unencrypted={isUnencrypted}
                />
              )}
            </View>
          </Pressable>
          {item.body ? (
            <View style={styles.imageCaptionWrap}>
              <Text style={[styles.msgBody, { color: textColor }]}>{item.body}</Text>
              <InBubbleMeta
                timeStr={timeStr}
                isOwn={isOwn}
                isEdited={isEdited}
                isDeleted={false}
                status={item.status}
                unencrypted={isUnencrypted}
              />
            </View>
          ) : null}
        </View>
      );
    }

    if (msgType === 'voice' && item.attachment_url) {
      return (
        <View>
          <VoiceWaveform
            duration={item.attachment_duration || 0}
            isPlaying={playingVoiceId === item.id}
            isOwn={isOwn}
            onPlayPause={() => onVoicePress?.(item.attachment_url!, item.id)}
          />
          <InBubbleMeta
            timeStr={timeStr}
            isOwn={isOwn}
            isEdited={isEdited}
            isDeleted={false}
            status={item.status}
            unencrypted={isUnencrypted}
          />
        </View>
      );
    }

    if (msgType === 'video' && item.attachment_url) {
      return (
        <View>
          <Pressable
            style={styles.videoThumb}
            onPress={() => onImagePress?.(item.attachment_url!)}
          >
            <View style={styles.videoOverlay}>
              <Ionicons name="play-circle" size={36} color="#fff" />
            </View>
            <InBubbleMeta
              timeStr={timeStr}
              isOwn={isOwn}
              isEdited={isEdited}
              isDeleted={false}
              status={item.status}
              overlay
              unencrypted={isUnencrypted}
            />
          </Pressable>
          {item.body ? (
            <View style={styles.imageCaptionWrap}>
              <Text style={[styles.msgBody, { color: textColor }]}>{item.body}</Text>
            </View>
          ) : null}
        </View>
      );
    }

    if (msgType === 'file' && item.attachment_url) {
      const filename = item.body || 'File';
      return (
        <View>
          <Pressable
            style={styles.fileRow}
            onPress={() => Linking.openURL(item.attachment_url!).catch(() => null)}
          >
            <View style={[styles.fileIcon, { backgroundColor: `${colors.secondary}20` }]}>
              <Ionicons name="document-outline" size={20} color={colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fileName, { color: textColor }]} numberOfLines={2}>
                {filename}
              </Text>
              {item.attachment_size ? (
                <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
                  {formatBytes(item.attachment_size)}
                </Text>
              ) : null}
            </View>
            <Ionicons name="download-outline" size={16} color={colors.textSecondary} />
          </Pressable>
          <InBubbleMeta
            timeStr={timeStr}
            isOwn={isOwn}
            isEdited={isEdited}
            isDeleted={false}
            status={item.status}
            unencrypted={isUnencrypted}
          />
        </View>
      );
    }

    // ── Big emoji ──
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
          <InBubbleMeta
            timeStr={timeStr}
            isOwn={isOwn}
            isEdited={isEdited}
            isDeleted={false}
            status={item.status}
            unencrypted={isUnencrypted}
          />
        </Animated.View>
      );
    }

    // ── Default: text ──
    const hasLink = item.body ? extractFirstUrl(item.body) : null;
    return (
      <View>
        <Text style={[styles.msgBody, { color: textColor }]}>{item.body}</Text>
        {hasLink && <LinkPreviewCard text={item.body!} isOwn={isOwn} />}
        <InBubbleMeta
          timeStr={timeStr}
          isOwn={isOwn}
          isEdited={isEdited}
          isDeleted={false}
          status={item.status}
          unencrypted={isUnencrypted}
        />
      </View>
    );
  };

  const hasReactions = !isDeleted && reactions && reactions.length > 0;

  return (
    <View style={{ position: 'relative', marginTop: rowMarginTop }}>
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
          style={[
            styles.msgRow,
            { alignItems: isOwn ? 'flex-end' : 'flex-start' },
            swipeStyle,
          ]}
        >
          <Pressable onLongPress={!isDeleted ? handleLongPress : undefined} delayLongPress={350}>
            <View
              style={[
                styles.bubble,
                isBigEmoji
                  ? styles.bigEmojiBubble
                  : {
                      backgroundColor: bubbleBg,
                      ...bubbleRadiusStyle,
                      borderWidth: isDeleted ? 1 : 0,
                      borderColor: isDeleted ? colors.border : 'transparent',
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
                  onPress={handleReplyQuotePress}
                  accentColor={colors.primary}
                  isOwn={isOwn}
                />
              )}
              {renderContent()}
              {/* WhatsApp-style bubble tail on last message in group */}
              {isLastInGroup && !isBigEmoji && !isDeleted && (
                <BubbleTail
                  direction={isOwn ? 'right' : 'left'}
                  color={isOwn ? ownBubbleBg : peerBubbleBg}
                />
              )}
            </View>
          </Pressable>

          {hasReactions && (
            <ReactionPillsRow
              reactions={reactions!}
              onReactionPress={handleReactionPress}
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
}, (prev, next) => {
  if (
    prev.item.id !== next.item.id ||
    prev.item.body !== next.item.body ||
    prev.item.status !== next.item.status ||
    prev.item.edited_at !== next.item.edited_at ||
    prev.item.is_deleted !== next.item.is_deleted ||
    prev.isOwn !== next.isOwn ||
    prev.isFirstInGroup !== next.isFirstInGroup ||
    prev.isLastInGroup !== next.isLastInGroup ||
    prev.playingVoiceId !== next.playingVoiceId ||
    prev.isPinned !== next.isPinned ||
    prev.replyTo !== next.replyTo
  ) return false;

  // Deep compare reactions (arrays from Map.get() are always new references)
  const prevR = prev.reactions;
  const nextR = next.reactions;
  if (prevR === nextR) return true;
  if (!prevR || !nextR || prevR.length !== nextR.length) return false;
  for (let i = 0; i < prevR.length; i++) {
    if (prevR[i].emoji !== nextR[i].emoji ||
        prevR[i].count !== nextR[i].count ||
        prevR[i].reactedByMe !== nextR[i].reactedByMe) return false;
  }
  return true;
});

// ── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  msgRow: { gap: 2 },
  bubble: {
    maxWidth: chatBubble.maxWidth,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    overflow: 'hidden',
  },
  msgBody: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  // Image
  imageWrap: {
    position: 'relative',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  imageThumbnail: {
    width: chatMedia.imageMaxWidth,
    height: chatMedia.imageMaxWidth * 0.75,
    borderRadius: borderRadius.md,
    minWidth: chatMedia.imageMinWidth,
  },
  imageCaptionWrap: {
    paddingTop: spacing.xs,
  },
  // Voice — now uses VoiceWaveform component
  // Video
  videoThumb: {
    width: chatMedia.imageMaxWidth,
    height: chatMedia.imageMaxWidth * 0.75,
    borderRadius: borderRadius.md,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: borderRadius.md,
  },
  // File
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  fileSize: { fontSize: fontSize.xs, marginTop: 2 },
  // Deleted
  deletedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deletedText: { fontSize: fontSize.sm, fontStyle: 'italic' },
  // In-bubble meta
  inBubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  inBubbleMetaOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  inBubbleTime: { fontSize: 11 },
  editedLabel: { fontSize: 10, fontStyle: 'italic' },
  // Pin badge
  pinBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 1,
  },
  // Reply quote
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
    maxWidth: chatBubble.maxWidth,
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
  bigEmojiBubble: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  bigEmojiWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
});
