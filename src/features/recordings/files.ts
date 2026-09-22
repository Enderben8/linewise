import { Directory, File, Paths } from 'expo-file-system';

/** Deletes audio files, ignoring ones that are already gone. */
export function deleteAudioFiles(uris: string[]): void {
  for (const uri of uris) {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // A missing or locked file must not block deleting the database row.
    }
  }
}

/** Moves a finished recording from the cache into the app's document folder so it survives cache clean-ups. */
export async function persistRecording(tempUri: string, id: string): Promise<string> {
  const dir = new Directory(Paths.document, 'recordings');
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${id}.m4a`);
  const source = new File(tempUri);
  try {
    source.moveSync(dest);
  } catch {
    source.copySync(dest);
    try {
      source.delete();
    } catch {
      // The cache copy is harmless if it cannot be removed.
    }
  }
  return dest.uri;
}

/** A URI the audio player can load for a stored recording. On Android the file path is used as is. */
export function usePlayableUri(storedUri: string): string | null {
  return storedUri;
}
