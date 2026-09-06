import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createDb } from './db/index.js';
import { RealGitCloner } from './lib/git-clone.js';
import { RealAnthropicClient, createDefaultMockClient } from './lib/anthropic-client.js';
import { config } from './config.js';

const db = createDb();
const anthropicClient = config.llmMock ? createDefaultMockClient() : new RealAnthropicClient();

const app = createApp({
  db,
  gitCloner: new RealGitCloner(),
  anthropicClient,
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${info.port}`);
});
