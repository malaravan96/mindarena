import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { colorThemeList, borderRadius, spacing, fontSize, fontWeight } from '@/constants/theme';

interface ThemePickerProps {
  compact?: boolean;
}

export function ThemePicker({ compact }: ThemePickerProps) {
  const { colorTheme, setColorTheme, colorScheme, colors } = useTheme();

  const swatchSize = compact ? 36 : 48;

  return (
    <View style={styles.grid}>
      {colorThemeList.map((t) => {
        const isActive = t.id === colorTheme;
        const swatchColor = t[colorScheme].primary;

        return (
          <Pressable
            key={t.id}
            style={[
              styles.swatch,
              {
                width: swatchSize,
                height: swatchSize,
                borderRadius: swatchSize / 2,
                backgroundColor: swatchColor,
                borderColor: isActive ? colors.text : 'transparent',
                borderWidth: isActive ? 3 : 0,
              },
            ]}
            onPress={() => setColorTheme(t.id)}
          >
            {isActive && <Ionicons name="checkmark" size={18} color="#ffffff" />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  swatch: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  check: {
    color: '#ffffff',
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
});
