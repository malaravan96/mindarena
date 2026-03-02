import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, fontSize, fontWeight, chatMedia } from '@/constants/theme';

interface VoiceWaveformProps {
  duration: number; // seconds
  isPlaying: boolean;
  isOwn: boolean;
  onPlayPause: () => void;
}

// Generate deterministic bar heights from a seed (message duration)
function generateBars(count: number, seed: number): number[] {
  const bars: number[] = [];
  let x = seed * 1337;
  for (let i = 0; i < count; i++) {
    x = ((x * 9301 + 49297) % 233280);
    const ratio = x / 233280;
    bars.push(
      chatMedia.voiceBarMinHeight +
        ratio * (chatMedia.voiceBarMaxHeight - chatMedia.voiceBarMinHeight),
    );
  }
  return bars;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const VoiceWaveform = React.memo(function VoiceWaveform({
  duration,
  isPlaying,
  isOwn,
  onPlayPause,
}: VoiceWaveformProps) {
  const { colors } = useTheme();
  const bars = useRef(generateBars(chatMedia.voiceWaveformBars, duration)).current;
  const [progress, setProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isPlaying) {
      setProgress(0);
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: duration * 1000,
        useNativeDriver: false,
      }).start();

      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= duration) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return duration;
          }
          return p + 1;
        });
      }, 1000);
    } else {
      progressAnim.stopAnimation();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setProgress(0);
      progressAnim.setValue(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, duration, progressAnim]);

  const barColor = isOwn ? 'rgba(255,255,255,0.7)' : colors.primary;
  const barActiveColor = isOwn ? '#fff' : colors.primaryDark;
  const textColor = isOwn ? 'rgba(255,255,255,0.8)' : colors.textSecondary;

  const activeBarCount = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, chatMedia.voiceWaveformBars],
  });

  return (
    <View style={styles.container}>
      <Pressable onPress={onPlayPause} style={styles.playBtn} hitSlop={8}>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={20}
          color={isOwn ? '#fff' : colors.primary}
        />
      </Pressable>

      <View style={styles.barsContainer}>
        {bars.map((height, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                height,
                backgroundColor: activeBarCount.interpolate({
                  inputRange: [i, i + 0.01],
                  outputRange: [barColor, barActiveColor],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.duration, { color: textColor }]}>
        {isPlaying ? formatDuration(progress) : formatDuration(duration)}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 160,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: chatMedia.voiceBarMaxHeight,
  },
  bar: {
    flex: 1,
    borderRadius: 1.5,
    minWidth: 2,
  },
  duration: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    minWidth: 30,
    textAlign: 'right',
  },
});
