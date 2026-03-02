import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Linking } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, fontSize, fontWeight, borderRadius } from '@/constants/theme';
import { fetchLinkPreview, extractFirstUrl } from '@/lib/linkPreview';
import type { LinkPreview } from '@/lib/types';

interface LinkPreviewCardProps {
  text: string;
  isOwn: boolean;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export const LinkPreviewCard = React.memo(function LinkPreviewCard({
  text,
  isOwn,
}: LinkPreviewCardProps) {
  const { colors } = useTheme();
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const url = extractFirstUrl(text);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetchLinkPreview(url).then((p) => {
      if (!cancelled) setPreview(p);
    });
    return () => { cancelled = true; };
  }, [url]);

  if (!preview || !url) return null;

  const cardBg = isOwn ? 'rgba(0,0,0,0.08)' : `${colors.textTertiary}12`;
  const titleColor = isOwn ? '#fff' : colors.text;
  const descColor = isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  const domainColor = isOwn ? 'rgba(255,255,255,0.5)' : colors.textTertiary;

  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={[styles.card, { backgroundColor: cardBg }]}
    >
      {preview.image ? (
        <Image
          source={{ uri: preview.image }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.content}>
        {preview.title ? (
          <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
            {preview.title}
          </Text>
        ) : null}
        {preview.description ? (
          <Text style={[styles.description, { color: descColor }]} numberOfLines={2}>
            {preview.description}
          </Text>
        ) : null}
        <Text style={[styles.domain, { color: domainColor }]} numberOfLines={1}>
          {getDomain(url)}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  image: {
    width: '100%',
    height: 120,
  },
  content: {
    padding: spacing.sm,
    gap: 2,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  description: {
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  domain: {
    fontSize: 10,
    marginTop: 2,
  },
});
