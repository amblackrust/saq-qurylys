import { expect, test } from '../support/test';
import { t } from '../support/i18n';
import type { Page, Route } from '@playwright/test';
import type { Assignment, AssignmentCreate, ObjectDetail, User } from '../../src/api/types';

const territoryToday = '2026-10-20';
const assigneeName = 'Сотрудник МИО';

const user: User = {
  id: 1,
  username: 'mock_mio_officer',
  full_name: assigneeName,
  role: 'mio_officer',
  territory_id: 1,
  locale: 'ru',
};

const object: ObjectDetail = {
  id: 7,
  code: 'D-07',
  territory_id: 3,
  district_id: null,
  district_name: 'Учебный район',
  developer_id: null,
  name: 'ЖК Северный бриз',
  aliases: [],
  address: null,
  cadastral_number: null,
  land_purpose: null,
  lat: 51.15,
  lon: 71.42,
  planned_completion: null,
  forecast_completion: null,
  construction_status: 'active',
  stalled_since: null,
  readiness_actual_pct: 30,
  readiness_claimed_pct: null,
  prior_violations: null,
  score: 42,
  zone: 'yellow',
  key_status: 'active_ads',
  key_status_detail: null,
  last_scored_at: '2026-10-15T10:00:00Z',
  next_check_at: null,
  is_demo: false,
  developer: null,
  documents: [],
  inspections: [],
  complaints: [],
  linked_entities: [],
  ads_7d_count: 0,
  readiness_gap_pp: null,
  latest_score: {
    score: 42,
    zone: 'yellow',
    zone_reasons: [],
    breakdown: { factors: [], needs_check: [], legal_basis_status: 'confirmed' },
    calculated_at: '2026-10-15T10:00:00Z',
    trigger: 'event',
  },
};

const settings = {
  review_days: 10,
  ad_window_days: 90,
  readiness_gap_pp: 20,
  significant_delay_days: 90,
  zone_yellow_min: 25,
  zone_red_min: 60,
  complaints_threshold: 3,
  stalled_days: 180,
  recheck_after_days: 90,
  link_confidence_threshold: 0.7,
  recipient_emails: { mio: [], gask: [], law_enforcement: [] },
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installMocks(page: Page, territoryLookupFails = false): Promise<AssignmentCreate[]> {
  const posts: AssignmentCreate[] = [];
  await page.addInitScript(() => {
    localStorage.setItem('saq_token', 'mock-assignment-timezone-session');
    localStorage.setItem('saq_lang', 'ru');
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = request.method();

    if (method === 'GET' && path === '/auth/me') return json(route, user);
    if (method === 'GET' && path === '/notifications') return json(route, { items: [] });
    if (method === 'GET' && path === '/activity') {
      return json(route, { items: [], cursor: 'mock-cursor', reset: false });
    }
    if (method === 'GET' && path === '/settings') return json(route, settings);
    if (method === 'GET' && path === '/territories') {
      if (territoryLookupFails) {
        return json(route, { detail: { code: 'server_error', message: 'Territories are unavailable' } }, 500);
      }
      return json(route, [
        {
          id: 1,
          parent_id: null,
          level: 'region',
          code: 'user-region',
          name: 'Территория пользователя',
          timezone: 'Pacific/Kiritimati',
          center_lat: null,
          center_lon: null,
          children: [
            {
              id: 3,
              parent_id: 1,
              level: 'city',
              code: 'object-city',
              name: 'Город объекта',
              timezone: 'Asia/Almaty',
              center_lat: null,
              center_lon: null,
              children: [],
            },
          ],
        },
      ]);
    }
    if (method === 'GET' && path === '/objects/7') return json(route, object);
    if (method === 'GET' && path === '/objects/7/assignments') return json(route, []);
    if (method === 'GET' && path === '/assignments/assignees') {
      return json(route, [{ id: 5, full_name: assigneeName, role: 'mio_officer' }]);
    }
    if (method === 'GET' && path === '/signals') return json(route, { items: [], total: 0 });
    if (method === 'POST' && path === '/objects/7/assignments') {
      const input = request.postDataJSON() as AssignmentCreate;
      posts.push(input);
      if (input.due_date < territoryToday) {
        return json(route, { detail: { code: 'due_date_in_past', message: 'Срок не может быть в прошлом' } }, 422);
      }
      const created: Assignment = {
        id: 62,
        object: { id: object.id, name: object.name, code: object.code, zone: object.zone },
        author_id: user.id,
        author_name: user.full_name,
        assignee_id: input.assignee_id,
        assignee_name: assigneeName,
        task: input.task,
        due_date: input.due_date,
        status: 'open',
        is_overdue: false,
        days_overdue: 0,
        result: null,
        completed_at: null,
        created_at: '2026-10-20T12:00:00Z',
      };
      return json(route, created, 201);
    }
    return json(route, { detail: { code: 'not_found', message: 'Fixture route not found' } }, 404);
  });
  return posts;
}

async function openAssignmentForm(page: Page, now: string, territoryLookupFails = false): Promise<AssignmentCreate[]> {
  await page.clock.install({ time: new Date(now) });
  const posts = await installMocks(page, territoryLookupFails);
  await page.goto('/objects/7#assignments');

  await page.getByRole('button', { name: t('assignments:section.add') }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: t('assignments:form.assignee') }).click();
  await page.getByRole('option', { name: assigneeName, exact: true }).click();
  return posts;
}

