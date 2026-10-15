import { delay } from 'msw';
import { http, HttpResponse } from 'msw/http';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthStore } from '@/stores/auth-store';
import type { UserProfile } from '@/types';
import { createApiClient } from './api-client';
import { ApiError } from './error';

const BASE = 'http://api.test/api/v1';
const USER: UserProfile = {
  id: '11111111-1111-4111-8111-111111111111',
  employeeCode: 'EMP001',
  name: 'Budi Santoso',
  email: 'budi@absenyok.id',
  role: 'EMPLOYEE',
  hasBoundDevice: false,
};

const errorBody = (code: string, message: string) => ({
  success: false,
  error: { code, message },
  path: '/api/v1/x',
  timestamp: new Date().toISOString(),
});

let refreshCalls = 0;
let refreshMode: 'ok' | 'reject' | 'offline' | 'server-error' = 'ok';

const server = setupServer(
  http.post(`${BASE}/auth/refresh`, async () => {
    refreshCalls += 1;
    await delay(50); // cukup lama agar request paralel lain menumpuk di tengah refresh
    if (refreshMode === 'offline') return HttpResponse.error();
    if (refreshMode === 'server-error') return new HttpResponse('Bad Gateway', { status: 502 });
    if (refreshMode === 'reject') {
      return HttpResponse.json(errorBody('TOKEN_INVALID', 'Token tidak valid'), { status: 401 });
    }
    return HttpResponse.json({
      success: true,
      data: { accessToken: 'token-baru', expiresIn: 900, user: USER },
    });
  }),
  // Hanya menerima token baru; token lama → 401 TOKEN_EXPIRED.
  http.get(`${BASE}/items/:id`, ({ request, params }) => {
    if (request.headers.get('Authorization') !== 'Bearer token-baru') {
      return HttpResponse.json(errorBody('TOKEN_EXPIRED', 'Sesi berakhir'), { status: 401 });
    }
    return HttpResponse.json({ success: true, data: { id: params.id } });
  }),
  http.get(`${BASE}/always-expired`, () =>
    HttpResponse.json(errorBody('TOKEN_EXPIRED', 'Sesi berakhir'), { status: 401 }),
  ),
  http.get(`${BASE}/forbidden`, () =>
    HttpResponse.json(errorBody('TOKEN_INVALID', 'Token tidak valid'), { status: 401 }),
  ),
  http.get(`${BASE}/users`, () =>
    HttpResponse.json({
      success: true,
      data: [{ id: 'a' }, { id: 'b' }],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    }),
  ),
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json(
      errorBody('ACCOUNT_LOCKED', 'Akun dikunci sementara, coba lagi dalam 15 menit'),
      { status: 423 },
    ),
  ),
  http.get(`${BASE}/broken`, () => new HttpResponse('<html>Bad Gateway</html>', { status: 502 })),
  http.get(`${BASE}/offline`, () => HttpResponse.error()),
);

function setup() {
  const store = createAuthStore();
  store.getState().setSession({ accessToken: 'token-lama', user: USER });
  const client = createApiClient({ baseURL: BASE, store });
  const onExpired = vi.fn();
  client.setSessionExpiredHandler(onExpired);
  return { store, client, onExpired };
}

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  refreshCalls = 0;
  refreshMode = 'ok';
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('api-client: refresh token otomatis', () => {
  it('5 request paralel dengan token kedaluwarsa → hanya 1 panggilan /auth/refresh', async () => {
    const { client, store } = setup();

    const results = await Promise.all(
      ['1', '2', '3', '4', '5'].map((id) => client.get<{ id: string }>(`/items/${id}`)),
    );

    expect(refreshCalls).toBe(1);
    expect(results.map((item) => item.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(store.getState()).toMatchObject({ accessToken: 'token-baru', status: 'authenticated' });
  });

  it('request berikutnya memakai token baru tanpa refresh lagi', async () => {
    const { client } = setup();
    await client.get('/items/1');
    await client.get('/items/2');
    expect(refreshCalls).toBe(1);
  });

  it('refresh ditolak → semua request gagal, sesi dihapus, redirect login dipanggil sekali', async () => {
    refreshMode = 'reject';
    const { client, store, onExpired } = setup();

    const results = await Promise.allSettled(
      ['1', '2', '3', '4', '5'].map((id) => client.get(`/items/${id}`)),
    );

    expect(refreshCalls).toBe(1);
    for (const result of results) {
      expect(result.status).toBe('rejected');
      expect((result as PromiseRejectedResult).reason).toMatchObject({ code: 'TOKEN_INVALID' });
    }
    expect(store.getState()).toMatchObject({
      accessToken: null,
      user: null,
      status: 'unauthenticated',
    });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('refresh gagal karena offline → sesi TIDAK dihapus (bisa dicoba lagi)', async () => {
    refreshMode = 'offline';
    const { client, store, onExpired } = setup();

    await expect(client.get('/items/1')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
    expect(store.getState().accessToken).toBe('token-lama');
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('refresh gagal 5xx (backend mati di balik proxy) → sesi TIDAK dihapus', async () => {
    refreshMode = 'server-error';
    const { client, store, onExpired } = setup();
    await expect(client.get('/items/1')).rejects.toMatchObject({ status: 502 });
    expect(store.getState().accessToken).toBe('token-lama');
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('request yang masih 401 setelah refresh tidak memicu refresh berulang (anti-loop)', async () => {
    const { client } = setup();
    await expect(client.get('/always-expired')).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
    expect(refreshCalls).toBe(1);
  });

  it('401 selain TOKEN_EXPIRED tidak memicu refresh', async () => {
    const { client } = setup();
    await expect(client.get('/forbidden')).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
    expect(refreshCalls).toBe(0);
  });

  it('refreshSession() bersamaan (mis. StrictMode/bootstrap) → tetap 1 panggilan', async () => {
    const { client } = setup();
    const sessions = await Promise.all([client.refreshSession(), client.refreshSession()]);
    expect(refreshCalls).toBe(1);
    expect(sessions[0]).toBe(sessions[1]);
  });
});

describe('api-client: unwrap & error', () => {
  it('unwrap otomatis `data`, listing menyediakan `meta`', async () => {
    const { client } = setup();
    await expect(client.page<{ id: string }>('/users')).resolves.toEqual({
      items: [{ id: 'a' }, { id: 'b' }],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
  });

  it('error backend → ApiError { code, message, status } (login: ACCOUNT_LOCKED)', async () => {
    const { client } = setup();
    const error = await client.post('/auth/login', {}).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'ACCOUNT_LOCKED',
      status: 423,
      message: 'Akun dikunci sementara, coba lagi dalam 15 menit',
    });
    expect(refreshCalls).toBe(0);
  });

  it('respons bukan format standar & error jaringan → pesan Bahasa Indonesia', async () => {
    const { client } = setup();
    await expect(client.get('/broken')).rejects.toMatchObject({ code: 'HTTP_502', status: 502 });
    await expect(client.get('/offline')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
    });
  });

  it('header Authorization disisipkan dari store', async () => {
    const { client, store } = setup();
    store.getState().setSession({ accessToken: 'token-baru', user: USER });
    await expect(client.get('/items/9')).resolves.toEqual({ id: '9' });
    expect(refreshCalls).toBe(0);
  });
});
