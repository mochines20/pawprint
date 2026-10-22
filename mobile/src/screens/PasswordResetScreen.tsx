import { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { AppText, Button, Card, Screen } from '@/components';
import { supabase } from '@/lib/supabase';
import { border, font, space, useTheme } from '@/theme';

export function PasswordResetScreen({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = { borderWidth: border, borderColor: t.edge, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: t.card, color: t.ink, fontFamily: font.medium, fontSize: 15 } as const;

  const save = async () => {
    setError('');
    if (password.length < 6 || password !== confirm) { setError('Use at least 6 characters and make both passwords match.'); return; }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      Alert.alert('Password updated', 'You can now use your new password to log in.');
      onDone();
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not update password.'); }
    finally { setBusy(false); }
  };

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: 'center', padding: space.lg }}>
        <AppText size={30} weight="bold" style={{ textAlign: 'center' }}>Choose a new password</AppText>
        <AppText muted size={14} style={{ textAlign: 'center', marginTop: 8 }}>Your recovery link is secure. Set a password to continue using Pawprint.</AppText>
        <Card style={{ marginTop: 20, gap: 10 }}>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="New password" placeholderTextColor={t.stone} style={input} />
          <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" placeholder="Confirm new password" placeholderTextColor={t.stone} style={input} />
          <Button label={busy ? 'Saving…' : 'Save new password'} disabled={busy} onPress={() => void save()} />
          {error ? <AppText size={12} color={t.red} style={{ textAlign: 'center' }}>{error}</AppText> : null}
        </Card>
      </View>
    </Screen>
  );
}
