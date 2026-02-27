import React from 'react';
import { Text } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { emojiSvgMap } from '@/assets/twemoji/emojiMap';
import { emojiToCodepoint } from '@/lib/emojiUtils';

interface TwemojiProps {
  emoji: string;
  size: number;
}

export const TwemojiSvg = React.memo(function TwemojiSvg({ emoji, size }: TwemojiProps) {
  const codepoint = emojiToCodepoint(emoji);
  const svgData = emojiSvgMap[codepoint];

  if (!svgData) {
    return <Text style={{ fontSize: size, lineHeight: size * 1.15 }}>{emoji}</Text>;
  }

  return <SvgXml xml={svgData} width={size} height={size} />;
});
