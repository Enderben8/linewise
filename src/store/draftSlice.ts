import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** A text on its way into the editor: typed, imported from a file, scanned, or shared from another app. */
export interface Draft {
  title: string;
  author: string;
  body: string;
}

const empty: Draft = { title: '', author: '', body: '' };

const slice = createSlice({
  name: 'draft',
  initialState: empty,
  reducers: {
    setDraft: (_state, action: PayloadAction<Partial<Draft>>) => ({ ...empty, ...action.payload }),
    clearDraft: () => empty,
  },
});

export const draftReducer = slice.reducer;
export const draftActions = slice.actions;
