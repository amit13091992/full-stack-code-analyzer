import yauzl from 'yauzl';
import fs from 'node:fs';
import path from 'node:path';
import { ApiError } from './errors.js';

export interface ExtractedFile {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
}

export interface ExtractResult {
  files: ExtractedFile[];
  skippedTraversalEntries: string[];
}

interface ExtractOptions {
  maxBytes: number;
  maxFiles: number;
}

/**
 * Extracts a zip into destDir. Zip-slip protection: every entry's resolved absolute path
 * must remain inside destDir (checked via path.relative — an entry that resolves outside
 * yields a relative path starting with ".." or being absolute, and is skipped, never written).
 */
export async function extractZip(
  zipPath: string,
  destDir: string,
  options: ExtractOptions,
): Promise<ExtractResult> {
  const files: ExtractedFile[] = [];
  const skippedTraversalEntries: string[] = [];
  let totalBytes = 0;
  let totalFiles = 0;

  await new Promise<void>((resolve, reject) => {
    // decodeStrings: false disables yauzl's own filename validation (which throws on ".."
    // segments) so that zip-slip entries reach OUR check below and get skipped, not crash
    // the whole extraction — this is the dedicated zip-slip protection path.
    yauzl.open(zipPath, { lazyEntries: true, decodeStrings: false }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error('Failed to open zip'));
        return;
      }

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        const fileName = Buffer.isBuffer(entry.fileName)
          ? entry.fileName.toString('utf-8')
          : entry.fileName;
        const isDir = /\/$/.test(fileName);

        const resolvedTarget = path.resolve(destDir, fileName);
        const relativeToDest = path.relative(destDir, resolvedTarget);
        const escapesDest =
          relativeToDest.startsWith('..') || path.isAbsolute(relativeToDest);

        if (escapesDest) {
          skippedTraversalEntries.push(fileName);
          zipfile.readEntry();
          return;
        }

        if (isDir) {
          fs.mkdirSync(resolvedTarget, { recursive: true });
          zipfile.readEntry();
          return;
        }

        totalFiles += 1;
        if (totalFiles > options.maxFiles) {
          zipfile.close();
          reject(new ApiError(413, `Upload exceeds max file count of ${options.maxFiles}`));
          return;
        }

        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            reject(streamErr ?? new Error('Failed to read entry'));
            return;
          }

          fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true });
          const writeStream = fs.createWriteStream(resolvedTarget);
          // A stream destroyed mid-write can still emit a trailing internal write-callback
          // error; swallow it here since we've already rejected the outer promise.
          writeStream.on('error', () => undefined);
          let entryBytes = 0;
          let aborted = false;

          readStream.on('data', (chunk: Buffer) => {
            if (aborted) return;
            entryBytes += chunk.length;
            totalBytes += chunk.length;
            if (totalBytes > options.maxBytes) {
              aborted = true;
              readStream.unpipe(writeStream);
              readStream.destroy();
              writeStream.destroy();
              zipfile.close();
              reject(
                new ApiError(413, `Upload exceeds max size of ${options.maxBytes} bytes`),
              );
            }
          });

          writeStream.on('finish', () => {
            if (aborted) return;
            files.push({
              relativePath: fileName,
              absolutePath: resolvedTarget,
              sizeBytes: entryBytes,
            });
            zipfile.readEntry();
          });

          readStream.pipe(writeStream);
        });
      });

      zipfile.on('end', () => resolve());
      zipfile.on('error', (zipErr) => reject(zipErr));
    });
  });

  return { files, skippedTraversalEntries };
}
