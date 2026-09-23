import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  createFolder,
  createMemorization,
  deleteFolder,
  deleteMemorization,
  listFolders,
  listMemorizations,
  moveToFolder,
  renameFolder,
  updateMemorization,
  type MemorizationInput,
  type MemorizationWithProgress,
} from '../db/repo';
import type { FolderRow } from '../db/schema';
import { deleteAudioFiles } from '../features/recordings/files';

interface MemorizationsSlice {
  items: MemorizationWithProgress[];
  folders: FolderRow[];
  loaded: boolean;
}

const initialState: MemorizationsSlice = { items: [], folders: [], loaded: false };

const slice = createSlice({
  name: 'memorizations',
  initialState,
  reducers: {
    setItems(state, action: PayloadAction<MemorizationWithProgress[]>) {
      state.items = action.payload;
      state.loaded = true;
    },
    setFolders(state, action: PayloadAction<FolderRow[]>) {
      state.folders = action.payload;
    },
  },
});

export const memorizationsReducer = slice.reducer;
export const memorizationsActions = slice.actions;

type Dispatch = (
  a: ReturnType<typeof slice.actions.setItems> | ReturnType<typeof slice.actions.setFolders>,
) => void;

/** Reloads texts and folders from SQLite. Call after any write that touches memorizations or progress. */
export const reloadMemorizations = () => (dispatch: Dispatch) => {
  dispatch(slice.actions.setFolders(listFolders()));
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

export const addFolder = (name: string) => (dispatch: Dispatch) => {
  const id = createFolder(name);
  dispatch(slice.actions.setFolders(listFolders()));
  return id;
};

export const editFolderName = (id: string, name: string) => (dispatch: Dispatch) => {
  renameFolder(id, name);
  dispatch(slice.actions.setFolders(listFolders()));
};

/** Deletes the folder only; its texts stay, in no folder. */
export const removeFolder = (id: string) => (dispatch: Dispatch) => {
  deleteFolder(id);
  dispatch(slice.actions.setFolders(listFolders()));
  dispatch(slice.actions.setItems(listMemorizations()));
};

/** Moves texts into a folder, or out of every folder with `null`. */
export const moveMemorizations =
  (ids: string[], folderId: string | null) => (dispatch: Dispatch) => {
    moveToFolder(ids, folderId);
    dispatch(slice.actions.setItems(listMemorizations()));
  };
