import React, { ReactNode, useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { AUTH_CORAL, AUTH_WHITE } from '@/constants/authColors';
import { TopographicLines } from './TopographicLines';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CORAL_HEIGHT = Math.round(SCREEN_HEIGHT * 0.42);
const WAVE_HEIGHT = 80;

interface AuthWaveLayoutProps {
  heroTitle: string;
  heroSubtitle?: string;
  onBack?: () => void;
  scrollable?: boolean;
  children: ReactNode;
}

export function AuthWaveLayout({
  heroTitle,
  heroSubtitle,
  onBack,
  scrollable = false,
  children,
}: AuthWaveLayoutProps) {
  const insets = useSafeAreaInsets();

  // Panel entrance: slides up from 60px below
  const panelSlideY = useRef(new Animated.Value(60)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;

  // Content entrance: slightly delayed fade + rise after panel arrives
  const contentSlideY = useRef(new Animated.Value(28)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      // Panel sweeps in
      Animated.timing(panelSlideY, {
        toValue: 0,
        duration: 480,
        delay: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(panelOpacity, {
        toValue: 1,
        duration: 360,
        delay: 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // Content rises slightly after panel starts moving
      Animated.timing(contentSlideY, {
        toValue: 0,
        duration: 420,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 380,
        delay: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const panelContent = (
    <Animated.View
      style={[
        styles.panelInner,
        {
          paddingBottom: insets.bottom + 24,
          transform: [{ translateY: contentSlideY }],
          opacity: contentOpacity,
        },
      ]}
    >
      {children}
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      {/* Coral zone */}
      <View
        style={[
          styles.coralZone,
          { height: CORAL_HEIGHT, paddingTop: insets.top + 16 },
        ]}
      >
        <TopographicLines />

        {onBack && (
          <Pressable
            onPress={onBack}
            style={[styles.backBtn, { top: insets.top + 16 }]}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={20} color={AUTH_WHITE} />
          </Pressable>
        )}

        <View style={styles.heroTextWrap}>
          <Text style={styles.heroTitle}>{heroTitle}</Text>
          {heroSubtitle ? (
            <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
          ) : null}
        </View>
      </View>

      {/* Wave separator — absolutely straddles the coral/white boundary */}
      <View
        style={[styles.waveOverlay, { top: CORAL_HEIGHT - WAVE_HEIGHT + 8 }]}
        pointerEvents="none"
      >
        <Svg
          width="100%"
          height={WAVE_HEIGHT}
          viewBox="0 0 375 80"
          preserveAspectRatio="none"
        >
          <Path
            d="M0 40 C 60 10, 120 65, 187.5 38 C 255 10, 310 60, 375 35 L375 80 L0 80 Z"
            fill={AUTH_WHITE}
          />
        </Svg>
      </View>

      {/* White panel */}
      <Animated.View
        style={[
          styles.whitePanel,
          {
            transform: [{ translateY: panelSlideY }],
            opacity: panelOpacity,
          },
        ]}
      >
        {/*
          iOS: `padding` behavior adds paddingBottom = keyboardHeight.
          `keyboardVerticalOffset` tells KAV how far below the screen top it sits
          (= the coral zone height) so it calculates the correct padding.

          Android: system already handles resize via softwareKeyboardLayoutMode="resize",
          so we pass `undefined` to avoid double-adjusting.
        */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? CORAL_HEIGHT : 0}
          style={styles.kavFlex}
        >
          {scrollable ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {panelContent}
            </ScrollView>
          ) : (
            panelContent
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AUTH_CORAL,
  },
  coralZone: {
    width: '100%',
    backgroundColor: AUTH_CORAL,
    overflow: 'hidden',
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  heroTextWrap: {
    position: 'absolute',
    bottom: WAVE_HEIGHT - 16,
    left: 24,
    right: 24,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: AUTH_WHITE,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
    lineHeight: 22,
  },
  waveOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    height: WAVE_HEIGHT,
  },
  whitePanel: {
    flex: 1,
    backgroundColor: AUTH_WHITE,
    zIndex: 5,
  },
  kavFlex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  panelInner: {
    paddingTop: 44,
    paddingHorizontal: 24,
  },
});
