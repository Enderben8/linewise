import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import { draftReducer } from './draftSlice';
import { memorizationsReducer } from './memorizationsSlice';
import { settingsReducer } from './settingsSlice';

export const store = configureStore({
  reducer: {
    settings: settingsReducer,
    memorizations: memorizationsReducer,
    draft: draftReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
