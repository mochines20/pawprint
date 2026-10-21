import { View } from 'react-native';
import { useTheme } from '@/theme';

export function ProgressBar({ value, onDark }: { value: number; onDark?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ height: 10, borderRadius: 99, backgroundColor: onDark ? '#3A3A3A' : t.line, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', borderRadius: 99, backgroundColor: t.amber }} />
    </View>
  );
}
