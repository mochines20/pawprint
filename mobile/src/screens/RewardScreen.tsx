import { useEffect, useRef } from 'react';
import { Animated, Image, Platform, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, Card, CatAvatar, Chip, HardShadow, Icon, ProgressBar, RarityTag } from '@/components';
import { fetchProgress } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { COATS } from '@/lib/types';
import type { RootStackParamList } from '@/navigation/types';
import { border, space, useTheme } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Reward'>;

function Rise({ delay, children }: { delay: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 450, delay, useNativeDriver: Platform.OS !== 'web' }).start(); }, [v, delay]);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>{children}</Animated.View>;
}

export function RewardScreen({ navigation, route }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { variant, xp, isNewCoat, photoUri } = route.params;
  const coat = COATS[variant];
  const { data: progress } = useAsync(fetchProgress, null);
  const total = progress?.xp ?? xp;
  const nextMedal = progress?.medals.find((medal) => !medal.earned);
  const nextTarget = nextMedal?.xpRequired ?? Math.max(500, total);
  const streak = progress?.streak.current ?? 0;
  const coats = progress?.journal.unique ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 24, paddingHorizontal: space.lg }}>
      <Rise delay={0}>
        <View style={{ alignItems: 'center' }}><Chip tone="amber" label={isNewCoat ? 'New coat discovered' : 'Seen again'} /></View>
      </Rise>
      <Rise delay={80}>
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <HardShadow offset={6} radius={44} color={t.shadow}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={{ width: 180, height: 180, borderRadius: 44, borderWidth: border, borderColor: t.edge }} />
            ) : (
              <CatAvatar variant={variant} size={180} radius={44} />
            )}
          </HardShadow>
        </View>
      </Rise>
      <Rise delay={160}>
        <View style={{ alignItems: 'center', marginTop: 18 }}>
          <AppText size={30} weight="bold">{coat.name} spotted!</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <RarityTag rarity={coat.rarity} />
            <AppText size={12} muted>Today · Alabang area</AppText>
          </View>
        </View>
      </Rise>
      <Rise delay={240}>
        <Card style={{ marginTop: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText size={15} weight="bold">+{xp} XP</AppText>
            <AppText size={12} muted>{nextMedal ? `Next: ${nextMedal.title}` : 'Pawprint progress'}</AppText>
          </View>
          <View style={{ marginTop: 8 }}><ProgressBar value={nextTarget ? (total / nextTarget) * 100 : 100} /></View>
          <AppText size={12} muted style={{ marginTop: 6 }}>{Math.max(0, nextTarget - total)} XP to the next medal</AppText>
        </Card>
      </Rise>
      <Rise delay={320}>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Card dark style={{ flex: 1 }} innerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <CatAvatar variant="orange" size={46} radius={14} />
            <View>
              <AppText size={10.5} color="#BDBAB2">Streak</AppText>
              <AppText size={20} weight="bold" color={t.amber}>{streak}</AppText>
            </View>
          </Card>
          <Card style={{ flex: 1 }} innerStyle={{ justifyContent: 'center' }}>
            <AppText size={12} muted>Coat collection</AppText>
            <AppText size={20} weight="bold">{coats} / 3</AppText>
          </Card>
        </View>
      </Rise>

      <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: insets.bottom + 18 }}>
        <Button label="Add to my Cat Journal" onPress={() => navigation.popToTop()} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 12 }}>
          <Icon name="lock" size={13} color={t.stone} />
          <AppText size={12} muted>Shown as an approximate pin for 24 hours</AppText>
        </View>
      </View>
    </View>
  );
}
