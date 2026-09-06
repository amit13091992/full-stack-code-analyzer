import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { healthRoute } from './routes/health.js';
import { createCodebasesRoute } from './routes/codebases.js';
import { createQueriesRoute } from './routes/queries.js';
import { CodebaseRepo } from './db/codebase-repo.js';
import { UsageRepo } from './db/usage-repo.js';
import { ContextBlockRepo } from './db/context-block-repo.js';
import type { Db } from './db/index.js';
import type { GitCloner } from './lib/git-clone.js';
import type { AnthropicClient } from './lib/anthropic-client.js';

export interface AppDeps {
  db: Db;
  gitCloner: GitCloner;
  anthropicClient: AnthropicClient;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  // CORS is needed because the web app (Vite dev server / preview) runs on a different
  // origin/port than the API in local dev and E2E; permissive by design since this is a
  // single-user portfolio app with no auth/cookies to protect.
  app.use('/api/*', cors());
  const repo = new CodebaseRepo(deps.db);
  const usageRepo = new UsageRepo(deps.db);
  const contextBlockRepo = new ContextBlockRepo(deps.db);

  app.onError((err, c) => {
    // eslint-disable-next-line no-console
    console.error(err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  app.route('/api', healthRoute);
  app.route('/api', createCodebasesRoute({ repo, gitCloner: deps.gitCloner }));
  app.route(
    '/api',
    createQueriesRoute({
      repo,
      usageRepo,
      contextBlockRepo,
      anthropicClient: deps.anthropicClient,
    }),
  );

  return app;
}
