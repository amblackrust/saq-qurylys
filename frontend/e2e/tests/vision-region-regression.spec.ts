import type { Page, Route } from '@playwright/test';
import type { Territory, VisionFinding, VisionSessionDetail } from '../../src/api/types';
import { expect, test } from '../support/test';
import { t } from '../support/i18n';
import { choose } from '../support/ui';

const REGION_ID = 41;
const CITY_ID = 42;
const SESSION_ID = 43;
const FINDING_ID = 44;
const OBJECT_ID = 45;

const city: Territory = {
  id: CITY_ID,
  parent_id: REGION_ID,
  level: 'city',
  code: 'CITY-42',
  name: 'Астана',
  timezone: 'Asia/Almaty',
  center_lat: null,
  center_lon: null,
  children: [],
};

const region: Territory = {
  id: REGION_ID,
  parent_id: null,
  level: 'region',
  code: 'REGION-41',
  name: 'Акмолинская область',
  timezone: 'Asia/Almaty',
  center_lat: null,
  center_lon: null,
  children: [city],
};

const object = { id: OBJECT_ID, code: 'D-45', name: 'ЖК Северный бриз' };

function makeFinding(adPostId: number | null): VisionFinding {
  return {
    id: FINDING_ID,
    session_id: SESSION_ID,
    frame_id: null,
    bbox: null,
    category: 'outdoor_ad',
    status: 'observed',
    origin: 'manual',
    confidence: null,
    model_version: null,
    note: null,
    review_state: 'confirmed',
    ocr_status: null,
    ocr_text: null,
    ocr_confidence: null,
    ocr_engine: null,
    confirmed_text: 'ЖК Северный бриз — квартиры в продаже',
    run_id: null,
    ad_post_id: adPostId,
    created_at: '2026-10-20T09:00:00Z',
    created_by_name: 'Сотрудник',
    reviews: [],
  };
}

function makeSession({ published = false }: { published?: boolean } = {}): VisionSessionDetail {
  const finding = makeFinding(published ? 901 : null);
  return {
    id: SESSION_ID,
    object: null,
    territory_id: REGION_ID,
    source: 'drone',
    captured_at: null,
    status: 'open',
    is_demo: false,
    note: null,
    created_at: '2026-10-20T08:00:00Z',
    created_by_name: 'Сотрудник',
    reviewed_at: null,
    reviewed_by_name: null,
    assets_count: 0,
    frames_count: 0,
    findings_count: 1,
    processing: false,
    failed: false,
    assets: [],
    findings: [finding],
    runs: [],
  };
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installMocks(page: Page, initialSession: VisionSessionDetail | null) {
  const mutations: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];
  const objectQueries: URL[] = [];
  let session = initialSession;

  await page.addInitScript(() => {
    localStorage.setItem('saq_token', 'mock-vision-region');
    localStorage.setItem('saq_lang', 'ru');
  });

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = request.method();
    const body = request.postData() ? (request.postDataJSON() as Record<string, unknown>) : {};

    if (method !== 'GET') mutations.push({ method, path, body });

    if (method === 'GET' && path === '/auth/me') {
      return json(route, {
        id: 7,
        username: 'regional-inspector',
        full_name: 'Региональный инспектор',
        role: 'mio_officer',
        territory_id: REGION_ID,
        locale: 'ru',
      });
    }
    if (method === 'GET' && path === '/assistant/config') return json(route, { enabled: false });
    if (method === 'GET' && path === '/vision/config') {
      return json(route, {
        enabled: true,
        detector_mode: 'disabled',
        detector_model: null,
        ocr_enabled: false,
        max_photo_mb: 20,
        max_video_mb: 200,
        max_duration_seconds: 600,
      });
    }
    if (method === 'GET' && path === '/territories') return json(route, [region]);
    if (method === 'GET' && path === '/notifications') return json(route, { items: [] });
    if (method === 'GET' && path === '/activity') return json(route, { items: [], cursor: null, reset: false });
    if (method === 'GET' && path === '/settings') {
      return json(route, {
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
        green_interval_days: 90,
        yellow_interval_days: 30,
        recipient_emails: { mio: [], gask: [], law_enforcement: [] },
      });
    }
    if (method === 'GET' && path === '/objects') {
      objectQueries.push(url);
      return json(route, { items: [object], total: 1 });
    }
    if (method === 'GET' && path === '/vision/sessions') {
      return json(route, { items: session ? [session] : [], total: session ? 1 : 0 });
    }
    if (method === 'POST' && path === '/vision/sessions') {
      session = {
        ...makeSession(),
        id: SESSION_ID,
        territory_id: Number(body.territory_id),
        findings: [],
        findings_count: 0,
      };
      return json(route, session, 201);
    }
    if (method === 'GET' && path === `/vision/sessions/${SESSION_ID}` && session) return json(route, session);
    if (method === 'GET' && path === `/vision/sessions/${SESSION_ID}/frames`) return json(route, { items: [], total: 0 });
    if (method === 'PATCH' && path === `/vision/sessions/${SESSION_ID}` && session) {
      if (body.territory_id !== undefined) session.territory_id = Number(body.territory_id);
      if (body.object_id !== undefined) {
        session.object = body.object_id === null ? null : { ...object };
      }
      return json(route, session);
    }
    if (method === 'POST' && path === `/vision/findings/${FINDING_ID}/publish-ad` && session) {
      session.findings[0].ad_post_id = 902;
      return json(route, { ad_id: 902 }, 201);
    }

    return json(route, { detail: `No fixture for ${method} ${path}` }, 404);
  });

  return { mutations, objectQueries, getSession: () => session };
}

