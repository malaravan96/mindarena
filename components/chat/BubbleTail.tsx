import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

interface BubbleTailProps {
  direction: 'left' | 'right';
  color: string;
}

export const BubbleTail = React.memo(function BubbleTail({ direction, color }: BubbleTailProps) {
  const isRight = direction === 'right';

  return (
    <View
      style={[
        styles.container,
        isRight ? styles.right : styles.left,
      ]}
    >
      <Svg width={12} height={16} viewBox="0 0 12 16">
        {isRight ? (
          <Path d="M0 0 C0 0 0 16 12 16 C4 12 2 4 0 0 Z" fill={color} />
        ) : (
          <Path d="M12 0 C12 0 12 16 0 16 C8 12 10 4 12 0 Z" fill={color} />
        )}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
  },
  left: {
    left: -8,
  },
  right: {
    right: -8,
  },
});
