import React from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  streamURL: string | null;
  style?: StyleProp<ViewStyle>;
  mirror?: boolean;
  emptyLabel?: string;
};

let NativeRTCView: any = null;
if (Platform.OS !== 'web') {
  try {
    const mod = require('react-native-webrtc');
    NativeRTCView = mod.RTCView;
  } catch {
    NativeRTCView = null;
  }
}

export function RtcVideoView({ streamURL, style, mirror = false, emptyLabel = 'Waiting for video...' }: Props) {
  if (!streamURL || !NativeRTCView) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.placeholderText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <NativeRTCView
      streamURL={streamURL}
      style={[styles.video, style]}
      objectFit="cover"
      mirror={mirror}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  placeholderText: {
    color: '#c4c4c4',
    fontSize: 12,
    fontWeight: '600',
  },
});
