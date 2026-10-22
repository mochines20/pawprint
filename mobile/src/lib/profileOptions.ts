import type { AvatarId } from './avatarCatalog';

export const PROFILE_AGE_OPTIONS = [
  { value: 'under_13', label: 'Under 13' },
  { value: '13_17', label: '13–17' },
  { value: '18_24', label: '18–24' },
  { value: '25_34', label: '25–34' },
  { value: '35_44', label: '35–44' },
  { value: '45_plus', label: '45+' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

export const SPOTTER_TYPES = [
  { value: 'casual', label: 'Casual', detail: 'Spot when you feel like exploring.' },
  { value: 'daily', label: 'Daily', detail: 'Build a gentle daily streak.' },
  { value: 'rescuer', label: 'Rescuer', detail: 'Look out for cats needing care.' },
] as const;

export const AVATAR_OPTIONS: { id: AvatarId; variant: 'black' | 'calico' | 'orange'; label: string }[] = [
  { id: 'cat-ink', variant: 'black', label: 'Black' },
  { id: 'cat-calico', variant: 'calico', label: 'Calico' },
  { id: 'cat-orange', variant: 'orange', label: 'Orange' },
];

export const AREA_OPTIONS = [
  'Muntinlupa',
  'Makati',
  'Manila',
  'Quezon City',
  'Pasig',
  'Taguig',
  'Cebu City',
  'Davao City',
  'Iloilo City',
  'Baguio',
  'Antipolo',
  'Cagayan de Oro',
  'Bacolod',
  'Other city or area',
] as const;

const PROFANITY = ['asshole', 'bitch', 'fuck', 'gago', 'pota', 'putang', 'shit', 'tanga', 'ulol'];

export function generateNickname() {
  const adjectives = ['Sleepy', 'Alley', 'Sunny', 'Gentle', 'Quiet', 'Curious', 'Misty', 'Kind'];
  const cats = ['Tabby', 'Scout', 'Paw', 'Whisker', 'Calico', 'Tuxedo', 'Marmalade', 'Kitten'];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const cat = cats[Math.floor(Math.random() * cats.length)];
  const number = String(Math.floor(Math.random() * 90) + 10).padStart(2, '0');
  return `${adjective}${cat}${number}`;
}

export function validateNickname(value: string) {
  const nickname = value.trim();
  if (!nickname) return 'Pick a nickname or use the dice to generate one.';
  if (nickname.length < 3 || nickname.length > 20) return 'Nickname must be 3–20 characters.';
  if (!/^[A-Za-z0-9_]+$/.test(nickname)) return 'Use letters, numbers, and underscores only.';
  if (/^\S+@\S+\.\S+$/.test(nickname) || /(?:\+?\d[\d\s().-]{6,}\d)/.test(nickname)) return 'Do not use an email address or phone number.';
  const normalized = nickname.toLowerCase();
  if (PROFANITY.some((word) => normalized.includes(word))) return 'Please choose a kinder nickname.';
  return '';
}

export function areaMatches(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return AREA_OPTIONS.slice(0, 8);
  return AREA_OPTIONS.filter((area) => area.toLowerCase().includes(normalized)).slice(0, 8);
}

export function areaFromGeocoder(parts: Array<string | null | undefined>) {
  const text = parts.filter(Boolean).join(', ').toLowerCase();
  return AREA_OPTIONS.find((area) => text.includes(area.toLowerCase().split(',')[0])) ?? '';
}
