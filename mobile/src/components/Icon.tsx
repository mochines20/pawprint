import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName = 'home' | 'book' | 'cam' | 'care' | 'user' | 'back' | 'x' | 'locate' | 'flip' | 'bolt' | 'flame' | 'check' | 'lock' | 'clock' | 'flag' | 'eye' | 'eyeOff' | 'image';

type Props = { name: IconName; size?: number; color?: string };

export function Icon({ name, size = 22, color = '#151515' }: Props) {
  const p = { stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && <Path {...p} d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />}
      {name === 'book' && (<><Path {...p} d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><Path {...p} d="M5 17a3 3 0 0 1 3-3h11" /></>)}
      {name === 'cam' && (<><Path {...p} d="M4 8h3l2-3h6l2 3h3v11H4z" /><Circle {...p} cx="12" cy="13" r="3.5" /></>)}
      {name === 'care' && <Path {...p} d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />}
      {name === 'user' && (<><Circle {...p} cx="12" cy="8" r="4" /><Path {...p} d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>)}
      {name === 'back' && <Path {...p} strokeWidth={2.6} d="M15 5l-7 7 7 7" />}
      {name === 'x' && <Path {...p} strokeWidth={2.6} d="M6 6l12 12M18 6L6 18" />}
      {name === 'locate' && (<><Circle {...p} cx="12" cy="12" r="4" /><Path {...p} d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>)}
      {name === 'flip' && (<><Path {...p} d="M4 8V5h3M20 16v3h-3" /><Path {...p} d="M5 12a7 7 0 0 1 12-4l2 2M19 12a7 7 0 0 1-12 4l-2-2" /></>)}
      {name === 'bolt' && (<><Path {...p} d="M13 2L5 14h6l-1 8 8-12h-6z" /><Path {...p} d="M3 3l18 18" /></>)}
      {name === 'flame' && <Path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 3-6 1 2 2 2 2 1 0-3-1-4 1-7Z" fill="#D9402B" stroke="#151515" strokeWidth={1.8} strokeLinejoin="round" />}
      {name === 'check' && <Path {...p} strokeWidth={3.4} d="M5 12.5l4.5 4.5L19 7" />}
      {name === 'lock' && (<><Rect {...p} x="5" y="11" width="14" height="9" rx="2" /><Path {...p} d="M8 11V8a4 4 0 0 1 8 0v3" /></>)}
      {name === 'clock' && (<><Circle {...p} cx="12" cy="12" r="9" /><Path {...p} d="M12 12V6.5" /></>)}
      {name === 'flag' && <Path {...p} d="M6 21V4M6 5h11l-2 4 2 4H6" />}
      {name === 'eye' && (<><Path {...p} d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><Circle {...p} cx="12" cy="12" r="3" /></>)}
      {name === 'eyeOff' && (<><Path {...p} d="M3 3l18 18M10.6 5.2A11.5 11.5 0 0 1 12 5c6 0 10 7 10 7a17.5 17.5 0 0 1-3.1 3.6M6.2 6.2C3.7 8 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 3.4-.6" /><Path {...p} d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>)}
      {name === 'image' && (<><Rect {...p} x="3" y="4" width="18" height="16" rx="3" /><Circle {...p} cx="9" cy="10" r="2" /><Path {...p} d="M21 16l-5-5-9 9" /></>)}
    </Svg>
  );
}
