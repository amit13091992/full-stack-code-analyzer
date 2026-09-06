import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { healthRoute } from './health.js';

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const app = new Hono();
    app.route('/api', healthRoute);
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
