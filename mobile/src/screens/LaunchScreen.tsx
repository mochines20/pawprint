import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { AppText } from '@/components';
import { useTheme } from '@/theme';
import logo from '../../assets/logo.png';

/** Launch screen: logo drops like a map pin, wordmark and tagline fade in, then it fades out. */
export function LaunchScreen({ onDone, minMs = 2400 }: { onDone: () => void; minMs?: number }) {
  const t = useTheme();
  const drop = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  const nativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    Animated.sequence([
      Animated.spring(drop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: nativeDriver }),
      Animated.timing(word, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
      Animated.delay(Math.max(0, minMs - 1300)),
      Animated.timing(out, { toValue: 0, duration: 400, useNativeDriver: nativeDriver }),
    ]).start(({ finished }) => finished && onDone());
  }, [drop, word, out, minMs, onDone]);

  return (
    <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, { backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', opacity: out }]}>
      <Animated.View style={{ opacity: drop, transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] }) }, { scaleY: drop.interpolate({ inputRange: [0, 1], outputRange: [1.15, 1] }) }] }}>
        <Image source={logo} style={{ width: 150, height: 162, tintColor: t.ink }} resizeMode="contain" accessibilityLabel="Pawprint logo" />
      </Animated.View>
      <Animated.View style={{ alignItems: 'center', opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
        <View style={{ marginTop: 10 }}><AppText size={44} weight="bold">Pawprint</AppText></View>
        <AppText size={17} muted style={{ marginTop: 6 }}>Gotta spot ’em all.</AppText>
      </Animated.View>
    </Animated.View>
  );
}
