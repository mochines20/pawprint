import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

type Props = { size?: number; fill?: string; selected?: boolean };

/** Pawprint pin: amber teardrop, ink outline, paw inside a paper circle. */
export function PinMarker({ size = 44, fill = '#FFB400', selected }: Props) {
  const s = selected ? size * 1.22 : size;
  return (
    <Svg width={s} height={s * 1.1} viewBox="-22 -38 44 54">
      <Path d="M0 -34C-10 -34 -17 -27 -17 -17C-17 -3 0 14 0 14C0 14 17 -3 17 -17C17 -27 10 -34 0 -34Z" fill={fill} stroke="#151515" strokeWidth={3} strokeLinejoin="round" />
      <Circle cx={0} cy={-18} r={8} fill="#FAF8F4" stroke="#151515" strokeWidth={2.2} />
      <G transform="translate(0 -17) scale(.34)" fill="#151515">
        <Ellipse cx={0} cy={4.5} rx={8.6} ry={7.4} />
        <G transform="rotate(-24 -10.5 -3.6)"><Ellipse cx={-10.5} cy={-3.6} rx={3.6} ry={4.6} /></G>
        <Ellipse cx={-3.8} cy={-9.4} rx={3.6} ry={4.8} />
        <Ellipse cx={3.8} cy={-9.4} rx={3.6} ry={4.8} />
        <G transform="rotate(24 10.5 -3.6)"><Ellipse cx={10.5} cy={-3.6} rx={3.6} ry={4.6} /></G>
      </G>
    </Svg>
  );
}
