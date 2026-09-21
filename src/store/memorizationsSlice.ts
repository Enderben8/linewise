import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  createMemorization,
  deleteMemorization,
  listMemorizations,
  updateMemorization,
  type MemorizationInput,
  type MemorizationWithProgress,
} from '../db/repo';
import { deleteAudioFiles } from '../features/recordings/files';

interface MemorizationsSlice {
  items: MemorizationWithProgress[];
  loaded: boolean;
}

const initialState: MemorizationsSlice = { items: [], loaded: false };

const slice = createSlice({
  name: 'memorizations',
  initialState,
  reducers: {
    setItems(state, action: PayloadAction<MemorizationWithProgress[]>) {
      state.items = action.payload;
      state.loaded = true;
    },
  },
});

export const memorizationsReducer = slice.reducer;
export const memorizationsActions = slice.actions;

type Dispatch = (a: ReturnType<typeof slice.actions.setItems>) => void;

/** Reloads the list from SQLite. Call after any write that touches memorizations or progress. */
export const reloadMemorizations = () => (dispatch: Dispatch) => {
  dispatch(slice.actions.setItems(listMemorizations()));
};

export const addMemorization = (input: MemorizationInput) => (dispatch: Dispatch) => {
  const id = createMemorization(input);
  dispatch(slice.actions.setItems(listMemorizations()));
  return id;
};

export const editMemorization = (id: string, input: MemorizationInput) => (dispatch: Dispatch) => {
  updateMemorization(id, input);
  dispatch(slice.actions.setItems(listMemorizations()));
};

export const removeMemorization = (id: string) => (dispatch: Dispatch) => {
  const uris = deleteMemorization(id);
  deleteAudioFiles(uris);
  dispatch(slice.actions.setItems(listMemorizations()));
};
