import { Hono } from 'hono';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { extractZip } from '../lib/zip-extract.js';
import { buildManifest } from '../lib/manifest-builder.js';
import { ApiError } from '../lib/errors.js';
import { config } from '../config.js';
import type { CodebaseRepo } from '../db/codebase-repo.js';
import type { GitCloner } from '../lib/git-clone.js';

export interface CodebasesRouteDeps {
  repo: CodebaseRepo;
  gitCloner: GitCloner;
}

function newCodebaseId(): string {
  return `cb_${crypto.randomBytes(8).toString('hex')}`;
}

export function createCodebasesRoute(deps: CodebasesRouteDeps): Hono {
  const route = new Hono();

  route.post('/codebases', async (c) => {
    const contentType = c.req.header('content-type') ?? '';
    const codebaseId = newCodebaseId();
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-analyzer-'));

    try {
      let sourceType: 'zip' | 'github';
      let sourceRef: string;

      if (contentType.includes('multipart/form-data')) {
        const body = await c.req.parseBody();
        const file = body['file'];
        if (!file || typeof file === 'string') {
          throw new ApiError(400, 'Missing file field in multipart upload');
        }
        const arrayBuffer = await file.arrayBuffer();
        const zipPath = path.join(workDir, 'upload.zip');
        fs.writeFileSync(zipPath, Buffer.from(arrayBuffer));

        const extractDir = path.join(workDir, 'extracted');
        fs.mkdirSync(extractDir, { recursive: true });

        let result;
        try {
          result = await extractZip(zipPath, extractDir, {
            maxBytes: config.maxUploadBytes,
            maxFiles: config.maxUploadFiles,
          });
        } catch (extractErr) {
          if (extractErr instanceof ApiError) throw extractErr;
          throw new ApiError(400, 'Uploaded file is not a valid ZIP archive');
        }

        sourceType = 'zip';
        sourceRef = file.name || 'upload.zip';

        const { manifest, highSignalFileContents } = buildManifest({
          codebaseId,
          sourceType,
          sourceRef,
          rootDir: extractDir,
          tokenBudget: config.highSignalTokenBudget,
        });

        deps.repo.save(manifest, highSignalFileContents);

        return c.json(
          {
            codebaseId,
            manifest,
            skippedTraversalEntries: result.skippedTraversalEntries,
          },
          201,
        );
      }

      const body = await c.req
        .json<{ githubUrl?: string }>()
        .catch(() => ({ githubUrl: undefined }));
      if (!body.githubUrl) {
        throw new ApiError(400, 'Request must include githubUrl or a multipart file upload');
      }

      const cloneDir = path.join(workDir, 'clone');
      await deps.gitCloner.clone(body.githubUrl, cloneDir);

      sourceType = 'github';
      sourceRef = body.githubUrl;

      const { manifest, highSignalFileContents } = buildManifest({
        codebaseId,
        sourceType,
        sourceRef,
        rootDir: cloneDir,
        tokenBudget: config.highSignalTokenBudget,
      });

      deps.repo.save(manifest, highSignalFileContents);

      return c.json({ codebaseId, manifest, skippedTraversalEntries: [] }, 201);
    } catch (err) {
      if (err instanceof ApiError) {
        return c.json({ error: err.message }, err.status as 400 | 413);
      }
      throw err;
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  route.get('/codebases/:id', (c) => {
    const id = c.req.param('id');
    const manifest = deps.repo.getManifest(id);
    if (!manifest) {
      return c.json({ error: 'Codebase not found' }, 404);
    }
    return c.json({ manifest });
  });

  route.get('/codebases/:id/files/:path{.+}', (c) => {
    const id = c.req.param('id');
    const filePath = c.req.param('path');
    const content = deps.repo.getFileContent(id, filePath);
    if (content === undefined) {
      return c.json({ error: 'File not found' }, 404);
    }
    return c.json({ path: filePath, content });
  });

  return route;
}
