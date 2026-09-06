import { Hono } from 'hono';
import crypto from 'node:crypto';
import { QUERY_TEMPLATES, type QueryTemplateId } from '@code-analyzer/shared';
import type { CodebaseRepo } from '../db/codebase-repo.js';
import type { UsageRepo } from '../db/usage-repo.js';
import type { ContextBlockRepo } from '../db/context-block-repo.js';
import type { AnthropicClient } from '../lib/anthropic-client.js';
import { buildContextBlock } from '../lib/context-builder.js';
import { ApiError, SchemaValidationError } from '../lib/errors.js';

export interface QueriesRouteDeps {
  repo: CodebaseRepo;
  usageRepo: UsageRepo;
  contextBlockRepo: ContextBlockRepo;
  anthropicClient: AnthropicClient;
}

export function createQueriesRoute(deps: QueriesRouteDeps): Hono {
  const route = new Hono();

  route.post('/codebases/:id/queries', async (c) => {
    const codebaseId = c.req.param('id');
    const manifest = deps.repo.getManifest(codebaseId);
    if (!manifest) {
      return c.json({ error: 'Codebase not found' }, 404);
    }

    const body = await c.req
      .json<{ query?: string; template?: QueryTemplateId }>()
      .catch(() => ({ query: undefined, template: undefined }));
    if (!body.query) {
      throw new ApiError(400, 'query is required');
    }

    const templateDef = body.template ? QUERY_TEMPLATES[body.template] : undefined;
    const outputSchema = templateDef?.outputSchema ?? 'FindingsResponse';
    const effectiveQuery = templateDef
      ? `${templateDef.promptFragment}\n\nUser request: ${body.query}`
      : body.query;

    const highSignalContents = deps.repo.getHighSignalFileContents(codebaseId);
    const contextBlock = buildContextBlock(manifest, highSignalContents);

    // Persist/refresh the cached block record; a changed content hash (from re-upload)
    // naturally produces a different block here rather than reusing a stale one.
    deps.contextBlockRepo.upsert({
      codebaseId,
      contentHash: contextBlock.contentHash,
      blockText: contextBlock.text,
    });

    try {
      const { result, usage } = await deps.anthropicClient.query({
        codebaseId,
        contextBlockText: contextBlock.text,
        userQuery: effectiveQuery,
        outputSchema,
      });

      const queryId = `q_${crypto.randomBytes(8).toString('hex')}`;
      deps.usageRepo.record(queryId, codebaseId, body.template ?? null, usage);

      const usageRecord = deps.usageRepo.getUsageRecord(codebaseId);

      return c.json({ result, usage: usageRecord }, 200);
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        return c.json({ error: 'Model output failed schema validation', details: String(err.message) }, 502);
      }
      throw err;
    }
  });

  route.get('/codebases/:id/usage', (c) => {
    const codebaseId = c.req.param('id');
    const manifest = deps.repo.getManifest(codebaseId);
    if (!manifest) {
      return c.json({ error: 'Codebase not found' }, 404);
    }
    return c.json({ usage: deps.usageRepo.getUsageRecord(codebaseId) });
  });

  return route;
}
