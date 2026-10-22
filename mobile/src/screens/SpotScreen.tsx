import { createElement, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
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
  const webInput = useRef<any>(null);
  const [perm, requestPerm] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [tip, setTip] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detected, setDetected] = useState<{ variant: CatVariant; pct: number } | null>(null);

  const finish = async (uri: string, captureSource: 'camera' | 'gallery') => {
    setBusy(true);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (captureSource === 'camera') {
        const location = await Location.requestForegroundPermissionsAsync();
        if (location.status !== 'granted') throw new Error('LOCATION_PERMISSION_REQUIRED');
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }
      const res = await submitSighting({
        photoUri: uri,
        captureSource,
        showPin: true,
        latitude,
        longitude,
        description: 'Street cat spotted near my current location.',
        capturedAt: new Date().toISOString(),
      });
      if (res.status !== 'accepted') {
        setDetected(null);
        Alert.alert('Pawprint needs a review', res.reason || 'The photo was saved for review.');
        return;
      }
      const variant: CatVariant = res.variant;
      setDetected({ variant, pct: res.pct });
      if (captureSource === 'gallery') {
        Alert.alert('Saved to Journal', 'Gallery uploads do not earn XP or extend your streak. Use a fresh camera capture for rewards.');
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
    if (cameraError) {
      Alert.alert('Camera unavailable', 'Close other apps using the camera, then reopen Pawprint and try again.');
      return;
    }
    if (!cameraReady) {
      Alert.alert('Camera is starting', 'Wait a moment for the camera preview to become ready.');
      return;
    }
    try {
      // exif: false keeps GPS out of the file. The server strips metadata again.
      const pic = await Promise.race([
        cam.current.takePictureAsync({ quality: 0.7, exif: false }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
      ]);
      if (!pic?.uri) throw new Error('CAMERA_CAPTURE_TIMEOUT');
      await finish(pic.uri, 'camera');
    } catch (error) {
      Alert.alert('Could not take photo', error instanceof Error && error.message === 'CAMERA_CAPTURE_TIMEOUT' ? 'The camera did not respond. Close other camera apps and try again.' : 'Please try the camera again.');
    }
  };

  const handleWebFile = async (event: any) => {
    const file = event.currentTarget?.files?.[0] as File | undefined;
    event.currentTarget.value = '';
    if (!file) return;
    const uri = URL.createObjectURL(file);
    try { await finish(uri, 'gallery'); } finally { URL.revokeObjectURL(uri); }
  };

  const pick = async () => {
    if (Platform.OS === 'web') {
      webInput.current?.click();
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, exif: false });
    if (!r.canceled && r.assets[0]) await finish(r.assets[0].uri, 'gallery');
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
      {Platform.OS === 'web' && createElement('input', {
        ref: webInput,
        type: 'file',
        accept: 'image/*',
        onChange: handleWebFile,
        'aria-label': 'Choose cat photo',
        style: { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' },
      })}
      <CameraView
        ref={cam}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onCameraReady={() => { setCameraReady(true); setCameraError(null); }}
        onMountError={(event) => { setCameraReady(false); setCameraError(event.message || 'CAMERA_UNAVAILABLE'); }}
      />
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

      {cameraError && (
        <View style={{ position: 'absolute', left: 24, right: 24, top: '42%', backgroundColor: '#151515', borderWidth: 2, borderColor: '#FFB815', borderRadius: 16, padding: 14 }}>
          <AppText color="#fff" weight="bold" style={{ textAlign: 'center' }}>Camera unavailable</AppText>
          <AppText size={12} color="#fff" style={{ marginTop: 5, textAlign: 'center' }}>Close other apps using the camera, then reopen this screen.</AppText>
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

