import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { AppText, Button, Card, Icon } from '@/components';
import { sendEmailCode, signInWithPassword, signInWithProvider, signUpWithPassword, verifyEmailCode } from '@/lib/api';
import { border, font, radius, space, useTheme } from '@/theme';
import logo from '../../assets/logo.png';

export function AuthScreen() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [method, setMethod] = useState<'password' | 'code'>('password');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const pagePadding = compact ? space.md : space.xl;
  const contentWidth = Math.min(Math.max(width - pagePadding * 2, 0), 520);

  const input = { borderWidth: border, borderColor: t.edge, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: t.card, color: t.ink, fontFamily: font.medium, fontSize: 15 } as const;

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (!sent) {
        await sendEmailCode(email);
        setSent(true);
        Alert.alert('Check your email', 'We sent an 8-digit sign-in code through Brevo.');
      } else {
        if (password && password.length < 6) {
          setError('Your new password must have at least 6 characters.');
          return;
        }
        await verifyEmailCode(email, code, password || undefined);
        if (password) Alert.alert('Password set', 'You can use your email and password the next time you log in.');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Please try again.';
      setError(message.toLowerCase().includes('invalid login credentials')
        ? 'Password not recognized. If you joined with an email code, use the one-time email code instead.'
        : message);
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async () => {
    setError('');
    if (!email.trim() || password.length < 6) {
      setError('Enter a valid email and a password with at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      const session = authMode === 'login'
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password);
      if (authMode === 'signup' && !session) {
        Alert.alert('Confirm your email', 'Check your inbox, then return here to log in.');
        setAuthMode('login');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Please try again.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const social = async (provider: 'google' | 'apple') => {
    setError('');
    setBusy(true);
    try { await signInWithProvider(provider); } catch (e) { setError(e instanceof Error ? e.message : 'Could not continue.'); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: pagePadding, paddingVertical: compact ? space.lg : space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={{ width: contentWidth, maxWidth: 520, alignSelf: 'center', gap: compact ? space.md : space.lg }}>
          <View style={{ alignItems: 'center', gap: space.md }}>
            <View style={{ borderWidth: border, borderColor: t.edge, borderRadius: radius.card, padding: space.sm, backgroundColor: t.card }}>
              <Image source={logo} style={{ width: compact ? 48 : 58, height: compact ? 48 : 58, tintColor: t.ink }} resizeMode="contain" accessibilityLabel="Pawprint logo" />
            </View>
            <View style={{ alignItems: 'center' }}>
              <AppText size={compact ? 30 : 36} weight="bold" style={{ textAlign: 'center' }}>Welcome to Pawprint</AppText>
              <AppText muted size={compact ? 14 : 15} style={{ marginTop: space.xs, textAlign: 'center', lineHeight: compact ? 20 : 22 }}>Sign in to load your real Journal, sightings, Care Flags, streak, and XP.</AppText>
            </View>
          </View>
          <View style={{ gap: 10 }}>
            <Button label="Continue with Google" variant="ghost" onPress={() => social('google')} disabled={busy} />
            <Button label="Continue with Apple" variant="ghost" onPress={() => social('apple')} disabled={busy} />
            <AppText muted size={12} style={{ textAlign: 'center', marginVertical: 2 }}>or use email</AppText>
          </View>
          <Card>
            <View style={{ gap: 10 }}>
              <TextInput value={email} onChangeText={setEmail} editable={!sent} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="Your email address" placeholderTextColor={t.stone} style={input} />
              {method === 'password' ? (
                <>
                  <View style={{ position: 'relative' }}>
                    <TextInput value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder="Password" placeholderTextColor={t.stone} style={[input, { paddingRight: 48 }]} />
                    <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword((visible) => !visible)} style={{ position: 'absolute', top: 0, right: 8, bottom: 0, width: 38, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} color={t.stone} />
                    </Pressable>
                  </View>
                  <Button label={busy ? 'Please wait…' : authMode === 'login' ? 'Log in securely' : 'Create account'} onPress={submitPassword} disabled={busy || !email || password.length < 6} />
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
                    <AppText muted size={12}>{authMode === 'login' ? 'New to Pawprint?' : 'Already have an account?'}</AppText>
                    <Pressable accessibilityRole="button" onPress={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setError(''); }}>
                      <AppText size={12} weight="bold" color={t.ink}>{authMode === 'login' ? 'Create one' : 'Log in'}</AppText>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <TextInput value={code} onChangeText={setCode} editable={sent} keyboardType="number-pad" maxLength={8} placeholder={sent ? '8-digit email code' : 'Code appears after sending'} placeholderTextColor={t.stone} style={[input, !sent && { opacity: 0.6 }]} />
                  <AppText muted size={12} style={{ marginTop: 1 }}>Optional: set a password for future logins</AppText>
                  <View style={{ position: 'relative' }}>
                    <TextInput value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="new-password" placeholder="New password (optional)" placeholderTextColor={t.stone} style={[input, { paddingRight: 48 }]} />
                    <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword((visible) => !visible)} style={{ position: 'absolute', top: 0, right: 8, bottom: 0, width: 38, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} color={t.stone} />
                    </Pressable>
                  </View>
                  <Button label={busy ? 'Please wait…' : sent ? 'Verify and load live data' : 'Send sign-in code'} onPress={submit} disabled={busy || !email || (sent && code.length < 6)} />
                </>
              )}
              <Pressable accessibilityRole="button" onPress={() => { setMethod(method === 'password' ? 'code' : 'password'); setSent(false); setCode(''); setPassword(''); setError(''); }} style={{ alignSelf: 'center', padding: 4 }}>
                <AppText muted size={12} style={{ textDecorationLine: 'underline' }}>{method === 'password' ? 'Use a one-time email code instead' : 'Use password instead'}</AppText>
              </Pressable>
              {error ? <AppText color={t.red} size={12} style={{ textAlign: 'center' }}>{error}</AppText> : null}
            </View>
          </Card>
          <Pressable accessibilityRole="button" accessibilityLabel="Open privacy and permissions" onPress={() => setPrivacyVisible(true)} style={{ alignSelf: 'center', padding: space.sm }}>
            <AppText color={t.ink} size={13} weight="semi" style={{ textDecorationLine: 'underline' }}>Privacy & permissions</AppText>
          </Pressable>
        </View>
      </ScrollView>
      <Modal visible={privacyVisible} transparent animationType="slide" onRequestClose={() => setPrivacyVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'flex-end' }}>
          <View style={{ width: '100%', maxWidth: 560, maxHeight: '90%', alignSelf: 'center', backgroundColor: t.card, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderWidth: border, borderColor: t.edge, padding: space.lg }}>
            <View style={{ alignItems: 'center', marginBottom: space.md }}>
              <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: t.stone, opacity: 0.65 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <AppText size={24} weight="bold">Privacy & permissions</AppText>
                <AppText muted size={13} style={{ marginTop: 2 }}>You stay in control of what Pawprint stores and shares.</AppText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close privacy details" onPress={() => setPrivacyVisible(false)} style={{ padding: space.sm }}>
                <AppText size={24} weight="bold">×</AppText>
              </Pressable>
            </View>
            <ScrollView style={{ marginTop: space.lg }} contentContainerStyle={{ gap: space.md, paddingBottom: space.sm }}>
              <PrivacyRow title="Account & sign-in" body="We use your email or chosen sign-in provider to create and secure your account. Your password is never stored by Pawprint." />
              <PrivacyRow title="Photos & cat sightings" body="Photos you submit can be checked for a real cat, saved to your private Journal, and used to create your pawprint record." />
              <PrivacyRow title="Location privacy" body="Camera and location are requested only when a feature needs them. Public map pins use an approximate area and a safety delay—not your exact location." />
              <PrivacyRow title="Care Flags" body="A Care Flag is an observation, not a diagnosis. If you submit one, it can be shown to nearby volunteers to help coordinate safe care." />
              <PrivacyRow title="Your controls" body="You can review privacy settings, export or delete your data, and reset the demo from your Profile controls." />
              <AppText muted size={12} style={{ lineHeight: 18 }}>Permissions can be denied, but features such as taking a photo or placing a sighting may not work without the related permission.</AppText>
            </ScrollView>
            <Button label="I understand" onPress={() => setPrivacyVisible(false)} style={{ marginTop: space.md }} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function PrivacyRow({ title, body }: { title: string; body: string }) {
  const t = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: radius.tile, padding: space.md, backgroundColor: t.bg }}>
      <AppText weight="bold" size={14}>{title}</AppText>
      <AppText muted size={13} style={{ marginTop: 3, lineHeight: 18 }}>{body}</AppText>
    </View>
  );
}
