import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';

type Props = {
  visible: boolean;
  level: number;
  title: string;
  onClose: () => void;
};

export function LevelUpModal({ visible, level, title, onClose }: Props) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.5);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <Animated.View style={[styles.card, { backgroundColor: colors.surface, transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="arrow-up-circle" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.primary }]}>Level Up!</Text>
          <Text style={[styles.level, { color: colors.text }]}>Level {level}</Text>
          <Text style={[styles.titleText, { color: colors.textSecondary }]}>{title}</Text>
          <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={onClose}>
            <Text style={styles.btnText}>Continue</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.black,
    marginBottom: spacing.xs,
  },
  level: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.black,
    marginBottom: spacing.xs,
  },
  titleText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.lg,
  },
  btn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  btnText: {
    color: '#fff',
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
});
