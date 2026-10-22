import type { NavigatorScreenParams } from '@react-navigation/native';
import type { CareNeed, CatVariant } from '@/lib/types';

export type TabParamList = {
  Home: undefined;
  Journal: undefined;
  Care: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  ProfileSetup: undefined;
  Auth: undefined;
  PasswordReset: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  Spot: undefined;
  Reward: { variant: CatVariant; xp: number; isNewCoat: boolean; photoUri?: string };
  ShareCard: { variant: CatVariant; xp?: number; isNewCoat?: boolean; photoUri?: string; area?: string; template?: 'sighting' | 'streak' | 'journal' };
  CareFlag: { presetNeed?: CareNeed; sightingId?: string } | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
