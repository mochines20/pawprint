import { createContext, useContext } from 'react';

type Flow = { finishOnboarding: () => void; finishProfileSetup: () => void };
export const AppFlow = createContext<Flow>({ finishOnboarding: () => {}, finishProfileSetup: () => {} });
export const useAppFlow = () => useContext(AppFlow);
