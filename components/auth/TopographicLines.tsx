import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const LINE_COLOR = 'rgba(255,255,255,0.12)';

export function TopographicLines() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 375 280" preserveAspectRatio="xMidYMid slice">
        <Path
          d="M-20 40 C 40 20, 100 70, 160 45 C 220 20, 280 65, 340 40 C 380 25, 420 50, 460 35"
          stroke={LINE_COLOR}
          strokeWidth="1.5"
          fill="none"
        />
        <Path
          d="M-30 80 C 30 55, 90 105, 155 80 C 215 55, 275 100, 340 72 C 380 55, 420 85, 460 65"
          stroke={LINE_COLOR}
          strokeWidth="1.5"
          fill="none"
        />
        <Path
          d="M-10 120 C 50 95, 115 145, 175 118 C 235 92, 295 140, 360 115 C 400 98, 440 130, 480 112"
          stroke={LINE_COLOR}
          strokeWidth="1.5"
          fill="none"
        />
        <Path
          d="M-40 160 C 20 135, 85 185, 148 158 C 208 132, 270 178, 335 152 C 375 135, 415 165, 455 148"
          stroke={LINE_COLOR}
          strokeWidth="1.5"
          fill="none"
        />
        <Path
          d="M10 200 C 70 174, 132 222, 195 196 C 255 170, 315 218, 380 193 C 420 176, 460 208, 500 190"
          stroke={LINE_COLOR}
          strokeWidth="1.5"
          fill="none"
        />
        <Path
          d="M-20 240 C 45 215, 110 260, 172 234 C 235 208, 298 254, 360 228 C 400 212, 440 244, 480 228"
          stroke={LINE_COLOR}
          strokeWidth="1.5"
          fill="none"
        />
        <Path
          d="M30 20 C 30 60, 20 100, 35 140 C 48 180, 25 220, 40 260"
          stroke={LINE_COLOR}
          strokeWidth="1.5"
          fill="none"
        />
        <Path
          d="M320 10 C 315 50, 330 90, 318 130 C 305 170, 325 210, 312 250"
          stroke={LINE_COLOR}
          strokeWidth="1.5"
          fill="none"
        />
      </Svg>
    </View>
  );
}
