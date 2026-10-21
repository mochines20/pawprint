export type CatVariant = 'orange' | 'calico' | 'black';
export type Rarity = 'common' | 'uncommon' | 'rare';

export type Sighting = {
  id: string;
  variant: CatVariant;
  /** Approximate point only. The server rounds to a ~150 m grid and delays by 5 minutes. */
  lat: number;
  lng: number;
  when: string;
  mine: boolean;
  seenCount: number;
  expiresIn: string;
  seenAgo: string;
  spottedBy?: string;
  photoUrl?: string;
};

export type CareNeed = 'Water' | 'Food' | 'Injured' | 'Kittens alone' | 'Stuck / unsafe' | 'Other';

export type CareFlag = {
  id: string;
  sightingId?: string;
  need: CareNeed;
  note: string;
  where: string;
  variant: CatVariant;
  mine?: boolean;
  helping?: boolean;
};

export const COATS: Record<CatVariant, { name: string; rarity: Rarity }> = {
  orange: { name: 'Orange tabby', rarity: 'common' },
  calico: { name: 'Calico', rarity: 'uncommon' },
  black: { name: 'All black', rarity: 'rare' },
};
