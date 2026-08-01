import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('health and ping', () => {
  const app = createApp();

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/ping returns pong', async () => {
    const res = await request(app).get('/api/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'pong' });
  });

  it('protected routes require authentication', async () => {
    const res = await request(app).get('/api/lists');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('item memory search requires authentication', async () => {
    const res = await request(app).get('/api/item-memories?q=milk');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
