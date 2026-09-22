import { LIMITS } from '../../config';
import { pickBrowserFile } from '../../lib/browserFiles.web';
import { markdownToText, titleFromFileName } from './markdown';

export type PickResult =
  | { status: 'ok'; title: string; body: string }
  | { status: 'cancelled' }
  | { status: 'too-large' }
  | { status: 'error'; message: string };

export async function pickTextFile(): Promise<PickResult> {
  try {
    const file = await pickBrowserFile('.txt,.md,.markdown,text/plain,text/markdown');
    if (!file) return { status: 'cancelled' };
    if (file.size > LIMITS.maxBodyBytes * 4) return { status: 'too-large' };
    const raw = await file.text();
    const isMarkdown = /\.(md|markdown)$/i.test(file.name) || file.type.includes('markdown');
    const body = (isMarkdown ? markdownToText(raw) : raw).replace(/^﻿/, '').trim();
    return { status: 'ok', title: titleFromFileName(file.name), body };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
