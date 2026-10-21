import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { AvatarId } from '@/lib/avatarCatalog';
import { avatarChoice, avatarForVariant } from '@/lib/avatarCatalog';
import type { CatVariant } from '@/lib/types';
import { useTheme } from '@/theme';

type Props = { variant: CatVariant; avatarId?: AvatarId; size?: number; tile?: string; radius?: number; bordered?: boolean };

/** Shared Pawprint web sketch avatar artwork, rendered natively through SVG. */
export function CatAvatar({ variant, avatarId, size = 44, tile, radius = 14, bordered = true }: Props) {
  const t = useTheme();
  const selected = avatarChoice(avatarId ?? avatarForVariant(variant));
  const bg = tile ?? (variant === 'orange' ? t.tile1 : variant === 'calico' ? t.tile2 : t.amber);
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: bg, borderWidth: bordered ? 2 : 0, borderColor: t.edge, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <SvgXml xml={selected.xml} width={size} height={size} />
    </View>
  );
}
