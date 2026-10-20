import { expect, test } from '../support/test';
import { t } from '../support/i18n';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const sessions = {
  'account-a': {
    access_token: 'token-a',
    token_type: 'bearer',
    user: { id: 1, username: 'account-a', full_name: 'Account A', role: 'mio_officer', territory_id: null, locale: 'ru' },
  },
  'account-b': {
    access_token: 'token-b',
    token_type: 'bearer',
    user: { id: 2, username: 'account-b', full_name: 'Account B', role: 'mio_officer', territory_id: null, locale: 'ru' },
  },
};

for (const oldLogoutStatus of [204, 401, 500]) {
  test(`a completed old logout preserves the newer session after ${oldLogoutStatus}`, async ({ page }) => {
    const staleRequestArrived = deferred<void>();
    const releaseStaleRequest = deferred<void>();
    const oldLogoutArrived = deferred<void>();
    const releaseOldLogout = deferred<void>();

    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace('/api/v1', '');
      const authorization = request.headers().authorization;

      if (path === '/auth/login') {
        const { username } = request.postDataJSON() as { username: keyof typeof sessions };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessions[username]) });
        return;
      }

      if (path === '/auth/me') {
        const session = authorization === 'Bearer token-b' ? sessions['account-b'] : sessions['account-a'];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) });
        return;
      }

      if (path === '/logout-regression-stale') {
        staleRequestArrived.resolve();
        await releaseStaleRequest.promise;
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Unauthenticated' }) });
        return;
      }

      if (path === '/auth/logout' && authorization === 'Bearer token-a') {
        oldLogoutArrived.resolve();
        await releaseOldLogout.promise;
        if (oldLogoutStatus === 204) {
          await route.fulfill({ status: 204 });
        } else {
          await route.fulfill({ status: oldLogoutStatus, contentType: 'application/json', body: JSON.stringify({ detail: 'Logout failed' }) });
        }
        return;
      }

      if (path === '/auth/logout' && authorization === 'Bearer token-b') {
        await route.fulfill({ status: 204 });
        return;
      }

      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
    });

    const login = async (username: keyof typeof sessions) => {
      await page.getByLabel(t('auth.username'), { exact: true }).fill(username);
      await page.getByLabel(t('auth.password'), { exact: true }).fill('password');
      await page.getByRole('button', { name: t('auth.login'), exact: true }).click();
      await expect(page.getByTestId('header-user-trigger')).toBeVisible();
    };

    await page.goto('/login');
    await login('account-a');

    const staleRequestResult = page.evaluate(async () => {
      const moduleUrl = String('/src/api/client.ts');
      const client = (await import(moduleUrl)) as { api: (path: string) => Promise<unknown> };
      try {
        await client.api('/logout-regression-stale');
        return 0;
      } catch (error) {
        return (error as { status?: number }).status ?? 0;
      }
    });
    await staleRequestArrived.promise;

    await page.getByTestId('header-user-trigger').click();
    await page.getByTestId('profile-logout-item').click();
    await oldLogoutArrived.promise;

    releaseStaleRequest.resolve();
    expect(await staleRequestResult).toBe(401);
    await expect(page).toHaveURL(/\/login$/);

    await login('account-b');
    const readSession = () =>
      page.evaluate(async () => {
        const clientUrl = String('/src/api/client.ts');
        const queryClientUrl = String('/src/api/queryClient.ts');
        const keysUrl = String('/src/api/keys.ts');
        const [client, queries, keys] = await Promise.all([
          import(clientUrl) as Promise<{ getToken: () => string | null }>,
          import(queryClientUrl) as Promise<{ queryClient: { getQueryData: (key: readonly unknown[]) => unknown } }>,
          import(keysUrl) as Promise<{ qk: { me: readonly unknown[] } }>,
        ]);
        return {
          token: client.getToken(),
          user: queries.queryClient.getQueryData(keys.qk.me) as { username?: string } | undefined,
        };
      });

    const sessionBeforeOldLogoutFinishes = await readSession();
    expect(sessionBeforeOldLogoutFinishes.token).toBe('token-b');
    expect(sessionBeforeOldLogoutFinishes.user).toMatchObject({ username: 'account-b' });

    await page.getByTestId('header-user-trigger').click();
    await expect(page.getByText('Account B', { exact: true })).toBeVisible();

    const oldLogoutResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/auth/logout') &&
        response.request().headers().authorization === 'Bearer token-a',
    );
    releaseOldLogout.resolve();
    await oldLogoutResponse;
    await page.waitForLoadState('networkidle');

    expect(await readSession()).toMatchObject({ token: 'token-b', user: { username: 'account-b' } });
    await expect(page.getByTestId('header-user-trigger')).toBeVisible();
    await expect(page.getByText('Account B', { exact: true })).toBeVisible();

    await page.getByTestId('profile-logout-item').click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel(t('auth.username'), { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('saq_token'))).toBeNull();
  });
}

test('an old logout does not clear a token replaced in another tab', async ({ page }) => {
  const oldLogoutArrived = deferred<void>();
  const releaseOldLogout = deferred<void>();

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const authorization = request.headers().authorization;

    if (path === '/auth/login') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessions['account-a']) });
      return;
    }

    if (path === '/auth/me') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessions['account-a'].user) });
      return;
    }

    if (path === '/auth/logout' && authorization === 'Bearer token-a') {
      oldLogoutArrived.resolve();
      await releaseOldLogout.promise;
      await route.fulfill({ status: 204 });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
  });

  await page.goto('/login');
  await page.getByLabel(t('auth.username'), { exact: true }).fill('account-a');
  await page.getByLabel(t('auth.password'), { exact: true }).fill('password');
  await page.getByRole('button', { name: t('auth.login'), exact: true }).click();
  await expect(page.getByTestId('header-user-trigger')).toBeVisible();
  await page.getByTestId('header-user-trigger').click();
  await page.getByTestId('profile-logout-item').click();
  await oldLogoutArrived.promise;

  await page.evaluate(() => localStorage.setItem('saq_token', 'token-from-another-tab'));
  const oldLogoutResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith('/auth/logout') &&
      response.request().headers().authorization === 'Bearer token-a',
  );
  releaseOldLogout.resolve();
  await oldLogoutResponse;
  await page.waitForLoadState('networkidle');

  expect(await page.evaluate(() => localStorage.getItem('saq_token'))).toBe('token-from-another-tab');
});
