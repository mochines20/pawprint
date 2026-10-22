import type { ComponentRef, ReactNode, Ref } from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { AppText } from './AppText';
import { CatAvatar } from './CatAvatar';
import { Icon } from './Icon';
import { COATS, type CatVariant } from '@/lib/types';

/**
 * Shareable image card. Always rendered with the brand palette (not the user's dark/light
 * setting) so the exported PNG looks the same for everyone.
 *
 * Logical size 360 wide; exported at 3x (1080 px wide).
 *   story  → 360 × 640  (9:16)  Stories / Reels / TikTok
 *   square → 360 × 360  (1:1)   feed posts, Threads, Reddit, LinkedIn
 *
 * Templates: sighting (collectible card) · streak · journal.
 * Colour themes: paper · amber · ink (each template has a default; the user can override).
 *
 * PRIVACY: only a nickname, a coat, XP/streak numbers and an APPROXIMATE area label are
 * shown. Never pass coordinates, an address, or a photo with identifiable surroundings.
 */
export type ShareTemplate = 'sighting' | 'streak' | 'journal';
export type ShareFormat = 'story' | 'square';
export type ShareTheme = 'auto' | 'paper' | 'amber' | 'ink';

export type ShareCardProps = {
  template: ShareTemplate;
  format: ShareFormat;
  theme?: ShareTheme;
  nickname: string;
  variant: CatVariant;
  /** City or barangay only, e.g. "Alabang". Never an address. */
  area?: string;
  whenLabel?: string;
  xp?: number;
  isNewCoat?: boolean;
  coatNo?: number;
  streak?: number;
  /** Mon..Sun, which days were spotted this week. */
  week?: boolean[];
  coats?: number;
  totalCoats?: number;
  found?: CatVariant[];
  /** e.g. "Alley Scout · Lv 3" */
  tier?: string;
  photoUri?: string;
  link?: string;
};

export type CardRef = ComponentRef<typeof View>;
export const CARD_W = 360;
export const cardHeight = (f: ShareFormat) => (f === 'story' ? 640 : 360);

const C = {
  ink: '#151515', paper: '#FAF8F4', stone: '#8C8A84', line: '#E4E1DA', amber: '#FFB400',
  cream: '#FFF6DD', chip: '#EEEBE3', red: '#D9402B', white: '#FFFFFF', mint: '#D9F0DC',
  inkSoft: '#2A2A2D',
};

type Surface = { bg: string; fg: string; sub: string; paw: string; dark: boolean; kind: 'paper' | 'amber' | 'ink' };
const SURFACES: Record<'paper' | 'amber' | 'ink', Surface> = {
  paper: { bg: C.paper, fg: C.ink, sub: C.stone, paw: C.ink, dark: false, kind: 'paper' },
  amber: { bg: C.amber, fg: C.ink, sub: '#5A4300', paw: C.ink, dark: false, kind: 'amber' },
  ink: { bg: C.ink, fg: C.paper, sub: '#A9A7A0', paw: C.paper, dark: true, kind: 'ink' },
};
const DEFAULT_THEME: Record<ShareTemplate, 'paper' | 'amber' | 'ink'> = { sighting: 'paper', streak: 'amber', journal: 'ink' };
export function resolveTheme(t: ShareTemplate, theme: ShareTheme = 'auto') {
  return SURFACES[theme === 'auto' ? DEFAULT_THEME[t] : theme];
}

/* ───────────── small pieces ───────────── */
function Paw({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx="12" cy="16" rx="5.6" ry="4.6" fill={color} />
      <Circle cx="5.4" cy="10" r="2.6" fill={color} /><Circle cx="9.6" cy="5.6" r="2.8" fill={color} />
      <Circle cx="14.4" cy="5.6" r="2.8" fill={color} /><Circle cx="18.6" cy="10" r="2.6" fill={color} />
    </Svg>
  );
}

function Star({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" fill={color} />
    </Svg>
  );
}

const PAWS_STORY: [number, number, number, number][] = [[24, 120, 30, -20], [300, 96, 26, 18], [320, 300, 34, 12], [18, 360, 28, -14], [286, 470, 30, -10], [40, 520, 24, 20]];
const PAWS_SQUARE: [number, number, number, number][] = [[18, 90, 24, -18], [318, 70, 22, 16], [330, 210, 28, 10], [24, 260, 22, -12]];
const STARS_STORY: [number, number, number][] = [[14, 190, 22], [326, 150, 18], [20, 430, 16], [322, 400, 24], [300, 540, 12]];
const STARS_SQUARE: [number, number, number][] = [[16, 130, 18], [326, 120, 16], [330, 250, 20], [22, 240, 12]];

