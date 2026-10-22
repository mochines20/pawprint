import type { RefObject } from 'react';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import { COATS, type CatVariant } from '@/lib/types';
import type { CardRef, ShareFormat, ShareTemplate } from '@/components/ShareCard';

export const SITE = 'https://pawprint-omega.vercel.app';

/** Exported pixel sizes. The card is laid out at 360 wide, so these are exactly 3x. */
export const EXPORT_SIZE: Record<ShareFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

/** Renders the card to a PNG in the cache folder and returns its file:// URI. */
export async function renderCard(ref: RefObject<CardRef | null>, format: ShareFormat): Promise<string> {
  if (!ref.current) throw new Error('Card is not ready yet');
  const { width, height } = EXPORT_SIZE[format];
  return captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile', width, height });
}

/** Opens the system share sheet (Instagram, Threads, Messenger, etc.). */
export async function shareCard(ref: RefObject<CardRef | null>, format: ShareFormat): Promise<void> {
  const uri = await renderCard(ref, format);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your pawprint' });
}

/** Saves the card to the photo library (asks for add-only permission). Returns false if denied. */
export async function saveCard(ref: RefObject<CardRef | null>, format: ShareFormat): Promise<boolean> {
  const perm = await requestPermissionsAsync(true);
  if (!perm.granted) return false;
  const uri = await renderCard(ref, format);
  await Asset.create(uri);
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  return true;
}

export type CaptionData = { variant: CatVariant; xp?: number; streak?: number; coats?: number; totalCoats?: number; area?: string };

/** Ready-to-paste caption. Only approximate area is ever included. */
export function buildCaption(template: ShareTemplate, d: CaptionData): string {
  const tags = '#Pawprint #CatsOfThePhilippines #StreetCats';
  if (template === 'streak') {
    return `${d.streak ?? 0}-day spotting streak on Pawprint 🔥 Small habit, kinder to cats.\nGotta spot ’em all → ${SITE}\n${tags}`;
  }
  if (template === 'journal') {
    return `${d.coats ?? 0}/${d.totalCoats ?? 24} coats in my Cat Journal 🐾\nBuild yours → ${SITE}\n${tags}`;
  }
  const coat = COATS[d.variant].name;
  const where = d.area ? ` near ${d.area}` : '';
  const xp = d.xp ? ` +${d.xp} XP.` : '';
  return `Spotted a ${coat}${where}!${xp} Pins are approximate and delayed, so cats stay safe 🐾\nGotta spot ’em all → ${SITE}\n${tags}`;
}

export async function copyCaption(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
  await Haptics.selectionAsync();
}
