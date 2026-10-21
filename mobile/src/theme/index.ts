import { useColorScheme } from 'react-native';

export type Palette = {
  bg: string; card: string; ink: string; stone: string; line: string;
  amber: string; amberDeep: string; red: string; cream: string;
  tile1: string; tile2: string; chip: string; onAmber: string;
  edge: string; shadow: string; dark: string;
  mapLand: string; mapPark: string; mapWater: string;
};

export const light: Palette = {
  bg: '#FAF8F4', card: '#FFFFFF', ink: '#151515', stone: '#8C8A84', line: '#E4E1DA',
  amber: '#FFB400', amberDeep: '#E09A00', red: '#D9402B', cream: '#FFF6DD',
  tile1: '#FFE9B8', tile2: '#E8E4F4', chip: '#EEEBE3', onAmber: '#151515',
  edge: '#151515', shadow: '#151515', dark: '#151515',
  mapLand: '#EDEAE3', mapPark: '#DCE8CE', mapWater: '#CFE3EE',
};

export const darkP: Palette = {
  bg: '#18181A', card: '#242427', ink: '#FAF8F4', stone: '#A9A7A0', line: '#3A3A3E',
  amber: '#FFB400', amberDeep: '#E09A00', red: '#E5533D', cream: '#3A3321',
  tile1: '#4A3E22', tile2: '#34304A', chip: '#34343A', onAmber: '#151515',
  edge: '#F2EFE8', shadow: '#000000', dark: '#151515',
  mapLand: '#2A2A2D', mapPark: '#2F3A2B', mapWater: '#25363F',
};

export const font = {
  regular: 'Fredoka_400Regular',
  medium: 'Fredoka_500Medium',
  semi: 'Fredoka_600SemiBold',
  bold: 'Fredoka_700Bold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { chip: 999, card: 18, button: 16, tile: 14, sheet: 28 } as const;
export const border = 2;

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? darkP : light;
}
