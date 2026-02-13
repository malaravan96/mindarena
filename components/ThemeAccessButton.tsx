import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemePicker } from '@/components/ThemePicker';
import { borderRadius, fontSize, fontWeight, spacing, shadows } from '@/constants/theme';

export function ThemeAccessButton() {
  const { colors, theme, setTheme } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={[
          styles.fab,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          shadows.md,
        ]}
        hitSlop={8}
      >
        <Text style={[styles.fabIcon, { color: colors.primary }]}>{'\u{1F3A8}'}</Text>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={() => setVisible(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose Theme</Text>

            {/* Color theme grid */}
            <ThemePicker />

            {/* Mode toggle */}
            <Text style={[styles.modeLabel, { color: colors.textSecondary }]}>Mode</Text>
            <View style={styles.modeRow}>
              {([
                { key: 'light' as const, label: 'Light' },
                { key: 'dark' as const, label: 'Dark' },
                { key: 'auto' as const, label: 'Auto' },
              ]).map((m) => (
                <Pressable
                  key={m.key}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: theme === m.key ? colors.primary : colors.surfaceVariant,
                      borderRadius: borderRadius.sm,
                    },
                  ]}
                  onPress={() => setTheme(m.key)}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      { color: theme === m.key ? '#ffffff' : colors.text },
                    ]}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setVisible(false)}
              style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  fabIcon: {
    fontSize: 20,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  sheetTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modeLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  modeBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  doneBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
});
