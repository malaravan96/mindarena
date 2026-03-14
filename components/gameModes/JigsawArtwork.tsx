import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { JigsawArtwork } from '@/lib/gameModes/jigsaw';

type Props = {
  size: number;
  artwork?: JigsawArtwork | null;
  source?: ImageSourcePropType | null;
};

export function JigsawArtwork({ size, artwork, source }: Props) {
  if (source) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size }}
        resizeMode="cover"
      />
    );
  }

  if (!artwork) {
    return <View style={{ width: size, height: size, backgroundColor: '#d1d5db' }} />;
  }

  return (
    <LinearGradient
      colors={artwork.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size }}
    >
      <View style={styles.layer}>
        <View
          style={[
            styles.accentBand,
            {
              top: size * 0.08,
              left: size * 0.1,
              width: size * 0.76,
              backgroundColor: `${artwork.highlight}66`,
            },
          ]}
        />
        <View
          style={[
            styles.accentBand,
            {
              top: size * 0.58,
              left: size * 0.16,
              width: size * 0.66,
              transform: [{ rotate: '-8deg' }],
              backgroundColor: `${artwork.accent}40`,
            },
          ]}
        />
        {artwork.shapes.map((shape, index) => (
          <View
            key={`${shape.x}-${shape.y}-${index}`}
            style={[
              styles.dot,
              {
                width: size * shape.size,
                height: size * shape.size,
                borderRadius: (size * shape.size) / 2,
                top: size * shape.y,
                left: size * shape.x,
                backgroundColor: shape.color,
                opacity: shape.opacity ?? 0.75,
              },
            ]}
          />
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
  },
  accentBand: {
    position: 'absolute',
    height: 22,
    borderRadius: 999,
    transform: [{ rotate: '10deg' }],
  },
  dot: {
    position: 'absolute',
  },
});
