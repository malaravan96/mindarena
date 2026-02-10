import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { layout } from '@/constants/theme';

interface ContainerProps {
  children: ReactNode;
  style?: ViewStyle;
  scrollable?: boolean;
  centered?: boolean;
}

export function Container({ children, style, scrollable = false, centered = false }: ContainerProps) {
  const { colors } = useTheme();

  const content = (
    <View
      style={[
        styles.container,
        {
          maxWidth: layout.maxWidth,
          paddingHorizontal: layout.contentPadding,
          backgroundColor: colors.background,
          flex: centered ? 1 : undefined,
          justifyContent: centered ? 'center' : undefined,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
  },
});
