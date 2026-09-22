import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loadSettingsRows, saveSetting } from '../db/repo';
import { DEFAULT_SETTINGS, mergeSettings, type Settings } from '../features/settings/defaults';

interface SettingsSlice {
  values: Settings;
  hydrated: boolean;
}

const initialState: SettingsSlice = { values: DEFAULT_SETTINGS, hydrated: false };

const slice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    hydrate(state, action: PayloadAction<Settings>) {
      state.values = action.payload;
      state.hydrated = true;
    },
    set(state, action: PayloadAction<Partial<Settings>>) {
      state.values = { ...state.values, ...action.payload };
    },
  },
});

export const settingsReducer = slice.reducer;

/** Reads the settings from SQLite into the store, and returns them. */
export const loadSettings =
  () =>
  (dispatch: (a: ReturnType<typeof slice.actions.hydrate>) => void): Settings => {
    const values = mergeSettings(loadSettingsRows());
    dispatch(slice.actions.hydrate(values));
    return values;
  };

/** Updates the store and writes each key to SQLite. */
export const updateSettings =
  (patch: Partial<Settings>) => (dispatch: (a: ReturnType<typeof slice.actions.set>) => void) => {
    dispatch(slice.actions.set(patch));
    for (const [key, value] of Object.entries(patch)) saveSetting(key, value ?? null);
  };
