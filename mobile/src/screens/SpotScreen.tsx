import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AppText, Button, Chip, Icon, IconButton } from '@/components';
import { submitSighting } from '@/lib/api';
import type { CatVariant } from '@/lib/types';
import { COATS } from '@/lib/types';
import { border, useTheme } from '@/theme';

const CORNER = 38;

export function SpotScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const cam = useRef<CameraView>(null);
  const [perm, requestPerm] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [tip, setTip] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detected, setDetected] = useState<{ variant: CatVariant; pct: number } | null>(null);

  const finish = async (uri: string) => {
    setBusy(true);
    try {
      const location = await Location.requestForegroundPermissionsAsync();
      if (location.status !== 'granted') throw new Error('LOCATION_PERMISSION_REQUIRED');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const res = await submitSighting({
        photoUri: uri,
        showPin: true,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        description: 'Street cat spotted near my current location.',
        capturedAt: new Date().toISOString(),
      });
      const variant: CatVariant = res.variant;
      setDetected({ variant, pct: res.pct });
      if (res.status !== 'accepted') {
        Alert.alert('Pawprint needs a review', res.reason || 'The photo was saved for review.');
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => nav.navigate('Reward', { variant, xp: res.xp, isNewCoat: res.isNewCoat, photoUri: uri }), 700);
    } catch (error) {
      Alert.alert('Could not save pawprint', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const shoot = async () => {
    if (busy || !cam.current) return;
    // exif: false keeps GPS out of the file. The server strips metadata again.
    const pic = await cam.current.takePictureAsync({ quality: 0.7, exif: false });
    if (pic?.uri) await finish(pic.uri);
  };

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, exif: false });
    if (!r.canceled && r.assets[0]) await finish(r.assets[0].uri);
  };

  if (!perm) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  if (!perm.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
        <Icon name="cam" size={44} color={t.ink} />
        <AppText size={22} weight="bold" style={{ textAlign: 'center' }}>Camera needed to spot cats</AppText>
        <AppText muted style={{ textAlign: 'center' }}>Photos are camera-only and location data is removed before upload.</AppText>
        <Button label="Allow camera" onPress={requestPerm} style={{ alignSelf: 'stretch' }} />
        <Button label="Not now" variant="ghost" onPress={() => nav.goBack()} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  const corner = (pos: object, b: object) => <View style={[{ position: 'absolute', width: CORNER, height: CORNER, borderColor: t.amber, borderWidth: 4, borderRadius: 12 }, pos, b]} />;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} />
      {/* viewfinder corners */}
      {corner({ left: 44, top: '30%' }, { borderRightWidth: 0, borderBottomWidth: 0 })}
      {corner({ right: 44, top: '30%' }, { borderLeftWidth: 0, borderBottomWidth: 0 })}
      {corner({ left: 44, bottom: '30%' }, { borderRightWidth: 0, borderTopWidth: 0 })}
      {corner({ right: 44, bottom: '30%' }, { borderLeftWidth: 0, borderTopWidth: 0 })}

      <View style={{ position: 'absolute', top: insets.top + 8, left: 14, right: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <IconButton name="x" label="Close camera" onPress={() => nav.goBack()} />
          <Chip tone="dark" label="Camera only" icon={<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A4A' }} />} />
          <IconButton name="bolt" label="Flash is off" />
        </View>
        {tip && (
          <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.cream, borderWidth: border, borderColor: '#151515', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10 }}>
            <AppText size={12} weight="semi" color="#151515" style={{ flex: 1 }}>Keep your distance · No flash · Don’t chase</AppText>
            <Pressable accessibilityLabel="Dismiss tip" onPress={() => setTip(false)} hitSlop={8}><Icon name="x" size={14} color="#151515" /></Pressable>
          </View>
        )}
      </View>

      {detected && (
        <View style={{ position: 'absolute', top: '24%', alignSelf: 'center' }}>
          <Chip tone="amber" icon={<Icon name="check" size={14} color="#151515" />} label={`Cat detected · ${COATS[detected.variant].name} · ${detected.pct}%`} />
        </View>
      )}

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 24 }}>
        <IconButton name="image" label="Choose from library" size={52} onPress={pick} />
        <Pressable accessibilityRole="button" accessibilityLabel="Take photo" onPress={shoot} disabled={busy}>
          <View style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color={t.amber} /> : <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: t.amber, borderWidth: 3, borderColor: '#151515' }} />}
          </View>
        </Pressable>
        <IconButton name="flip" label="Flip camera" size={52} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} />
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 14, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
        <Icon name="lock" size={13} color="#fff" />
        <AppText size={11} color="#fff">Pin stays approximate · delayed 5 min</AppText>
      </View>
    </View>
  );
}