for (const scenario of [
  { name: 'browser date is behind the object date', timezoneId: 'Pacific/Honolulu', now: '2026-10-19T20:00:00.000Z' },
  { name: 'browser date is ahead of the object date', timezoneId: 'Pacific/Kiritimati', now: '2026-10-20T18:00:00.000Z' },
]) {
  test.describe(scenario.name, () => {
    test.use({ timezoneId: scenario.timezoneId });

    test('uses the object city date for the due date field and request', async ({ page }) => {
      const posts = await openAssignmentForm(page, scenario.now);
      const dialog = page.getByRole('dialog');
      const dueDate = dialog.getByLabel(t('assignments:form.due'));

      if (scenario.timezoneId === 'Pacific/Honolulu') {
        await dueDate.fill('19.10.2026');
        await dialog.getByRole('button', { name: t('assignments:form.submit') }).click();
        expect(posts).toHaveLength(0);
      }

      await dueDate.fill('20.10.2026');
      await dueDate.blur();
      await expect(dueDate).toHaveValue('20.10.2026');
      await dialog.getByRole('button', { name: t('assignments:form.submit') }).click();

      await expect.poll(() => posts.length).toBe(1);
      expect(posts.map((post) => post.due_date)).toEqual([territoryToday]);
    });
  });
}

test.describe('when the territory calendar date is unavailable', () => {
  test('can retry the territory lookup and submit an assignment while it keeps failing', async ({ page }) => {
    const posts = await openAssignmentForm(page, '2026-10-20T12:00:00.000Z', true);
    const dialog = page.getByRole('dialog');
    const dueDate = dialog.getByLabel(t('assignments:form.due'));

    await expect(dialog.getByText(t('assignments:form.territoryDateUnavailable'))).toBeVisible();
    await expect(dueDate).toBeEnabled();

    const retry = dialog.getByRole('button', { name: t('common:retry') });
    const retryResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.url().endsWith('/api/v1/territories') &&
        response.status() === 500,
    );
    await retry.click();
    await retryResponse;

    await dueDate.fill('21.10.2026');
    await dialog.getByLabel(t('assignments:form.task')).fill('Проверить сведения по объекту');
    await dialog.getByRole('button', { name: t('assignments:form.submit') }).click();

    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({ assignee_id: 5, due_date: '2026-10-21', task: 'Проверить сведения по объекту' });
    await expect(dialog).toBeHidden();
  });

  test('shows a server past-date rejection on the field and allows correction and retry', async ({ page }) => {
    const posts = await openAssignmentForm(page, '2026-10-20T12:00:00.000Z', true);
    const dialog = page.getByRole('dialog');
    const dueDate = dialog.getByLabel(t('assignments:form.due'));

    await dueDate.fill('19.10.2026');
    await dialog.getByRole('button', { name: t('assignments:form.submit') }).click();

    await expect.poll(() => posts.length).toBe(1);
    await expect(dialog.getByText(t('assignments:form.pastDate'))).toBeVisible();
    expect(posts[0].due_date).toBe('2026-10-19');

    await dueDate.fill('21.10.2026');
    await expect(dialog.getByText(t('assignments:form.pastDate'))).toBeHidden();
    await dialog.getByRole('button', { name: t('assignments:form.submit') }).click();

    await expect.poll(() => posts.length).toBe(2);
    expect(posts[1].due_date).toBe('2026-10-21');
    await expect(dialog).toBeHidden();
  });
});