test('region staff must choose a city when creating a session without an object', async ({ page }) => {
  const fixture = await installMocks(page, null);

  await page.goto('/vision');
  await page.getByRole('button', { name: t('vision:create'), exact: true }).click();
  const dialog = page.getByRole('dialog', { name: t('vision:new.title'), exact: true });
  const citySelect = dialog.getByRole('combobox', { name: t('vision:new.territory'), exact: true });

  await expect(citySelect).toBeVisible();
  await expect(dialog.getByRole('button', { name: t('vision:new.submit'), exact: true })).toBeDisabled();
  await choose(page, citySelect, city.name);
  await dialog.getByRole('button', { name: t('vision:new.submit'), exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/vision/${SESSION_ID}$`));
  const create = fixture.mutations.find(({ method, path }) => method === 'POST' && path === '/vision/sessions');
  expect(create?.body).toMatchObject({ object_id: null, territory_id: CITY_ID });
  expect(create?.body.territory_id).not.toBe(REGION_ID);
});

test('legacy region sessions can be refined before publishing an outdoor ad', async ({ page }) => {
  const fixture = await installMocks(page, makeSession());

  await page.goto(`/vision/${SESSION_ID}`);
  const citySelect = page.getByRole('combobox', { name: t('vision:territoryRefinement.city'), exact: true });
  const publishButton = page.getByRole('button', { name: t('vision:publish.create'), exact: true });

  await expect(citySelect).toBeVisible();
  await expect(publishButton).toBeDisabled();
  await expect(page.getByText(t('vision:publish.cityRequired'), { exact: true })).toBeVisible();
  await choose(page, citySelect, city.name);
  await page.getByRole('button', { name: t('vision:territoryRefinement.save'), exact: true }).click();

  await expect(citySelect).toHaveCount(0);
  expect(fixture.mutations.find(({ method, path }) => method === 'PATCH' && path === `/vision/sessions/${SESSION_ID}`)?.body).toEqual({ territory_id: CITY_ID });
  await expect.poll(() => fixture.getSession()?.territory_id).toBe(CITY_ID);

  const adText = page.getByRole('textbox', { name: t('vision:publish.text'), exact: true });
  const adObject = page.getByRole('combobox', { name: t('vision:publish.object'), exact: true });
  await adText.fill('ЖК Северный бриз — квартиры в продаже');
  await adObject.fill('Северный');
  await expect
    .poll(() => fixture.objectQueries.some((query) => query.searchParams.get('q') === 'Северный' && query.searchParams.get('territory_id') === String(CITY_ID)))
    .toBe(true);
  await page.getByRole('option', { name: /D-45 · ЖК Северный бриз/ }).click();
  await expect(publishButton).toBeEnabled();
  await publishButton.click();

  const publish = fixture.mutations.find(({ method, path }) => method === 'POST' && path === `/vision/findings/${FINDING_ID}/publish-ad`);
  expect(publish?.body).toEqual({ text: 'ЖК Северный бриз — квартиры в продаже', object_id: OBJECT_ID });
});

test('a legacy region session with an existing ad cannot be refined', async ({ page }) => {
  const fixture = await installMocks(page, makeSession({ published: true }));

  await page.goto(`/vision/${SESSION_ID}`);
  await expect(page.getByText(t('vision:territoryRefinement.hasPublishedAds'), { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: t('vision:territoryRefinement.city'), exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: t('vision:territoryRefinement.save'), exact: true })).toBeDisabled();
  await expect(page.getByRole('link', { name: t('vision:publish.open', { id: 901 }), exact: true })).toBeVisible();
  expect(fixture.mutations.filter(({ method, path }) => method === 'PATCH' && path === `/vision/sessions/${SESSION_ID}`)).toHaveLength(0);
});
