import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { LIMITS } from '../../config';
import { markdownToText, titleFromFileName } from './markdown';

export type PickResult =
  | { status: 'ok'; title: string; body: string }
  | { status: 'cancelled' }
  | { status: 'too-large' }
  | { status: 'error'; message: string };

/** Lets the user pick a .txt or .md file and returns its text. */
export async function pickTextFile(): Promise<PickResult> {
  try {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['text/plain', 'text/markdown', 'text/x-markdown', 'text/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.[0]) return { status: 'cancelled' };
    const asset = res.assets[0];
    if (asset.size && asset.size > LIMITS.maxBodyBytes * 4) return { status: 'too-large' };
    const raw = await new File(asset.uri).text();
    const isMarkdown = /\.(md|markdown)$/i.test(asset.name) || asset.mimeType?.includes('markdown');
    const body = (isMarkdown ? markdownToText(raw) : raw).replace(/^﻿/, '').trim();
    return { status: 'ok', title: titleFromFileName(asset.name), body };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
