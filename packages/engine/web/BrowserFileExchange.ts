// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';

/** A text file explicitly chosen by the player. The name is metadata, not a filesystem path. */
export interface BrowserTextFile {
  readonly name: string;
  readonly text: string;
  readonly size: number;
  readonly type: string;
}

export interface BrowserTextFileOptions {
  /** A chooser filter, not validation of the selected bytes. */
  readonly accept?: string;
  /** Maximum number of bytes read into memory. Defaults to 16 MiB. */
  readonly maxBytes?: number;
  /** Cancel a pending chooser or read. */
  readonly signal?: AbortSignal;
}

export interface BrowserTextDownloadOptions {
  readonly mimeType?: string;
}

function requirePage(): Document {
  if (typeof document === 'undefined' || !document.body || !document.defaultView)
    throw new EgretError('BROWSER_FILE_UNAVAILABLE');
  if (document.defaultView.navigator.userActivation?.isActive === false)
    throw new EgretError('BROWSER_FILE_GESTURE_REQUIRED');
  return document;
}

/**
 * Show the platform's single-file chooser from a fresh user activation. Cancellation resolves undefined.
 * The browser supplies the file; this call cannot name or read arbitrary paths. The caller validates its content.
 */
export async function pickBrowserTextFile(options: BrowserTextFileOptions = {}): Promise<BrowserTextFile | undefined> {
  const maxBytes = options.maxBytes ?? 16 * 1024 * 1024;
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 0 ||
    (options.accept !== undefined && (typeof options.accept !== 'string' || options.accept.includes('\0')))
  )
    throw new EgretError('BROWSER_FILE_INVALID');
  if (options.signal?.aborted) return undefined;
  const doc = requirePage(),
    input = doc.createElement('input');
  input.type = 'file';
  input.accept = options.accept ?? '';
  input.hidden = true;
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  return new Promise<BrowserTextFile | undefined>((resolve, reject) => {
    let ended = false;
    const cleanup = (): void => {
      input.removeEventListener('change', chosen);
      input.removeEventListener('cancel', cancelled);
      options.signal?.removeEventListener('abort', cancelled);
      input.remove();
    };
    const finish = (file?: BrowserTextFile): void => {
      if (ended) return;
      ended = true;
      cleanup();
      resolve(file);
    };
    const fail = (cause: unknown): void => {
      if (ended) return;
      ended = true;
      cleanup();
      reject(cause);
    };
    const cancelled = (): void => finish();
    const chosen = (): void => {
      const file = input.files?.item(0);
      input.remove();
      if (!file) return finish();
      if (file.size > maxBytes) return fail(new EgretError('BROWSER_FILE_TOO_LARGE'));
      void file.text().then(text => finish({ name: file.name, text, size: file.size, type: file.type }), fail);
    };
    input.addEventListener('change', chosen, { once: true });
    input.addEventListener('cancel', cancelled, { once: true });
    options.signal?.addEventListener('abort', cancelled, { once: true });
    try {
      doc.body.append(input);
      if (typeof input.showPicker === 'function') input.showPicker();
      else input.click();
    } catch (cause) {
      fail(cause);
    }
  });
}

/**
 * Offer the caller's text as a local download from a fresh user activation.
 * Returning means the request was issued, not that the browser saved a file.
 */
export function downloadBrowserTextFile(name: string, text: string, options: BrowserTextDownloadOptions = {}): void {
  const mimeType = options.mimeType ?? 'text/plain;charset=utf-8';
  if (
    typeof name !== 'string' ||
    name === '' ||
    name === '.' ||
    name === '..' ||
    /[\\/\u0000-\u001f\u007f]/u.test(name) ||
    typeof text !== 'string' ||
    typeof mimeType !== 'string' ||
    /[\u0000-\u001f\u007f]/u.test(mimeType)
  )
    throw new EgretError('BROWSER_FILE_INVALID');
  const doc = requirePage(),
    win = doc.defaultView!,
    link = doc.createElement('a');
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  try {
    link.href = url;
    link.download = name;
    link.hidden = true;
    doc.body.append(link);
    link.click();
  } finally {
    link.remove();
    // The browser consumes the object URL asynchronously after the click.
    win.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
