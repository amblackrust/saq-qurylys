import { expect, test } from '../support/test';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('only a 401 for the current non-empty request token invokes the unauthorized handler', async ({ page }) => {
  const fetchArrived = deferred<void>();
  const releaseFetch = deferred<void>();
  const uploadArrived = deferred<void>();
  const releaseUpload = deferred<void>();
  const anonymousArrived = deferred<void>();
  const releaseAnonymous = deferred<void>();
  const authorizations: Record<string, string | null> = {};

  await page.goto('/login');
  await page.route('**/api/v1/stale-fetch', async (route) => {
    authorizations.fetch = route.request().headers().authorization ?? null;
    fetchArrived.resolve();
    await releaseFetch.promise;
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Unauthenticated' }) });
  });
  await page.route('**/api/v1/stale-upload', async (route) => {
    authorizations.upload = route.request().headers().authorization ?? null;
    uploadArrived.resolve();
    await releaseUpload.promise;
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Unauthenticated' }) });
  });
  await page.route('**/api/v1/anonymous-401', async (route) => {
    authorizations.anonymous = route.request().headers().authorization ?? null;
    anonymousArrived.resolve();
    await releaseAnonymous.promise;
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Unauthenticated' }) });
  });
  await page.route('**/api/v1/current-401', async (route) => {
    authorizations.current = route.request().headers().authorization ?? null;
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Unauthenticated' }) });
  });

  await page.evaluate(async () => {
    type Client = {
      api: (path: string) => Promise<unknown>;
      apiUpload: (path: string, form: FormData) => Promise<unknown>;
      getToken: () => string | null;
      setToken: (token: string | null) => void;
      setUnauthorizedHandler: (handler: (() => void) | null) => void;
    };
    type BrowserTestState = {
      client?: Client;
      unauthorizedCalls: number;
      results: Record<string, Promise<number>>;
    };
    const moduleUrl = String('/src/api/client.ts');
    const client = (await import(moduleUrl)) as Client;
    const browserWindow = window as Window & { __client401Test?: BrowserTestState };
    const state: BrowserTestState = { unauthorizedCalls: 0, results: {} };
    state.client = client;
    browserWindow.__client401Test = state;
    client.setUnauthorizedHandler(() => state.unauthorizedCalls++);
    const status = (promise: Promise<unknown>) => promise.then(() => 0, (error: unknown) => (error as { status?: number }).status ?? 0);

    client.setToken('fetch-old-token');
    state.results.fetch = status(client.api('/stale-fetch'));
    client.setToken('fetch-new-token');

    client.setToken('upload-old-token');
    state.results.upload = status(client.apiUpload('/stale-upload', new FormData()));
    client.setToken('upload-new-token');

    client.setToken(null);
    state.results.anonymous = status(client.api('/anonymous-401'));
    client.setToken('anonymous-new-token');

    client.setToken('current-token');
    state.results.current = status(client.api('/current-401'));
  });

  await Promise.all([fetchArrived.promise, uploadArrived.promise, anonymousArrived.promise]);
  releaseFetch.resolve();
  releaseUpload.resolve();
  releaseAnonymous.resolve();

  const result = await page.evaluate(async () => {
    type BrowserTestState = {
      client: { getToken: () => string | null };
      unauthorizedCalls: number;
      results: Record<string, Promise<number>>;
    };
    const state = (window as Window & { __client401Test?: BrowserTestState }).__client401Test;
    if (!state) throw new Error('Missing 401 test state');
    return {
      statuses: await Promise.all(Object.entries(state.results).map(async ([key, value]) => [key, await value] as const)),
      token: state.client.getToken(),
      unauthorizedCalls: state.unauthorizedCalls,
    };
  });

  expect(result.statuses).toEqual([
    ['fetch', 401],
    ['upload', 401],
    ['anonymous', 401],
    ['current', 401],
  ]);
  expect(authorizations).toEqual({
    fetch: 'Bearer fetch-old-token',
    upload: 'Bearer upload-old-token',
    anonymous: null,
    current: 'Bearer current-token',
  });
  expect(result.token).toBe('current-token');
  expect(result.unauthorizedCalls).toBe(1);
});