/** Faint paw prints + a few sparkles. Fixed positions so exports are deterministic. */
function Decor({ format, s }: { format: ShareFormat; s: Surface }) {
  const paws = format === 'story' ? PAWS_STORY : PAWS_SQUARE;
  const stars = format === 'story' ? STARS_STORY : STARS_SQUARE;
  const starColor = s.kind === 'amber' ? C.ink : C.amber;
  return (
    <>
      {paws.map(([x, y, sz, r], i) => (
        <View key={`p${i}`} style={{ position: 'absolute', left: x, top: y, opacity: 0.07, transform: [{ rotate: `${r}deg` }] }}>
          <Paw size={sz} color={s.paw} />
        </View>
      ))}
      {stars.map(([x, y, sz], i) => (
        <View key={`s${i}`} style={{ position: 'absolute', left: x, top: y }}>
          <Star size={sz} color={i % 2 ? (s.kind === 'amber' ? C.paper : C.paper) : starColor} />
        </View>
      ))}
    </>
  );
}

function HardCard({ children, w, radius = 26, bg = C.white, offset = 6, style }: { children: ReactNode; w?: number; radius?: number; bg?: string; offset?: number; style?: object }) {
  return (
    <View style={[{ width: w, paddingRight: offset, paddingBottom: offset }, style]}>
      <View style={{ position: 'absolute', left: offset, top: offset, right: 0, bottom: 0, borderRadius: radius, backgroundColor: C.ink }} />
      <View style={{ borderRadius: radius, borderWidth: 3, borderColor: C.ink, backgroundColor: bg, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

function Pill({ children, bg, fg, border = C.ink, align = 'flex-start' }: { children: string; bg: string; fg: string; border?: string; align?: 'flex-start' | 'center' }) {
  return (
    <View style={{ alignSelf: align, backgroundColor: bg, borderColor: border, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <AppText size={11} weight="bold" color={fg} upper numberOfLines={1}>{children}</AppText>
    </View>
  );
}

function Hero({ photoUri, variant, size, radius }: { photoUri?: string; variant: CatVariant; size: number; radius: number }) {
  return photoUri ? (
    <Image source={{ uri: photoUri }} style={{ width: size, height: size, borderRadius: radius, borderWidth: 2.5, borderColor: C.ink, backgroundColor: C.chip }} />
  ) : (
    <CatAvatar variant={variant} size={size} radius={radius} tile={variant === 'black' ? C.cream : undefined} />
  );
}

/** Round streak badge that overlaps the sighting card's corner. */
function StreakBadge({ n, size, s }: { n: number; size: number; s: Surface }) {
  const onAmber = s.kind === 'amber';
  return (
    <View style={{ position: 'absolute', right: -14, bottom: -16, transform: [{ rotate: '8deg' }] }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: C.ink, backgroundColor: onAmber ? C.ink : C.amber, alignItems: 'center', justifyContent: 'center' }}>
        <AppText size={size * 0.4} weight="bold" color={onAmber ? C.amber : C.ink} style={{ lineHeight: size * 0.44 }}>{n}</AppText>
        <AppText size={size * 0.14} weight="bold" color={onAmber ? C.paper : C.ink} upper numberOfLines={1}>streak</AppText>
      </View>
    </View>
  );
}

/* ───────────── sighting: collectible card ───────────── */
function SightingBody({ p, compact, s }: { p: ShareCardProps; compact: boolean; s: Surface }) {
  const coat = COATS[p.variant];
  const rarityBg = coat.rarity === 'rare' ? C.amber : coat.rarity === 'uncommon' ? C.mint : C.chip;
  const no = String(p.coatNo ?? 1).padStart(2, '0');
  const where = [p.whenLabel, p.area ? `${p.area} area` : null].filter(Boolean).join(' · ');

  const info = (
    <View style={{ gap: compact ? 6 : 8 }}>
      <AppText size={compact ? 22 : 30} weight="bold" color={C.ink} numberOfLines={1}>{coat.name}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Icon name="locate" size={13} color={C.stone} />
        <AppText size={12} color={C.stone}>{where}</AppText>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <Pill bg={rarityBg} fg={C.ink}>{coat.rarity}</Pill>
        {p.xp ? <Pill bg={C.ink} fg={C.paper}>{`+${p.xp} XP`}</Pill> : null}
      </View>
    </View>
  );

  return (
    <View style={{ transform: [{ rotate: '-2deg' }] }}>
      {compact ? (
        <HardCard w={316} radius={24} offset={5}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 }}>
            <Hero photoUri={p.photoUri} variant={p.variant} size={108} radius={18} />
            <View style={{ flex: 1, gap: 6 }}>
              <AppText size={11} weight="bold" color={C.stone} upper>No. {no} / {p.totalCoats ?? 24}</AppText>
              {info}
            </View>
          </View>
        </HardCard>
      ) : (
        <HardCard w={284} radius={28}>
          <View style={{ padding: 14, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText size={12} weight="bold" color={C.stone} upper>No. {no} / {p.totalCoats ?? 24}</AppText>
              <Icon name="eye" size={16} color={C.stone} />
            </View>
            <Hero photoUri={p.photoUri} variant={p.variant} size={256} radius={20} />
            {info}
          </View>
          <View style={{ backgroundColor: C.ink, paddingVertical: 8, alignItems: 'center' }}>
            <AppText size={11} weight="bold" color={C.amber} upper>Pawprint · Cat Journal</AppText>
          </View>
        </HardCard>
      )}
      {p.isNewCoat ? (
        <View style={{ position: 'absolute', top: compact ? -12 : -14, left: -14, transform: [{ rotate: '-10deg' }] }}>
          <View style={{ backgroundColor: C.amber, borderWidth: 2.5, borderColor: C.ink, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
            <AppText size={compact ? 12 : 14} weight="bold" color={C.ink}>NEW COAT!</AppText>
          </View>
        </View>
      ) : null}
      {p.streak ? <StreakBadge n={p.streak} size={compact ? 54 : 66} s={s} /> : null}
    </View>
  );
}

/* ───────────── streak ───────────── */
function streakLabel(n: number) {
  if (n >= 30) return 'Legend status';
  if (n >= 7) return 'On fire';
  if (n >= 3) return 'On a roll';
  return 'Just getting started';
}

function StreakBody({ p, compact, s }: { p: ShareCardProps; compact: boolean; s: Surface }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const week = p.week ?? [false, false, false, false, false, false, false];
  const n = p.streak ?? 0;
  const halo = compact ? 112 : 196;
  const haloColor = s.kind === 'ink' ? C.inkSoft : s.kind === 'amber' ? 'rgba(255,255,255,0.4)' : C.cream;
  return (
    <View style={{ alignItems: 'center', gap: compact ? 8 : 14 }}>
      <Pill align="center" bg={s.kind === 'ink' ? C.amber : C.ink} fg={s.kind === 'ink' ? C.ink : C.paper}>{streakLabel(n)}</Pill>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: halo, height: halo, borderRadius: halo / 2, backgroundColor: haloColor }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="flame" size={compact ? 58 : 100} />
          <AppText size={compact ? 92 : 156} weight="bold" color={s.fg} style={{ lineHeight: compact ? 98 : 164 }}>{n}</AppText>
        </View>
      </View>
      <AppText size={compact ? 20 : 28} weight="bold" color={s.fg}>day spotting streak</AppText>
      <HardCard radius={20} offset={4} style={{ marginTop: compact ? 2 : 8 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10 }}>
          {days.map((d, i) => (
            <View key={i} style={{ alignItems: 'center', gap: 4 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: C.ink, backgroundColor: week[i] ? C.amber : C.paper, alignItems: 'center', justifyContent: 'center' }}>
                {week[i] ? <Icon name="check" size={14} /> : null}
              </View>
              <AppText size={10} weight="semi" color={C.stone}>{d}</AppText>
            </View>
          ))}
        </View>
      </HardCard>
    </View>
  );
}

/* ───────────── journal ───────────── */
function JournalBody({ p, compact, s }: { p: ShareCardProps; compact: boolean; s: Surface }) {
  const total = p.totalCoats ?? 24;
  const have = p.coats ?? 0;
  const found = p.found ?? [];
  const tile = compact ? 44 : 88;
  const gap = compact ? 8 : 12;
  const cols = compact ? 6 : 3;
  const items: (CatVariant | null)[] = Array.from({ length: 6 }, (_, i) => found[i] ?? null);
  const accent = s.kind === 'amber' ? s.fg : s.kind === 'ink' ? C.amber : C.amber;
  const lockBg = s.kind === 'ink' ? C.inkSoft : s.kind === 'amber' ? 'rgba(255,255,255,0.45)' : C.chip;
  const lockBorder = s.kind === 'ink' ? '#5B5B60' : s.kind === 'amber' ? C.ink : C.stone;
  const lockFg = s.kind === 'ink' ? '#7A7A80' : s.kind === 'amber' ? C.ink : C.stone;
  const trackBg = s.kind === 'ink' ? C.inkSoft : C.white;
  const trackBorder = s.kind === 'ink' ? C.paper : C.ink;
  const fill = s.kind === 'amber' ? C.ink : C.amber;
  return (
    <View style={{ alignItems: 'center', gap: compact ? 10 : 18, width: '100%' }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          <AppText size={compact ? 56 : 96} weight="bold" color={s.fg} style={{ lineHeight: compact ? 62 : 104 }}>{have}</AppText>
          <AppText size={compact ? 24 : 38} weight="bold" color={accent} style={{ marginBottom: compact ? 8 : 14 }}>/ {total}</AppText>
        </View>
        <AppText size={compact ? 15 : 20} weight="bold" color={s.fg}>coats in my Cat Journal</AppText>
      </View>
      {p.tier ? <Pill align="center" bg={s.kind === 'ink' ? C.amber : C.ink} fg={s.kind === 'ink' ? C.ink : C.paper}>{p.tier}</Pill> : null}
      <View style={{ width: '86%', height: 14, borderRadius: 7, borderWidth: 2, borderColor: trackBorder, backgroundColor: trackBg, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, (have / total) * 100)}%`, height: '100%', backgroundColor: fill }} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap, maxWidth: cols * tile + (cols - 1) * gap }}>
        {items.map((v, i) =>
          v ? (
            <CatAvatar key={i} variant={v} size={tile} radius={tile * 0.24} />
          ) : (
            <View key={i} style={{ width: tile, height: tile, borderRadius: tile * 0.24, borderWidth: 2, borderColor: lockBorder, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: lockBg }}>
              <AppText size={tile * 0.4} weight="bold" color={lockFg}>?</AppText>
            </View>
          ),
        )}
      </View>
    </View>
  );
}

/* ───────────── card ───────────── */
export function ShareCard({ ref, ...props }: ShareCardProps & { ref?: Ref<CardRef> }) {
  const compact = props.format === 'square';
  const h = cardHeight(props.format);
  const s = resolveTheme(props.template, props.theme);

  // CTA pill colours per surface so it always pops
  const cta = s.kind === 'paper'
    ? { bg: C.amber, fg: C.ink, border: C.ink, shadow: C.ink }
    : s.kind === 'amber'
      ? { bg: C.ink, fg: C.amber, border: C.ink, shadow: C.paper }
      : { bg: C.ink, fg: C.paper, border: C.paper, shadow: C.paper };

  return (
    // collapsable={false} keeps the view alive on Android for capture.
    <View ref={ref} collapsable={false} style={{ width: CARD_W, height: h, backgroundColor: s.bg, overflow: 'hidden' }}>
      <Decor format={props.format} s={s} />

      {/* header */}
      <View style={{ paddingHorizontal: 20, paddingTop: compact ? 16 : 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Image source={require('../../assets/logo.png')} style={{ width: compact ? 26 : 34, height: compact ? 28 : 37, tintColor: s.dark ? C.paper : C.ink }} resizeMode="contain" />
        <View style={{ backgroundColor: s.dark ? C.amber : C.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
          <AppText size={11} weight="bold" color={s.dark ? C.ink : C.paper}>@{props.nickname}</AppText>
        </View>
      </View>

      {/* body */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
        {props.template === 'sighting' && <SightingBody p={props} compact={compact} s={s} />}
        {props.template === 'streak' && <StreakBody p={props} compact={compact} s={s} />}
        {props.template === 'journal' && <JournalBody p={props} compact={compact} s={s} />}
      </View>

      {/* footer */}
      <View style={{ paddingHorizontal: 20, paddingBottom: compact ? 14 : 24, gap: compact ? 4 : 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <AppText size={compact ? 15 : 18} weight="bold" color={s.fg}>Gotta spot ’em all.</AppText>
            <AppText size={11} color={s.sub}>{props.link ?? 'pawprint-omega.vercel.app'}</AppText>
          </View>
          <View style={{ paddingRight: 3, paddingBottom: 3 }}>
            <View style={{ position: 'absolute', left: 3, top: 3, right: 0, bottom: 0, borderRadius: 14, backgroundColor: cta.shadow }} />
            <View style={{ backgroundColor: cta.bg, borderWidth: 2, borderColor: cta.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 }}>
              <AppText size={12} weight="bold" color={cta.fg}>Get early access →</AppText>
            </View>
          </View>
        </View>
        {!compact && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="lock" size={11} color={s.sub} />
            <AppText size={10} color={s.sub}>Approximate areas only · exact locations are never shared</AppText>
          </View>
        )}
      </View>
    </View>
  );
}
