import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '../support/test';
import { t, tKk } from '../support/i18n';
import type { Page, Route } from '@playwright/test';
import type { ActivityEvent, AdDetail, AdReviewState, Assignment, Assignee, EvidenceMeta, LinkGraph, ObjectDetail, ObjectDocument, Role, SearchResults, SignalDetail, SignalMaterials, SignalRecipient, SignalStatus, Territory, User, VisionAsset, VisionFinding, VisionFrame, VisionSessionDetail } from '../../src/api/types';

const screenshotDir = '/tmp/ayqyn-polish/after';
const objectRow = {
  id: 7,
  code: 'D-07',
  name: 'ЖК Северный бриз',
  developer_name: 'ТОО Северстрой',
  score: 42,
  zone: 'yellow' as const,
  key_status: 'active_ads' as const,
  key_status_detail: null,
  district_name: 'Алматы ауданы',
  lat: 51.15,
  lon: 71.42,
  is_demo: false,
};

const cityTerritory: Territory = {
  id: 9,
  parent_id: null,
  level: 'city',
  code: 'fixture-city',
  name: 'Город fixture',
  timezone: 'Asia/Almaty',
  center_lat: null,
  center_lon: null,
  children: [],
};

const dashboard = {
  counts: { green: 0, yellow: 1, red: 1, unscored: 0, total: 2 },
  last_updated_at: '2026-10-15T10:00:00Z',
  objects: [
    { ...objectRow, id: 9, code: 'D-09', name: 'ЖК Радужный парк', score: 72, zone: 'red' as const },
    { ...objectRow, id: 7, code: 'D-07', name: 'ЖК Северный бриз', score: 42, zone: 'yellow' as const },
  ],
};
const searchFixture: SearchResults = {
  objects: [{ id: 7, name: objectRow.name, code: objectRow.code, address: 'ул. Примерная, 1', zone: 'yellow', developer_name: 'ТОО Северстрой', match: 'name' }],
  developers: [
    { id: 3, name: 'ТОО Северстрой', bin: '000000000001', object_id: 7 },
    { id: 4, name: 'ТОО Без объектов', bin: '000000000002', object_id: null },
  ],
  signals: [{ id: 42, number: 'SIG-2026-0042', object_name: objectRow.name, status: 'requires_confirmation' }],
};
const settingsFixture = {
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
};

const graphFixture: LinkGraph = {
  nodes: [
    { id: 'developer:3', type: 'developer', label: 'ТОО Северстрой', ref_id: 3, zone: null, is_demo: false, platform: null },
    { id: 'object:7', type: 'object', label: 'ЖК Северный бриз', ref_id: 7, zone: 'yellow', is_demo: false, platform: null },
    { id: 'phone:+77001234567', type: 'phone', label: '+77001234567', ref_id: null, zone: null, is_demo: null, platform: null },
    { id: 'developer:4', type: 'developer', label: 'ТОО Учебный застройщик', ref_id: 4, zone: null, is_demo: false, platform: null },
    { id: 'object:8', type: 'object', label: 'ЖК Малахит', ref_id: 8, zone: 'green', is_demo: false, platform: null },
  ],
  edges: [
    { source: 'developer:3', target: 'object:7', type: 'developer_object' },
    { source: 'object:7', target: 'phone:+77001234567', type: 'owner_phone' },
    { source: 'phone:+77001234567', target: 'developer:4', type: 'owner_phone' },
    { source: 'developer:4', target: 'object:8', type: 'developer_object' },
  ],
  findings: [{ kind: 'shared_phone', value: '+77001234567', label: 'Общий телефон', developer_ids: [3, 4], object_ids: [7, 8] }],
  truncated: false,
};

function makeUser(role: Role): User {
  return {
    id: role === 'mio_officer' ? 1 : role === 'gask' ? 2 : role === 'law_enforcement' ? 3 : 4,
    username: `mock_${role}`,
    full_name: role === 'mio_officer' ? 'Сотрудник МИО' : role === 'gask' ? 'Сотрудник ГАСК' : 'Сотрудник',
    role,
    territory_id: 1,
    locale: 'ru',
  };
}

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 61,
    object: { id: 7, name: objectRow.name, code: objectRow.code, zone: 'yellow' },
    author_id: 2,
    author_name: 'Сотрудник ГАСК',
    assignee_id: 1,
    assignee_name: 'Сотрудник МИО',
    task: 'Проверить сведения по объекту',
    due_date: '2026-10-20',
    status: 'open',
    is_overdue: false,
    days_overdue: 0,
    result: null,
    completed_at: null,
    created_at: '2026-10-15T10:00:00Z',
    ...overrides,
  };
}

function makeSignal(status: SignalStatus = 'requires_confirmation', recipient: SignalRecipient | null = 'gask'): SignalDetail {
  return {
    id: 42,
    number: 'SIG-2026-0042',
    object_id: 7,
    object_name: objectRow.name,
    is_demo: false,
    zone: 'yellow',
    status,
    recipient,
    due_date: status === 'sent' ? '2026-10-25' : null,
    is_overdue: false,
    created_at: '2026-10-15T10:00:00Z',
    origin: 'manual',
    sections: {
      object_developer: {
        object_code: objectRow.code,
        object_name: objectRow.name,
        address: null,
        cadastral_number: null,
        land_purpose: null,
        developer_name: 'ТОО Северстрой',
        bin: null,
        director: null,
        founders: [],
      },
      risk_factors: [],
      legal_basis_status: 'confirmed',
      needs_check: [],
      is_demo: false,
      permit_checks: [],
      publications: [],
      scheme_payments: { payment_schemes: [], contract_types: [], confirmed_payments_note: '' },
      proposed_measures: [],
      route: { recipient, review_days: 10 },
      note: '',
    },
    review_days: 10,
    sent_at: status === 'sent' || status === 'responded' || status === 'closed' ? '2026-10-15T11:00:00Z' : null,
    sent_by: status === 'sent' || status === 'responded' || status === 'closed' ? 1 : null,
    sent_pdf_evidence_id: null,
    return_comment: null,
    response_text: status === 'responded' || status === 'closed' ? 'Проверка проведена, меры приняты.' : null,
    response_at: status === 'responded' || status === 'closed' ? '2026-10-16T11:00:00Z' : null,
    responded_by: status === 'responded' || status === 'closed' ? 2 : null,
    created_by: 1,
    audit: [],
  };
}

function makeSignalMaterials(signal: SignalDetail = makeSignal()): SignalMaterials {
  const isDraft = signal.sent_at === null;
  return {
    signal_id: signal.id,
    number: signal.number,
    status: signal.status,
    recipient: signal.recipient,
    is_draft: isDraft,
    formed_at: '2026-10-17T12:45:00Z',
    snapshot_at: '2026-10-16T12:30:00Z',
    snapshot_publications_capped: true,
    files: [
      {
        kind: 'cover_docx',
        filename: 'cover.docx',
        evidence_id: null,
        content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size_bytes: null,
        sha256: null,
        captured_at: null,
        source_label: 'Сопроводительное письмо',
        source_url: null,
        available: true,
        selected: true,
        missing_reason: null,
      },
      {
        kind: 'signal_pdf',
        filename: 'SIG-2026-0042.pdf',
        evidence_id: null,
        content_type: 'application/pdf',
        size_bytes: isDraft ? null : 80_000,
        sha256: isDraft ? null : 'f'.repeat(64),
        captured_at: isDraft ? null : '2026-10-15T11:00:00Z',
        source_label: isDraft ? 'Сигнальная карточка (PDF)' : 'Архивная PDF-копия карточки',
        source_url: null,
        available: true,
        selected: true,
        missing_reason: null,
      },
      {
        kind: 'publications_xlsx',
        filename: 'publications.xlsx',
        evidence_id: null,
        content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size_bytes: null,
        sha256: null,
        captured_at: null,
        source_label: 'Публикации из снимка',
        source_url: null,
        available: true,
        selected: true,
        missing_reason: null,
      },
      {
        kind: 'inventory_pdf',
        filename: 'inventory.pdf',
        evidence_id: null,
        content_type: 'application/pdf',
        size_bytes: null,
        sha256: null,
        captured_at: null,
        source_label: 'Опись материалов',
        source_url: null,
        available: true,
        selected: true,
        missing_reason: null,
      },
      {
        kind: 'evidence',
        filename: 'evidence-501.jpg',
        evidence_id: 501,
        content_type: 'image/jpeg',
        size_bytes: 250_000,
        sha256: 'd'.repeat(64),
        captured_at: '2026-10-15T10:00:00Z',
        source_label: 'Фото фасада',
        source_url: 'https://example.invalid/evidence/501',
        available: true,
        selected: true,
        missing_reason: null,
      },
      {
        kind: 'evidence',
        filename: 'evidence-502.pdf',
        evidence_id: 502,
        content_type: 'application/pdf',
        size_bytes: 100_000,
        sha256: 'e'.repeat(64),
        captured_at: '2026-10-15T11:00:00Z',
        source_label: 'Протокол обхода',
        source_url: null,
        available: true,
        selected: true,
        missing_reason: null,
      },
      {
        kind: 'evidence',
        filename: 'evidence-503.bin',
        evidence_id: 503,
        content_type: null,
        size_bytes: null,
        sha256: null,
        captured_at: null,
        source_label: 'Файл вне снимка',
        source_url: null,
        available: false,
        selected: false,
        missing_reason: 'Файл не входит в снимок материалов',
      },
      {
        kind: 'evidence',
        filename: 'evidence-504-inspection-entry-and-common-areas.pdf',
        evidence_id: 504,
        content_type: 'application/pdf',
        size_bytes: 318_720,
        sha256: 'f'.repeat(64),
        captured_at: '2026-10-15T12:00:00Z',
        source_label: 'Акт обследования входной группы и мест общего пользования с приложением перечня замечаний',
        source_url: 'https://example.invalid/evidence/504',
        available: true,
        selected: true,
        missing_reason: null,
      },
    ],
    missing_materials: [
      { source_label: 'Файл вне снимка', reason: 'Файл не входит в снимок материалов' },
    ],
    warnings: ['В снимке перечислено 50 публикаций; перечень при создании карточки мог быть ограничен.'],
    limits: { max_evidence_files: 50, max_file_bytes: 20_971_520, max_total_bytes: 62_914_560 },
  };
}

const adFixture: AdDetail = {
  id: 11,
  review_state: 'unreviewed',
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  queue_reasons: ['manual_review'],
  duplicate_count: 0,
  duplicate_instances: [],
  duplicate_instances_truncated: false,
  territory_id: 1,
  unlinked_territory_id: null,
  unlinked_territory_saved: false,
  source_account_id: null,
  platform: 'instagram',
  url: 'https://example.invalid/post/11',
  author: '@sever_build',
  published_at: '2026-10-14T10:00:00Z',
  captured_at: '2026-10-15T10:00:00Z',
  text: 'Бронирование квартир в ЖК Северный бриз. Рассрочка на 24 месяца, готовность 65%. Цена действует до сдачи дома.',
  phones: [],
  links: [],
  object_id: 7,
  object_name: objectRow.name,
  link_confidence: 0.82,
  link_method: 'name',
  payment_schemes: [],
  claimed_readiness_pct: null,
  price_before_completion: false,
  llm_status: 'done',
  analysis_status: null,
  status: 'verification',
  max_phrase_weight: 4,
  total_phrase_weight: 7,
  is_outdoor: false,
  is_demo: false,
  lat: null,
  lon: null,
  last_checked_at: null,
  removed_detected_at: null,
  capture_status: 'done',
  capture_error: null,
  origin: 'collector',
  ocr_status: null,
  created_at: '2026-10-15T10:00:00Z',
  versions: [],
  original_captured_at: '2026-10-15T10:00:00Z',
  original_evidence: null,
  phrase_hits: [],
  evidence: [],
  llm_extraction: {
    findings: [{ category: 'booking', quote: 'Бронирование квартир', confidence: 0.91, uncertain: false }],
    payment_schemes: ['installment'],
    claimed_readiness_pct: 65,
    price_before_completion: true,
    confidence: 0.91,
    uncertain: false,
  },
  linked_object: { id: 7, code: objectRow.code, name: objectRow.name },
};

function makeReviewAd(id: number, overrides: Partial<AdDetail> = {}): AdDetail {
  return {
    ...structuredClone(adFixture),
    id,
    url: `https://example.invalid/post/${id}`,
    ...overrides,
  };
}

function makeObject(zone: 'green' | 'yellow' | 'red' = 'yellow', name = objectRow.name): ObjectDetail {
  const score = zone === 'red' ? 72 : zone === 'yellow' ? 42 : 12;
  return {
    id: 7,
    code: objectRow.code,
    territory_id: 1,
    district_id: null,
    district_name: objectRow.district_name,
    developer_id: null,
    name,
    aliases: [],
    address: null,
    cadastral_number: null,
    land_purpose: null,
    lat: objectRow.lat,
    lon: objectRow.lon,
    planned_completion: null,
    forecast_completion: null,
    construction_status: 'active',
    stalled_since: null,
    readiness_actual_pct: 30,
    readiness_claimed_pct: null,
    prior_violations: null,
    score,
    zone,
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
    ads_7d_count: 1,
    readiness_gap_pp: null,
    latest_score: {
      score,
      zone,
      zone_reasons: [],
      breakdown: { factors: [], needs_check: [], legal_basis_status: 'confirmed' },
      calculated_at: '2026-10-15T10:00:00Z',
      trigger: 'event',
    },
  };
}

const registryShaA = 'a'.repeat(64);
const registryShaB = 'b'.repeat(64);

function registryResponseJson(name: string, warrantyNumber: string): string {
  const payload = {
    success: true,
    message: 'Object Details retrieved successfully',
    data: {
      basicData: {
        name,
        address: 'г. Учебный, ул. Примерная, 1',
        authority: { id: 1, name: 'Орган выдачи тестовых гарантий' },
        warranty_number: warrantyNumber,
        issue_date: '16.10.2026',
        start_date: '01.02.2025',
        commissioning_date: '01.09.2026',
        city: { id: 1, name_ru: 'г. Учебный' },
        region: { id: 1, name_ru: 'Учебная область' },
        developerData: { bin: '000000000001', name: 'ТОО Учебный застройщик' },
      },
      objectData: { no_of_houses: '2', no_of_floors: '9', comfort_class: 'III класс' },
      locationData: { cadastral_number: '00-000-000-0000' },
      companyData: {},
    },
  };
  return JSON.stringify(payload).replace(/[\u007f-\uffff]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

function makeEvidence(
  id: number,
  kind: EvidenceMeta['kind'],
  contentType: string,
  sha256: string,
  capturedAt: string,
): EvidenceMeta {
  return {
    id,
    kind,
    content_type: contentType,
    sha256,
    size_bytes: 512,
    captured_at: capturedAt,
    source_url: null,
    retention_until: null,
  };
}

function makeRegistryObject(): ObjectDetail {
  const evidence = [
    makeEvidence(5181, 'registry_response', 'application/json', registryShaA, '2026-10-14T09:00:00Z'),
    makeEvidence(5182, 'registry_response', 'application/json', registryShaA, '2026-10-15T10:00:00Z'),
    makeEvidence(5183, 'registry_response', 'application/json', registryShaB, '2026-10-16T11:00:00Z'),
    makeEvidence(5190, 'photo', 'image/png', 'c'.repeat(64), '2026-10-16T11:05:00Z'),
    makeEvidence(5191, 'pdf', 'application/pdf', 'd'.repeat(64), '2026-10-16T11:10:00Z'),
  ];
  const object = makeObject();
  const document: ObjectDocument = {
    id: 31,
    object_id: 7,
    doc_type: 'guarantee',
    number: 'ГАРАНТИЯ-ТЕСТ-002',
    issued_at: '2026-10-16',
    issuer: 'Тестовый реестр',
    check_status: 'confirmed',
    checked_at: '2026-10-16T11:15:00Z',
    checked_by: 1,
    check_source: 'housing_portal',
    note: null,
    evidence,
  };
  object.documents = [document];
  return object;
}

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/qgAAAABJRU5ErkJggg==',
  'base64',
);

function registryContentFixtures() {
  return {
    5181: { contentType: 'application/json', body: registryResponseJson('ЖК Учебный дом', 'ГАРАНТИЯ-ТЕСТ-001') },
    5182: { contentType: 'application/json', body: registryResponseJson('ЖК Учебный дом', 'ГАРАНТИЯ-ТЕСТ-001') },
    5183: {
      contentType: 'application/json',
      body: registryResponseJson('ЖК Учебный дом · актуальные сведения', 'ГАРАНТИЯ-ТЕСТ-002'),
    },
    5190: { contentType: 'image/png', body: transparentPng },
    5191: { contentType: 'application/pdf', body: Buffer.from('%PDF-1.4\n% isolated UI fixture\n', 'utf8') },
  };
}

interface CapturedMutation {
  method: string;
  path: string;
  body: unknown;
}

interface MockState {
  role: Role;
  graph?: LinkGraph;
  signals: SignalDetail[];
  signalListFailures?: Partial<Record<SignalStatus, { code: string; message: string }>>;
  assignments: Assignment[];
  searchResults?: SearchResults;
  assignees?: Assignee[];
  activityEvents?: ActivityEvent[];
  evidenceContents?: Record<number, { contentType: string; body: string | Buffer }>;
  evidenceFailures?: Record<number, number>;
  expectedEvidence503Responses: number;
  expectedApi503Responses: number;
  expectedExport413Responses: number;
  expectedPackage413Responses: number;
  signal: SignalDetail;
  signalMaterials?: SignalMaterials;
  packageFailure?: { status: number; code: string; message: string };
  materialsDelayMs?: number;
  packageDelayMs?: number;
  ad: AdDetail;
  object: ObjectDetail;
  ads: AdDetail[];
  territories?: Territory[];
  adUploadLimits?: { max_file_bytes: number; max_total_bytes: number; max_photos: number };
  adUploadLimitsFailures?: number;
  manualAd?: AdDetail;
  analysisRetryFailures?: number;
  analysisPollsRemaining?: number;
  llmPollsRemaining?: number;
  triageFailure?: { state: AdReviewState; code: string; message: string };
  adListFailure?: { code: string; message: string };
  adListDelayMs?: number;
  assignmentFailureAfterFirst?: { code: string; message: string };
  failReturnedCount?: number;
  exportFailurePaths?: string[];
  exportDelayMs?: number;
  /** `/assistant/config` answers 404 when false (the module is off) */
  assistantEnabled?: boolean;
  /** SSE bodies of the next `/assistant/chat` requests, in order; the default reply afterwards */
  assistantReplies?: string[];
  /** `/assistant/chat` never answers, so the Stop button can be tested */
  assistantHangs?: boolean;
  sourceWatched?: boolean;
}

const sse = (events: object[]) => events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');

const assistantReply = sse([
  { type: 'sources', sources: [{ id: 'zones', title: 'Зоны риска', page: '/work' }, { id: 'terms', title: 'Термины', page: null }] },
  { type: 'tool', name: 'search_objects', label: 'Ищу объекты: Северный' },
  { type: 'delta', text: 'Объект [ЖК Северный бриз](/objects/7) в **жёлтой** зоне.\n\n- пункт один\n' },
  { type: 'delta', text: '- пункт два\n\nСм. [документацию](https://example.invalid/doc).' },
  { type: 'done' },
]);

interface Harness {
  state: MockState;
  mutations: CapturedMutation[];
  unexpected: string[];
  listRequests: URL[];
  adListRequests: URL[];
  adDetailRequests: number[];
  objectListRequests: URL[];
  assignmentRequests: URL[];
  searchQueries: string[];
  downloadRequests: Array<{ url: URL; authorization: string | null }>;
  materialRequests: Array<{ url: URL; authorization: string | null }>;
  logoutAuthorization: string | null;
  evidenceRequests: Array<{ id: number; authorization: string | null }>;
  expectedCancelledEvidenceIds: Set<number>;
  pageErrors: string[];
  consoleErrors: string[];
  failedApiRequests: Array<{ url: string; errorText: string }>;
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installMocks(page: Page, role: Role, overrides: Partial<MockState> = {}): Promise<Harness> {
  const state: MockState = {
    role,
    sourceWatched: true,
    signals: [],
    assignments: [],
    expectedEvidence503Responses: 0,
    expectedApi503Responses: 0,
    expectedExport413Responses: 0,
    expectedPackage413Responses: 0,
    signal: makeSignal(),
    ad: structuredClone(adFixture),
    object: makeObject(),
    ads: [structuredClone(adFixture)],
    ...overrides,
  };
  const harness: Harness = {
    state,
    mutations: [],
    unexpected: [],
    listRequests: [],
    adListRequests: [],
    adDetailRequests: [],
    objectListRequests: [],
    assignmentRequests: [],
    searchQueries: [],
    downloadRequests: [],
    materialRequests: [],
    logoutAuthorization: null,
    evidenceRequests: [],
    expectedCancelledEvidenceIds: new Set(),
    pageErrors: [],
    consoleErrors: [],
    failedApiRequests: [],
  };

  page.on('pageerror', (error) => harness.pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') harness.consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/v1/')) {
      harness.failedApiRequests.push({ url: request.url(), errorText: request.failure()?.errorText ?? 'unknown failure' });
    }
  });

  await page.addInitScript(() => {
    if (localStorage.getItem('__ui_mock_session_initialized') !== 'true') {
      localStorage.setItem('saq_token', 'mock-ui-session');
      localStorage.setItem('saq_lang', 'ru');
      localStorage.setItem('__ui_mock_session_initialized', 'true');
    }
  });

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = request.method();
    const postData = request.postData();
    const body = method === 'GET' || method === 'HEAD' || postData === null
      ? null
      : request.headers()['content-type']?.includes('application/json')
        ? request.postDataJSON()
        : postData;
    if (method !== 'GET') harness.mutations.push({ method, path, body });

    if (method === 'GET' && path === '/auth/me') return json(route, makeUser(state.role));
    if (method === 'POST' && path === '/auth/logout') {
      harness.logoutAuthorization = request.headers()['authorization'] ?? null;
      return route.fulfill({ status: 204 });
    }
    if (method === 'GET' && path === '/notifications') return json(route, { items: [] });
    if (method === 'GET' && path === '/activity') {
      return json(route, { items: state.activityEvents ?? [], cursor: 'mock-cursor', reset: false });
    }
    if (method === 'GET' && path === '/settings') {
      return json(route, settingsFixture);
    }
    if (method === 'GET' && path === '/assistant/config') {
      return state.assistantEnabled === false
        ? json(route, { detail: { code: 'not_found', message: 'Assistant is off' } }, 404)
        : json(route, { enabled: true, model: 'test' });
    }
    if (method === 'POST' && path === '/assistant/chat') {
      if (state.assistantHangs) return new Promise<void>(() => undefined);
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: state.assistantReplies?.shift() ?? assistantReply });
    }
    if (method === 'GET' && path === '/vision/config') {
      return json(route, {
        enabled: false,
        detector_mode: 'disabled',
        detector_model: null,
        ocr_enabled: false,
        max_photo_mb: 20,
        max_video_mb: 200,
        max_duration_seconds: 600,
      });
    }
    if (method === 'GET' && path === '/territories') return json(route, state.territories ?? []);
    if (method === 'GET' && path === '/dashboard') return json(route, dashboard);
    if (method === 'GET' && path === '/dashboard/report.pdf') {
      harness.downloadRequests.push({ url, authorization: request.headers()['authorization'] ?? null });
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: Buffer.from('%PDF-1.4\n% report fixture\n', 'utf8') });
    }
    if (method === 'GET' && (path === '/objects/export.xlsx' || path === '/signals/export.xlsx')) {
      harness.downloadRequests.push({ url, authorization: request.headers()['authorization'] ?? null });
      if (state.exportDelayMs) await new Promise((resolve) => setTimeout(resolve, state.exportDelayMs));
      if (state.exportFailurePaths?.includes(path)) {
        return json(route, { detail: { code: 'too_many_export_rows', message: 'Export exceeds the 10,000-row limit' } }, 413);
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: Buffer.from('mock xlsx workbook'),
      });
    }
    if (method === 'GET' && /^\/signals\/\d+\/materials$/.test(path)) {
      harness.materialRequests.push({ url, authorization: request.headers()['authorization'] ?? null });
      if (state.materialsDelayMs) await new Promise((resolve) => setTimeout(resolve, state.materialsDelayMs));
      return json(route, state.signalMaterials ?? makeSignalMaterials(state.signal));
    }
    if (method === 'GET' && /^\/signals\/\d+\/package\.zip$/.test(path)) {
      harness.downloadRequests.push({ url, authorization: request.headers()['authorization'] ?? null });
      if (state.packageDelayMs) await new Promise((resolve) => setTimeout(resolve, state.packageDelayMs));
      if (state.packageFailure) {
        if (state.packageFailure.status === 413) state.expectedPackage413Responses += 1;
        return json(route, { detail: { code: state.packageFailure.code, message: state.packageFailure.message } }, state.packageFailure.status);
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/zip',
        headers: { 'Content-Disposition': 'attachment; filename="SIG-2026-0042-package.zip"' },
        body: Buffer.from('mock zip package'),
      });
    }
    if (method === 'GET' && path === '/graph') return json(route, state.graph ?? graphFixture);
    if (method === 'GET' && path === '/search') {
      harness.searchQueries.push(url.searchParams.get('q') ?? '');
      return json(route, state.searchResults ?? searchFixture);
    }
    if (method === 'GET' && path === '/source-suggestions') return json(route, []);
    if (method === 'GET' && path === '/signals') {
      harness.listRequests.push(url);
      if ((state.failReturnedCount ?? 0) > 0 && url.searchParams.get('status') === 'returned') {
        state.failReturnedCount = (state.failReturnedCount ?? 0) - 1;
        return json(route, { detail: 'temporary fixture failure' }, 503);
      }
      const requestedStatus = url.searchParams.get('status') as SignalStatus | null;
      if (requestedStatus && state.signalListFailures?.[requestedStatus]) {
        state.expectedApi503Responses += 1;
        const failure = state.signalListFailures[requestedStatus]!;
        return json(route, { detail: { code: failure.code, message: failure.message } }, 503);
      }
      const status = url.searchParams.get('status');
      const objectId = Number(url.searchParams.get('object_id')) || null;
      const rows = state.signals.filter((signal) =>
        (status === null || signal.status === status) &&
        (objectId === null || signal.object_id === objectId) &&
        (state.role !== 'gask' || signal.recipient === 'gask') &&
        (state.role !== 'law_enforcement' || signal.recipient === 'law_enforcement'),
      );
      return json(route, { items: rows, total: rows.length });
    }
    if (method === 'GET' && path === '/objects') {
      harness.objectListRequests.push(url);
      return json(route, { items: [objectRow, { ...objectRow, id: 8, code: 'D-08', name: 'ЖК Малахит' }], total: 2 });
    }
    if (method === 'GET' && path === '/signals/42') return json(route, state.signal);
    if (method === 'GET' && path === '/signals/88') return json(route, state.signal);
    if (method === 'PATCH' && /^\/signals\/\d+$/.test(path)) {
      const input = body as Partial<SignalDetail>;
      state.signal = {
        ...state.signal,
        ...input,
        sections: { ...state.signal.sections, ...input.sections },
      };
      state.signals = state.signals.map((signal) => signal.id === state.signal.id ? state.signal : signal);
      return json(route, state.signal);
    }
    if (method === 'GET' && /^\/objects\/\d+\/dossier\.pdf$/.test(path)) {
      harness.downloadRequests.push({ url, authorization: request.headers()['authorization'] ?? null });
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: Buffer.from('%PDF-1.4\n% dossier fixture\n', 'utf8') });
    }
    if (method === 'GET' && path === '/assignments') {
      harness.assignmentRequests.push(url);
      if (state.assignmentFailureAfterFirst && harness.assignmentRequests.length > 1) {
        state.expectedApi503Responses += 1;
        return json(route, { detail: state.assignmentFailureAfterFirst }, 503);
      }
      const mine = url.searchParams.get('mine') === 'true';
      const status = url.searchParams.get('status');
      const overdue = url.searchParams.get('overdue') === 'true';
      const rows = state.assignments.filter((assignment) =>
        (!mine || assignment.assignee_id === makeUser(state.role).id) &&
        (status === null || assignment.status === status) &&
        (!overdue || assignment.is_overdue),
      );
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? rows.length);
      return json(route, { items: rows.slice(offset, offset + limit), total: rows.length });
    }
    if (method === 'GET' && path === '/assignments/assignees') {
      return json(route, state.assignees ?? [
        { id: 1, full_name: 'Сотрудник МИО', role: 'mio_officer' },
        { id: 2, full_name: 'Сотрудник ГАСК', role: 'gask' },
      ]);
    }
    if (method === 'GET' && /^\/objects\/\d+\/assignments$/.test(path)) {
      const objectId = Number(path.split('/')[2]);
      return json(route, state.assignments.filter((assignment) => assignment.object.id === objectId));
    }
    if (method === 'POST' && /^\/objects\/\d+\/assignments$/.test(path)) {
      const objectId = Number(path.split('/')[2]);
      const user = makeUser(state.role);
      const input = body as { assignee_id: number; task: string; due_date: string };
      const assignee = (state.assignees ?? [
        { id: 1, full_name: 'Сотрудник МИО', role: 'mio_officer' as const },
        { id: 2, full_name: 'Сотрудник ГАСК', role: 'gask' as const },
      ]).find((item) => item.id === input.assignee_id);
      const created = makeAssignment({
        id: 62,
        object: { id: objectId, name: objectRow.name, code: objectRow.code, zone: 'yellow' },
        author_id: user.id,
        author_name: user.full_name,
        assignee_id: input.assignee_id,
        assignee_name: assignee?.full_name ?? 'Сотрудник',
        task: input.task,
        due_date: input.due_date,
      });
      state.assignments.unshift(created);
      return json(route, created, 201);
    }
    if (method === 'PATCH' && /^\/assignments\/\d+$/.test(path)) {
      const assignmentId = Number(path.split('/')[2]);
      const assignment = state.assignments.find((item) => item.id === assignmentId);
      if (!assignment) return json(route, { detail: 'Assignment fixture not found' }, 404);
      Object.assign(assignment, body as Partial<Assignment>);
      if (assignment.status === 'done') assignment.completed_at = '2026-10-16T12:00:00Z';
      return json(route, assignment);
    }
    if (method === 'GET' && /^\/objects\/\d+$/.test(path)) {
      return json(route, { ...state.object, id: Number(path.split('/').at(-1)) });
    }
    const evidenceMatch = /^\/evidence\/(\d+)\/content$/.exec(path);
    if (method === 'GET' && evidenceMatch) {
      const id = Number(evidenceMatch[1]);
      harness.evidenceRequests.push({ id, authorization: request.headers()['authorization'] ?? null });
      const remainingFailures = state.evidenceFailures?.[id] ?? 0;
      if (remainingFailures > 0) {
        if (state.evidenceFailures) state.evidenceFailures[id] = remainingFailures - 1;
        state.expectedEvidence503Responses += 1;
        return json(route, { detail: 'temporary evidence fixture failure' }, 503);
      }
      const content = state.evidenceContents?.[id];
      if (content) return route.fulfill({ status: 200, contentType: content.contentType, body: content.body });
    }
    if (method === 'GET' && path === '/ads') {
      harness.adListRequests.push(url);
      if (state.adListFailure) {
        state.expectedApi503Responses += 1;
        return json(route, { detail: state.adListFailure }, 503);
      }
      const duplicateOf = Number(url.searchParams.get('duplicate_of')) || null;
      const queue = url.searchParams.get('queue') === 'true';
      const reviewState = url.searchParams.get('review_state');
      let rows = state.ads;
      if (duplicateOf !== null) {
        const source = state.ads.find((ad) => ad.id === duplicateOf);
        rows = source?.text && source.source_account_id !== null
          ? state.ads.filter((ad) => ad.id === source.id || (ad.text === source.text && ad.source_account_id === source.source_account_id))
          : source ? [source] : [];
      } else {
        rows = rows.filter((ad) => {
          if (reviewState !== null) return ad.review_state === reviewState;
          if (queue) return ad.review_state === 'unreviewed' || (ad.review_state === 'reviewed' && ad.queue_reasons.length > 0);
          return true;
        });
        const platform = url.searchParams.get('platform');
        const objectId = Number(url.searchParams.get('object_id')) || null;
        const status = url.searchParams.get('status');
        const demo = url.searchParams.get('is_demo');
        const query = (url.searchParams.get('q') ?? '').toLocaleLowerCase();
        rows = rows.filter((ad) =>
          (platform === null || ad.platform === platform) &&
          (objectId === null || ad.object_id === objectId) &&
          (status === null || queue || ad.status === status) &&
          (demo === null || ad.is_demo === (demo === 'true')) &&
          (query === '' || (ad.text ?? '').toLocaleLowerCase().includes(query)),
        );
      }
      const total = rows.length;
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? rows.length);
      if (state.adListDelayMs) await new Promise((resolve) => setTimeout(resolve, state.adListDelayMs));
      return json(route, { items: rows.slice(offset, offset + limit), total });
    }
    if (method === 'GET' && path === '/ads/upload-limits') {
      if ((state.adUploadLimitsFailures ?? 0) > 0) {
        state.adUploadLimitsFailures = (state.adUploadLimitsFailures ?? 1) - 1;
        return json(route, { detail: { code: 'temporary_failure', message: 'Could not load upload limits' } }, 503);
      }
      return json(route, state.adUploadLimits ?? {
        max_file_bytes: 25 * 1024 * 1024,
        max_total_bytes: 100 * 1024 * 1024,
        max_photos: 20,
      });
    }
    if (method === 'POST' && path === '/ads/manual') {
      if (!state.manualAd) return json(route, structuredClone(adFixture), 201);
      const ad = structuredClone(state.manualAd);
      state.ad = ad;
      state.ads = [ad, ...state.ads.filter((item) => item.id !== ad.id)];
      return json(route, ad, 201);
    }
    if (method === 'POST' && /^\/ads\/(\d+)\/retry-analysis$/.test(path)) {
      const adId = Number(path.split('/')[2]);
      if ((state.analysisRetryFailures ?? 0) > 0) {
        state.analysisRetryFailures = (state.analysisRetryFailures ?? 1) - 1;
        return json(route, { detail: { code: 'temporary_failure', message: 'The retry could not be started.' } }, 503);
      }
      const current = state.ads.find((ad) => ad.id === adId) ?? state.ad;
      const hasFailure =
        current.capture_status === 'failed' || current.ocr_status === 'failed' || current.llm_status === 'failed' || current.analysis_status === 'failed';
      const hasPending =
        current.capture_status === 'pending' || current.ocr_status === 'pending' || current.llm_status === 'pending' || current.analysis_status === 'pending';
      if (!hasFailure || hasPending) return json(route, { detail: { code: 'retry_conflict', message: 'The publication is not ready for retry.' } }, 409);

      const llmOnlyRetry =
        current.llm_status === 'failed' && current.capture_status !== 'failed' && current.ocr_status !== 'failed' && current.analysis_status !== 'failed';
      const ad: AdDetail = llmOnlyRetry
        ? {
          ...current,
          llm_status: 'pending',
          queue_reasons: [
            ...current.queue_reasons.filter((reason) => reason !== 'llm_pending' && reason !== 'llm_failed'),
            'llm_pending',
          ],
        }
        : {
          ...current,
          analysis_status: 'pending',
          ocr_status: current.ocr_status === 'failed' ? 'pending' : current.ocr_status,
          llm_status: 'pending',
          queue_reasons: [
            ...current.queue_reasons.filter((reason) => reason !== 'analysis_pending' && reason !== 'analysis_failed' && reason !== 'llm_pending' && reason !== 'llm_failed' && reason !== 'ocr_pending' && reason !== 'ocr_failed'),
            'analysis_pending',
            'llm_pending',
            ...(current.ocr_status === 'failed' ? ['ocr_pending' as const] : []),
          ],
        };
      state.ads = state.ads.map((item) => item.id === adId ? ad : item);
      if (state.ad.id === adId) state.ad = ad;
      if (llmOnlyRetry) state.llmPollsRemaining = 1;
      else {
        state.analysisPollsRemaining = 1;
        state.llmPollsRemaining = 2;
      }
      return json(route, ad);
    }
    if (method === 'GET' && /^\/ads\/\d+$/.test(path)) {
      const id = Number(path.split('/').at(-1));
      harness.adDetailRequests.push(id);
      let ad = state.ads.find((item) => item.id === id) ?? state.ad;
      if (ad.id === id && ad.analysis_status === 'pending' && state.analysisPollsRemaining !== undefined) {
        if (state.analysisPollsRemaining > 0) {
          state.analysisPollsRemaining -= 1;
        } else {
          ad = {
            ...ad,
            analysis_status: 'done',
            ocr_status: ad.ocr_status === 'pending' ? 'done' : ad.ocr_status,
            queue_reasons: ad.queue_reasons.filter((reason) => reason !== 'analysis_pending' && reason !== 'analysis_failed' && reason !== 'ocr_pending' && reason !== 'ocr_failed'),
          };
          state.ads = state.ads.map((item) => item.id === id ? ad : item);
          if (state.ad.id === id) state.ad = ad;
        }
      }
      if (ad.id === id && ad.llm_status === 'pending' && state.llmPollsRemaining !== undefined) {
        if (state.llmPollsRemaining > 0) {
          state.llmPollsRemaining -= 1;
        } else {
          ad = {
            ...ad,
            llm_status: 'done',
            queue_reasons: ad.queue_reasons.filter((reason) => reason !== 'llm_pending' && reason !== 'llm_failed'),
          };
          state.ads = state.ads.map((item) => item.id === id ? ad : item);
          if (state.ad.id === id) state.ad = ad;
        }
      }
      return json(route, ad);
    }
    if (method === 'GET' && path === '/source-accounts') {
      return json(route, {
        items: [{
          id: 3,
          platform: 'aggregator',
          handle: 'ЖК Северный бриз · объявления OLX',
          url: 'https://www.olx.kz/search-example',
          object_id: 7,
          developer_id: null,
          territory_id: null,
          is_watched: state.sourceWatched ?? true,
          last_collected_at: null,
          last_error: null,
          last_error_at: null,
        }],
      });
    }
    if (method === 'GET' && path === '/source-accounts/collectors') {
      return json(route, [
        { platform: 'instagram', enabled: false, sources: {} },
        { platform: 'telegram', enabled: false, sources: {} },
        { platform: 'aggregator', enabled: false, sources: { olx: false, krisha: false } },
      ]);
    }
    if (method === 'PATCH' && path === '/source-accounts/3') {
      state.sourceWatched = Boolean((body as { is_watched?: boolean }).is_watched);
      return json(route, {
        id: 3,
        platform: 'aggregator',
        handle: 'ЖК Северный бриз · объявления OLX',
        url: 'https://www.olx.kz/search-example',
        object_id: 7,
        developer_id: null,
        territory_id: null,
        is_watched: state.sourceWatched,
        last_collected_at: null,
        last_error: null,
        last_error_at: null,
      });
    }

    if (method === 'POST' && /^\/ads\/\d+\/accept-llm$/.test(path)) return json(route, state.ads.find((ad) => ad.id === Number(path.split('/')[2])) ?? state.ad);
    const adHitConfirm = /^\/ads\/(\d+)\/hits\/(\d+)\/confirm$/.exec(path);
    if (method === 'POST' && adHitConfirm) {
      const adId = Number(adHitConfirm[1]);
      const hitId = Number(adHitConfirm[2]);
      const confirmed = (body as { confirmed: boolean }).confirmed;
      const updateHits = (ad: AdDetail) => ({
        ...ad,
        phrase_hits: ad.phrase_hits.map((hit) => hit.id === hitId ? { ...hit, confirmed } : hit),
        queue_reasons: confirmed && ad.queue_reasons.includes('unreviewed_phrase_hits')
          ? ad.queue_reasons.filter((reason) => reason !== 'unreviewed_phrase_hits')
          : ad.queue_reasons,
      });
      state.ads = state.ads.map((ad) => ad.id === adId ? updateHits(ad) : ad);
      if (state.ad.id === adId) state.ad = updateHits(state.ad);
      return json(route, { success: true });
    }
    const triageMatch = /^\/ads\/(\d+)\/triage$/.exec(path);
    if (method === 'PATCH' && triageMatch) {
      const adId = Number(triageMatch[1]);
      const input = body as { state: AdReviewState; note?: string };
      if (state.triageFailure?.state === input.state) {
        return json(route, { detail: { code: state.triageFailure.code, message: state.triageFailure.message } }, 409);
      }
      const updateTriage = (ad: AdDetail): AdDetail => ({
        ...ad,
        review_state: input.state,
        reviewed_by: 1,
        reviewed_at: '2026-10-17T10:00:00Z',
        review_note: input.note === undefined ? ad.review_note : input.note,
        queue_reasons: input.state === 'reviewed' || input.state === 'deferred' || input.state === 'irrelevant'
          ? []
          : ad.queue_reasons.length > 0 ? ad.queue_reasons : ['manual_review'],
      });
      state.ads = state.ads.map((ad) => ad.id === adId ? updateTriage(ad) : ad);
      const updated = state.ads.find((ad) => ad.id === adId) ?? state.ad;
      if (state.ad.id === adId) state.ad = updated;
      return json(route, updated);
    }
    if (method === 'PATCH' && /^\/ads\/\d+$/.test(path)) {
      const adId = Number(path.split('/')[2]);
      const patch = body as Partial<AdDetail>;
      const updateAd = (ad: AdDetail): AdDetail => {
        const updated = { ...ad, ...patch };
        if ('object_id' in patch) {
          const objectId = patch.object_id ?? null;
          updated.linked_object = objectId === null
            ? null
            : { id: objectId, code: objectId === 8 ? 'D-08' : objectRow.code, name: objectId === 8 ? 'ЖК Малахит' : objectRow.name };
        }
        return updated;
      };
      state.ads = state.ads.map((ad) => ad.id === adId ? updateAd(ad) : ad);
      if (state.ad.id === adId) state.ad = updateAd(state.ad);
      return json(route, state.ads.find((ad) => ad.id === adId) ?? state.ad);
    }
    if (method === 'POST' && path === '/signals/42/confirm-and-send') {
      state.signal = { ...state.signal, status: 'sent', sent_at: '2026-10-16T12:00:00Z', sent_by: 1 };
      return json(route, state.signal);
    }
    if (method === 'POST' && path === '/signals/42/response') {
      const responseText = (body as { response_text: string }).response_text;
      state.signal = {
        ...state.signal,
        status: 'responded',
        response_text: responseText,
        response_at: '2026-10-16T13:00:00Z',
        responded_by: 2,
      };
      return json(route, state.signal);
    }
    if (method === 'POST' && path === '/signals/42/close') {
      state.signal = { ...state.signal, status: 'closed' };
      return json(route, state.signal);
    }
    if (method === 'POST' && path === '/signals') {
      state.signal = makeSignal('requires_confirmation', 'gask');
      state.signal.id = 88;
      state.signal.number = 'SIG-2026-0088';
      return json(route, state.signal, 201);
    }
    if (method === 'PUT' && path === '/settings') return json(route, { ...settingsFixture, ...(body as Partial<typeof settingsFixture>) });

    const descriptor = `${method} ${path}${url.search}`;
    harness.unexpected.push(descriptor);
    return json(route, { detail: `No UI fixture for ${descriptor}` }, 501);
  });
  return harness;
}

async function screenshot(page: Page, name: string, fullPage = true) {
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: `${screenshotDir}/${name}.png`, fullPage });
}

async function expectLightOnly(page: Page) {
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(root).toHaveAttribute('data-theme-mode', 'light');
  expect(await root.evaluate((element) => element.classList.contains('dark'))).toBe(false);
  await expect(page.getByRole('button', { name: /Оформление/ })).toHaveCount(0);
}

async function selectLanguage(page: Page, language: 'ru' | 'kk') {
  await page.getByTestId('header-language-trigger').click();
  const currentLanguage = await page.locator('html').getAttribute('lang');
  const selected = page.getByTestId(`header-language-option-${currentLanguage}`);
  await expect(selected).toHaveAttribute('aria-checked', 'true');
  const option = page.getByTestId(`header-language-option-${language}`);
  await option.click();
  await expect(page.locator('html')).toHaveAttribute('lang', language);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('saq_lang'))).toBe(language);
}

async function setLargeFont(page: Page, enabled: boolean) {
  const root = page.locator('html');
  const current = await root.getAttribute('data-font') === 'large';
  const trigger = page.getByTestId('header-user-trigger');
  await trigger.click();
  const option = page.getByTestId('profile-large-font-item');
  await expect(option).toHaveAttribute('aria-checked', String(current));
  if (current !== enabled) await option.click();
  else await page.keyboard.press('Escape');
  expect(await root.getAttribute('data-font') === 'large').toBe(enabled);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('saq_font'))).toBe(enabled ? 'large' : null);
}

async function openAssistantFromProfile(page: Page) {
  await page.getByTestId('header-user-trigger').click();
  await page.getByTestId('profile-ask-ai-item').click();
}

function expectCleanBrowser(harness: Harness) {
  expect(harness.unexpected).toEqual([]);
  expect(harness.pageErrors).toEqual([]);
  const fixture503ConsoleErrors = harness.consoleErrors.filter((message) =>
    message === 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
  );
  expect(fixture503ConsoleErrors.length).toBeLessThanOrEqual(harness.state.expectedEvidence503Responses + harness.state.expectedApi503Responses);
  const fixture413ConsoleErrors = harness.consoleErrors.filter((message) =>
    message === 'Failed to load resource: the server responded with a status of 413 (Payload Too Large)',
  );
  expect(fixture413ConsoleErrors.length).toBeLessThanOrEqual(harness.state.expectedExport413Responses + harness.state.expectedPackage413Responses);
  expect(harness.consoleErrors.filter((message) =>
    message !== 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)' &&
    message !== 'Failed to load resource: the server responded with a status of 413 (Payload Too Large)',
  )).toEqual([]);
  const unexplainedFailures = harness.failedApiRequests.filter((failure) => {
    const evidenceId = /\/api\/v1\/evidence\/(\d+)\/content(?:\?|$)/.exec(failure.url)?.[1];
    return !(
      failure.errorText === 'net::ERR_ABORTED' &&
      evidenceId !== undefined &&
      harness.expectedCancelledEvidenceIds.has(Number(evidenceId))
    );
  });
  expect(unexplainedFailures).toEqual([]);
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (!channels || channels.length !== 3) throw new Error(`Unexpected computed color: ${color}`);
    const linear = channels.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const [first, second] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (first + 0.05) / (second + 0.05);
}

test('work opens as the operator task queue, links the real next item and supports Kazakh', async ({ page }) => {
  const returned = makeSignal('returned', 'gask');
  returned.id = 43;
  returned.number = 'SIG-2026-0043';
  const confirmation = makeSignal('requires_confirmation', 'gask');
  const harness = await installMocks(page, 'mio_officer', {
    signals: [returned, confirmation, makeSignal('responded', 'gask'), makeSignal('sent', 'gask')],
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: t('nav.homeTitle') })).toBeVisible();
  await screenshot(page, 'home-operator-desktop');
  const homeNav = page.getByRole('navigation', { name: t('nav.primaryNavigation') });
  await expect(homeNav.getByTestId('bento-nav-card-work')).toHaveAttribute('href', '/work');
  await homeNav.getByTestId('bento-nav-card-work').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/work');
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: t('work.title') })).toBeVisible();
  await expect(page.getByTestId('bento-section-panel')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Доработать карточку SIG-2026-0043' })).toHaveAttribute('href', '/signals/43');
  const primaryNav = page.getByRole('navigation', { name: t('nav.primaryNavigation') });
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, 'section-work-mobile-390');
  await page.setViewportSize({ width: 1440, height: 900 });
  const adsQueue = primaryNav.getByTestId('bento-nav-card-adsQueue');
  await expect(adsQueue).toHaveAttribute('href', '/ads?queue=true');
  await screenshot(page, 'section-work-desktop');
  await adsQueue.click();
  await expect(page).toHaveURL('/ads?queue=true');
  await expect(page.getByRole('combobox', { name: t('ads:review.stateLabel') })).toBeVisible();
  await expect(page.getByTestId('bento-section-panel')).toBeVisible();
  await primaryNav.getByTestId('bento-nav-card-tools').click();
  await expect(page).toHaveURL('/home/tools');
  await page.getByTestId('bento-leaf-card-adsArchive').click();
  await expect(page).toHaveURL('/ads');
  await expect(page.getByTestId('bento-selected-leaf')).toBeVisible();
  await page.getByTestId('bento-selected-leaf').click();
  await expect(page).toHaveURL('/home/tools');
  await page.getByTestId('bento-home-link').click();
  await expect(page).toHaveURL('/home');
  await homeNav.getByTestId('bento-nav-card-work').click();
  await expect(page).toHaveURL('/work');
  await primaryNav.getByTestId('bento-nav-card-adsQueue').click();
  await expect(page).toHaveURL('/ads?queue=true');
  await page.goBack();
  await expect(page).toHaveURL('/work');
  await page.getByTestId('bento-home-link').click();
  await expect(page).toHaveURL('/home');

  await selectLanguage(page, 'kk');
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: tKk('nav.homeTitle') })).toBeVisible();
  await screenshot(page, 'home-operator-kk-desktop');
  await page.getByTestId('bento-nav-card-work').click();
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: tKk('work.title') })).toBeVisible();
  await screenshot(page, 'section-work-kk-desktop');
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('bento navigation moves the selected card and respects reduced motion', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/home');
  const tile = page.getByTestId('bento-nav-card-work');
  const before = await tile.boundingBox();
  expect(before).not.toBeNull();

  await tile.click();
  await expect(page).toHaveURL('/work');
  const moving = page.getByTestId('bento-section-panel');
  const samples = await page.evaluate(async () => {
    const values: boolean[] = [];
    for (let i = 0; i < 5; i += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const element = document.querySelector<HTMLElement>('[data-testid="bento-section-panel"]');
      const transform = element ? getComputedStyle(element).transform : 'none';
      values.push(transform !== 'none' && !new DOMMatrixReadOnly(transform).isIdentity);
    }
    return values;
  });
  await expect(moving).toBeVisible();
  expect(samples.some(Boolean), `expected a non-identity spatial transform during layout transition; got ${samples.join(', ')}`).toBe(true);
  await expect.poll(async () => moving.evaluate((element) => getComputedStyle(element).transform)).toBe('none');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByTestId('bento-home-link').click();
  await expect(page).toHaveURL('/home');
  await page.getByTestId('bento-nav-card-work').click();
  await expect(page).toHaveURL('/work');
  await expect(page.getByTestId('bento-section-panel')).toBeVisible();
  expectCleanBrowser(harness);
});

test('work composition preserves keyboard actions and fits narrow screens', async ({ page }) => {
  const returned = makeSignal('returned', 'gask');
  returned.id = 43;
  returned.number = 'SIG-2026-0043';
  returned.object_name = 'Жилой комплекс «Северный бриз»: очередь проверки, корпус 12';
  const assignment = makeAssignment();
  assignment.object.name = 'Жилой комплекс «Северный бриз», корпус 12';
  const harness = await installMocks(page, 'mio_officer', {
    signals: [returned, makeSignal('requires_confirmation', 'gask')],
    assignments: [assignment],
  });

  await page.goto('/work');
  const nextCard = page.getByTestId('work-next-card');
  const primaryAction = page.getByTestId('work-primary-action');
  await expect(nextCard).toBeVisible();
  await expect(primaryAction).toHaveAttribute('href', '/signals/43');
  await expect(page.getByTestId('work-assignments-card')).toBeVisible();
  await expect(page.getByTestId('work-objects-card')).toBeVisible();
  await expect(page.getByTestId('work-ads-card')).toBeVisible();
  await expect(page.getByTestId('work-report-card')).toBeVisible();

  const confirmationTab = page.getByTestId('work-signal-status-requires_confirmation');
  await confirmationTab.focus();
  await page.keyboard.press('Enter');
  await expect(confirmationTab).toHaveAttribute('aria-pressed', 'true');
  await expect(confirmationTab).toBeFocused();
  await expect(page.getByTestId('work-signal-details')).toBeVisible();

  const report = page.getByTestId('work-report-card');
  const reportSummary = report.locator('summary');
  await reportSummary.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => report.evaluate((element) => (element as HTMLDetailsElement).open)).toBe(true);
  await expect(reportSummary).toBeFocused();

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      main: document.querySelector('main')?.scrollWidth ?? 0,
      overflowing: Array.from(document.body.querySelectorAll<HTMLElement>('*')).flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return [];
        if (rect.right <= document.documentElement.clientWidth + 1 && rect.left >= -1) return [];
        return [{ tag: element.tagName, className: String(element.className).slice(0, 80), left: rect.left, right: rect.right, text: element.innerText?.slice(0, 45) }];
      }).slice(0, 8),
    }));
    expect(dimensions.document, `document must not overflow at ${width}px; elements: ${JSON.stringify(dimensions.overflowing)}`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.main, `main content must not overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
    await page.evaluate(() => window.scrollTo(0, 0));
    await screenshot(page, `work-composition-${width}`);
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reportSummary.click();
  await expect.poll(() => report.evaluate((element) => (element as HTMLDetailsElement).open)).toBe(false);
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('administrator opens the read-only task overview and recipient is kept out of registry work', async ({ page }) => {
  const adminHarness = await installMocks(page, 'admin', { signals: [makeSignal('requires_confirmation', 'gask')] });
  await page.goto('/');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: t('nav.homeTitle') })).toBeVisible();
  await page.getByTestId('bento-nav-card-work').click();
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: t('work.adminTitle') })).toBeVisible();
  await expect(page.getByText(/Источников публикаций|Сборщики/).first()).toBeVisible();
  const openData = page.getByTestId('bento-nav-card-data');
  await expect(openData).toHaveAttribute('href', '/home/data');
  await screenshot(page, 'work-admin-readonly');
  await openData.click();
  await page.getByTestId('bento-leaf-card-signals').click();
  await expect(page).toHaveURL(/\/signals$/);
  const row = page.getByRole('row').filter({ hasText: 'SIG-2026-0042' });
  await expect(row).toContainText('Просмотр карточки');
  await expect(page.getByRole('button', { name: 'Создать карточку' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Подтвердить и направить' })).toHaveCount(0);
  expect(adminHarness.mutations).toEqual([]);
  expectCleanBrowser(adminHarness);

  const recipientHarness = await installMocks(page, 'gask');
  await page.goto('/');
  await expect(page).toHaveURL(/\/signals$/);
  await expect(page.getByTestId('bento-navigation').getByRole('navigation', { name: t('nav.primaryNavigation') }).getByTestId('bento-nav-card-signals')).toBeVisible();
  await page.goto('/work');
  await expect(page).toHaveURL(/\/signals$/);
  await expect(page.getByRole('heading', { level: 1, name: t('signals:list.title') })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Создать карточку' })).toHaveCount(0);
  expect(recipientHarness.mutations).toEqual([]);
  expectCleanBrowser(recipientHarness);
});

test('role landings and navigation preserve recipient registry restrictions', async ({ page }) => {
  for (const role of ['mio_officer', 'admin', 'gask', 'law_enforcement'] as const) {
    const harness = await installMocks(page, role);
    await page.goto('/');
    const recipient = role === 'gask' || role === 'law_enforcement';
    await expect(page).toHaveURL(recipient ? /\/signals$/ : /\/home$/);
    if (role === 'admin') {
      await screenshot(page, 'home-admin-1440-ru');
      await page.setViewportSize({ width: 320, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      await screenshot(page, 'home-admin-320-ru');
      await selectLanguage(page, 'kk');
      await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
      await screenshot(page, 'home-admin-320-kk');
      await page.setViewportSize({ width: 1440, height: 900 });
      await screenshot(page, 'home-admin-1440-kk');
      await selectLanguage(page, 'ru');
    }
    const nav = page.getByRole('navigation', { name: t('nav.primaryNavigation') });
    if (recipient) {
      await expect(nav.getByTestId('bento-nav-card-signals')).toBeVisible();
      for (const key of ['work', 'adsQueue', 'objects', 'explore', 'tools', 'admin', 'data']) {
        await expect(nav.getByTestId(`bento-nav-card-${key}`)).toHaveCount(0);
      }
      for (const path of ['/map', '/objects', '/ads', '/graph', '/sources', '/control', '/admin']) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/signals$/);
      }
      await expect(page.getByRole('button', { name: t('signals:list.create') })).toHaveCount(0);
    } else {
      if (role === 'admin') {
        await expect(nav.getByTestId('bento-nav-card-work')).toHaveAttribute('href', '/work');
        await expect(nav.getByTestId('bento-nav-card-admin')).toHaveAttribute('href', '/admin');
        await expect(nav.getByTestId('bento-nav-card-data')).toHaveAttribute('href', '/home/data');
      } else {
        await expect(nav.getByTestId('bento-nav-card-work')).toHaveAttribute('href', '/work');
        await expect(nav.getByTestId('bento-nav-card-adsQueue')).toHaveAttribute('href', '/ads?queue=true');
        await expect(nav.getByTestId('bento-nav-card-signals')).toHaveAttribute('href', '/signals');
        await expect(nav.getByTestId('bento-nav-card-objects')).toHaveAttribute('href', '/objects');
        await expect(nav.getByTestId('bento-nav-card-admin')).toHaveCount(0);
      }
    }
    expect(harness.mutations).toEqual([]);
    expectCleanBrowser(harness);
  }
});

test('operator work distinguishes an unavailable queue from an empty queue', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer', {
    signalListFailures: { returned: { code: 'temporary_failure', message: 'Queue temporarily unavailable' } },
  });
  await page.goto('/work');
  await expect(page.getByTestId('work-next-card').getByRole('alert')).toContainText('Queue temporarily unavailable');
  await expect(page.getByTestId('work-signal-details').getByRole('alert')).toContainText('Queue temporarily unavailable');
  await expect(page.getByText(t('work.emptyQueue'), { exact: true })).toHaveCount(0);
  const availableQueues = page.getByRole('navigation', { name: t('work.queuesTitle') });
  await expect(availableQueues.getByRole('button')).toHaveCount(1);
  await expect(page.getByRole('link', { name: t('work.adsQueueLink') })).toHaveAttribute('href', '/ads?queue=true');
  expect(harness.adListRequests).toEqual([]);
  expectCleanBrowser(harness);
});

test('operator work collapses four empty signal queues into the compact all-caught-up state', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer');
  await page.goto('/work');
  await expect(page.getByText(t('work.emptyQueue'), { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: t('work.queuesTitle') })).toHaveCount(0);
  await expect(page.getByRole('link', { name: t('work.openAll') })).toHaveAttribute('href', '/signals');
  await expect(page.getByRole('link', { name: t('work.checkAds') })).toHaveAttribute('href', '/ads?queue=true');
  expect(harness.listRequests.filter((url) => url.pathname.endsWith('/signals')).length).toBe(4);
  expectCleanBrowser(harness);
});

test('operator work does not use a stale assignment as the main action after its refetch fails', async ({ page }) => {
  const assignment = makeAssignment();
  const harness = await installMocks(page, 'mio_officer', {
    assignments: [assignment],
    assignmentFailureAfterFirst: { code: 'temporary_failure', message: 'Assignments temporarily unavailable' },
  });
  await page.goto('/work');
  const nextTask = t('work.primaryAssignment', { object: assignment.object.name });
  await expect(page.getByRole('link', { name: nextTask })).toHaveAttribute('href', '/objects/7?assignment=61#assignments');
  await page.goto('/objects/7');
  await page.goto('/work');
  await expect(page.getByRole('alert').filter({ hasText: 'Assignments temporarily unavailable' })).toBeVisible();
  await expect(page.getByRole('link', { name: nextTask })).toHaveCount(0);
  await expect.poll(() => harness.assignmentRequests.length).toBeGreaterThan(1);
  const retry = page.getByTestId('work-assignments-card').getByRole('button', { name: t('retry') });
  await expect(retry).toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'light');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  const colors = await retry.evaluate((button) => ({
    foreground: getComputedStyle(button).color,
    background: getComputedStyle(button).backgroundColor,
  }));
  expect(contrastRatio(colors.foreground, colors.background), 'assignment retry contrast in forced light mode').toBeGreaterThanOrEqual(4.5);
  await screenshot(page, 'work-assignment-error-light-under-dark-os');
  await retry.focus();
  await expect(retry).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(retry).toBeFocused();
  expectCleanBrowser(harness);
});

test('colored signal-card retry controls stay readable and keyboard reachable under dark OS settings', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer', {
    signalListFailures: { returned: { code: 'temporary_failure', message: 'Queue temporarily unavailable' } },
  });
  await page.goto('/work');
  const nextRetry = page.getByTestId('work-next-card').getByRole('button', { name: t('retry') });
  const signalRetry = page.getByTestId('work-signal-details').getByRole('button', { name: t('retry') });
  await expect(nextRetry).toBeVisible();
  await expect(signalRetry).toBeVisible();

  await page.emulateMedia({ colorScheme: 'dark' });
  await expectLightOnly(page);
  for (const retry of [nextRetry, signalRetry]) {
    const colors = await retry.evaluate((button) => ({
      foreground: getComputedStyle(button).color,
      background: getComputedStyle(button).backgroundColor,
    }));
    expect(contrastRatio(colors.foreground, colors.background), 'signal retry contrast in forced light mode').toBeGreaterThanOrEqual(4.5);
  }
  await screenshot(page, 'work-signal-error-light-under-dark-os');

  await signalRetry.focus();
  await expect(signalRetry).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(signalRetry).toBeFocused();
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('administrator edits a setting and submits only the changed value', async ({ page }) => {
  const harness = await installMocks(page, 'admin');
  await page.goto('/admin/settings');
  await expect(page.getByRole('heading', { name: 'Настройки системы' })).toBeVisible();
  const field = page.locator('#setting-review_days');
  await field.fill('11');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect.poll(() => harness.mutations.filter(({ method, path }) => method === 'PUT' && path === '/settings')).toHaveLength(1);
  expect(harness.mutations.find(({ method, path }) => method === 'PUT' && path === '/settings')?.body).toEqual({ review_days: 11 });
  expectCleanBrowser(harness);
});

test('Vision creates a fixture session and uploads a supported photo through the real UI actions', async ({ page }) => {
  const mutations: Array<{ method: string; path: string; body: string | null }> = [];
  const objectListRequests: URL[] = [];
  let rejectNextUpload = false;
  let staleUploadAuthorization: string | null = null;
  let releaseStaleUpload!: () => void;
  let staleUploadArrived!: () => void;
  const staleUploadResponse = new Promise<void>((resolve) => {
    releaseStaleUpload = resolve;
  });
  const staleUploadRequest = new Promise<void>((resolve) => {
    staleUploadArrived = resolve;
  });
  const finding: VisionFinding = {
    id: 81, session_id: 41, frame_id: 71, bbox: { x: 0.2, y: 0.2, w: 0.3, h: 0.3 }, category: 'outdoor_ad', status: 'observed',
    origin: 'model', confidence: 0.78, model_version: 'fixture-model', note: 'Fixture finding', review_state: 'pending', ocr_status: null,
    ocr_text: null, ocr_confidence: null, ocr_engine: null, confirmed_text: null, run_id: 91, ad_post_id: null,
    created_at: '2026-10-16T10:01:00Z', created_by_name: null, reviews: [],
  };
  const asset: VisionAsset = {
    id: 51, session_id: 41, kind: 'photo', original_name: 'inspection.png', content_type: 'image/png', size_bytes: 68, sha256: 'f'.repeat(64),
    width: 1, height: 1, duration_ms: null, lat: null, lon: null, taken_at: null, status: 'ready', error_code: null, progress: 100,
    frames_count: 1, created_at: '2026-10-16T10:01:00Z',
  };
  const frame: VisionFrame = { id: 71, asset_id: 51, timestamp_ms: null, width: 1, height: 1, sharpness: 1, usable: true };
  let session: VisionSessionDetail = {
    id: 41,
    object: null,
    territory_id: 1,
    source: 'drone',
    captured_at: null,
    status: 'open',
    is_demo: false,
    note: null,
    created_at: '2026-10-16T10:00:00Z',
    created_by_name: 'Сотрудник МИО',
    reviewed_at: null,
    reviewed_by_name: null,
    assets_count: 0,
    frames_count: 0,
    findings_count: 0,
    processing: false,
    failed: false,
    assets: [],
    findings: [],
    runs: [],
  };
  await page.addInitScript(() => {
    localStorage.setItem('saq_token', 'mock-vision-fixture');
    localStorage.setItem('saq_lang', 'ru');
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = request.method();
    if (method !== 'GET') mutations.push({ method, path, body: request.postData() });
    if (method === 'GET' && path === '/auth/me') return json(route, makeUser('mio_officer'));
    if (method === 'GET' && path === '/assistant/config') return json(route, { enabled: false });
    if (method === 'GET' && path === '/vision/config') return json(route, { enabled: true, detector_mode: 'experimental_pretrained', detector_model: 'fixture-only', ocr_enabled: false, max_photo_mb: 20, max_video_mb: 200, max_duration_seconds: 600 });
    if (method === 'GET' && path === '/objects') {
      objectListRequests.push(url);
      return json(route, { items: [objectRow], total: 1 });
    }
    if (method === 'GET' && path === '/vision/sessions') return json(route, { items: [session], total: 1 });
    if (method === 'POST' && path === '/vision/sessions') return json(route, session, 201);
    if (method === 'GET' && path === '/vision/sessions/41') return json(route, session);
    if (method === 'GET' && path === '/vision/sessions/41/frames') return json(route, { items: session.assets_count > 0 ? [frame] : [], total: session.assets_count > 0 ? 1 : 0 });
    if (method === 'POST' && path === '/vision/sessions/41/assets') {
      if (rejectNextUpload) {
        rejectNextUpload = false;
        staleUploadAuthorization = request.headers().authorization ?? null;
        staleUploadArrived();
        await staleUploadResponse;
        return json(route, { detail: 'Unauthenticated' }, 401);
      }
      session = { ...session, assets: [asset], assets_count: 1, frames_count: 1, findings: [finding], findings_count: 1 };
      return json(route, asset, 201);
    }
    if (method === 'GET' && path === '/vision/frames/71/content') return route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng });
    if (method === 'POST' && path === '/vision/findings/81/review') {
      finding.review_state = 'confirmed';
      return json(route, finding);
    }
    if (method === 'POST' && path === '/vision/findings/81/publish-ad') return json(route, { ad_id: 99 }, 201);
    if (method === 'GET' && path === '/territories') {
      return json(route, [
        {
          id: 1,
          parent_id: null,
          level: 'city',
          code: 'FIXTURE-CITY',
          name: 'Город fixture',
          timezone: 'Asia/Almaty',
          center_lat: null,
          center_lon: null,
          children: [],
        },
      ]);
    }
    if (method === 'GET' && path === '/notifications') return json(route, { items: [] });
    if (method === 'GET' && path === '/activity') return json(route, { items: [], cursor: null, reset: false });
    if (method === 'GET' && path === '/settings') return json(route, { review_days: 10, ad_window_days: 90, readiness_gap_pp: 20, significant_delay_days: 90, zone_yellow_min: 25, zone_red_min: 60, complaints_threshold: 3, stalled_days: 180, recheck_after_days: 90, link_confidence_threshold: 0.7, green_interval_days: 90, yellow_interval_days: 30, recipient_emails: { mio: [], gask: [], law_enforcement: [] } });
    return json(route, { detail: `No Vision fixture for ${method} ${path}` }, 404);
  });

  await page.goto('/vision');
  await expect(page.getByRole('heading', { name: 'Визуальные инспекции' })).toBeVisible();
  await page.getByRole('button', { name: 'Новая инспекция' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая инспекция' });
  await expect(dialog).toBeVisible();
  await expect.poll(() => objectListRequests.length).toBeGreaterThan(0);
  await dialog.getByRole('button', { name: 'Создать' }).click();
  await expect(page).toHaveURL(/\/vision\/41$/);
  expect(mutations.filter(({ method, path }) => method === 'POST' && path === '/vision/sessions')).toHaveLength(1);
  const requestsBeforeSessionObject = objectListRequests.length;
  await page.getByRole('button', { name: t('vision:header.attach') }).click();
  await expect.poll(() => objectListRequests.slice(requestsBeforeSessionObject).some((request) => request.searchParams.get('territory_id') === '1')).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByTestId('vision-file-input').setInputFiles({ name: 'inspection.png', mimeType: 'image/png', buffer: transparentPng });
  await expect(page.getByText('inspection.png 1 KB', { exact: true })).toBeVisible();
  await expect(page.getByText('Загружен')).toBeVisible();
  expect(mutations.filter(({ method, path }) => method === 'POST' && path === '/vision/sessions/41/assets')).toHaveLength(1);

  const findingCard = page.getByRole('article', { name: 'Находка №81' });
  await expect(findingCard).toBeVisible();
  const publishObject = findingCard.getByRole('combobox', { name: t('vision:publish.object'), exact: true });
  await publishObject.fill('Северный');
  await expect.poll(() => objectListRequests.some((request) => request.searchParams.get('q') === 'Северный' && request.searchParams.get('territory_id') === '1')).toBe(true);

  rejectNextUpload = true;
  await page.getByTestId('vision-file-input').setInputFiles({ name: 'stale-upload.png', mimeType: 'image/png', buffer: transparentPng });
  await staleUploadRequest;
  await page.evaluate(() => localStorage.setItem('saq_token', 'mock-vision-new-session'));
  releaseStaleUpload();
  await expect(page.getByText('Ошибка', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/vision\/41$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('saq_token'))).toBe('mock-vision-new-session');
  expect(staleUploadAuthorization).toBe('Bearer mock-vision-fixture');
  await page.evaluate(() => localStorage.setItem('saq_token', 'mock-vision-fixture'));
  expect(mutations.filter(({ method, path }) => method === 'POST' && path === '/vision/sessions/41/assets')).toHaveLength(2);

  await findingCard.getByRole('button', { name: 'Показать на кадре' }).click();
  const viewer = page.getByRole('dialog', { name: /Кадр/ });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Выделить область' })).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();

  await findingCard.getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await expect(findingCard.getByText('Подтверждено специалистом', { exact: true })).toBeVisible();
  await findingCard.getByRole('textbox', { name: 'Текст рекламы' }).fill('Наружная реклама по fixture');
  await findingCard.getByRole('button', { name: 'Создать наружную рекламу' }).click();
  const reviewMutation = mutations.find(({ path }) => path === '/vision/findings/81/review');
  expect(reviewMutation && JSON.parse(reviewMutation.body ?? '{}')).toMatchObject({ action: 'confirm' });
  const publishMutation = mutations.find(({ path }) => path === '/vision/findings/81/publish-ad');
  expect(publishMutation && JSON.parse(publishMutation.body ?? '{}')).toMatchObject({ text: 'Наружная реклама по fixture', object_id: null });
});

test('light-only theme, language dropdown, and profile actions work across supported widths', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer');
  await page.addInitScript(() => localStorage.setItem('saq_theme', 'dark'));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/work');
  await expect(page.getByRole('heading', { name: 'Сегодня' })).toBeVisible();
  await expectLightOnly(page);
  expect(await page.evaluate(() => localStorage.getItem('saq_theme'))).toBe('dark');
  expect(await page.evaluate(() => getComputedStyle(document.body).fontSize)).toBe('16px');

  const header = page.getByRole('banner');
  const utilities = header.getByRole('group', { name: t('header.utilities') });
  const profile = page.getByTestId('header-user-trigger');
  const language = page.getByTestId('header-language-trigger');
  await expect(language).toContainText('RU');
  await expect(profile).toBeVisible();
  const profileBox = await profile.boundingBox();
  expect(profileBox).not.toBeNull();
  expect(profileBox!.width).toBeGreaterThanOrEqual(44);
  expect(profileBox!.height).toBeGreaterThanOrEqual(44);
  const profileRadius = await profile.evaluate((element) => getComputedStyle(element).borderRadius);
  const profileRadiusPixels = Number.parseFloat(profileRadius);
  expect(profileRadiusPixels).toBeGreaterThanOrEqual(Math.min(profileBox!.width, profileBox!.height) / 2);

  const notificationButton = header.getByRole('button', { name: t('header.notifications') });
  await notificationButton.focus();
  await page.keyboard.press('Enter');
  const notificationPanel = page.getByRole('dialog');
  await expect(notificationPanel).toBeVisible();
  const notificationBox = await notificationPanel.boundingBox();
  expect(notificationBox).not.toBeNull();
  expect(notificationBox!.x).toBeGreaterThanOrEqual(0);
  expect(notificationBox!.x + notificationBox!.width).toBeLessThanOrEqual(1440);
  expect(notificationBox!.y + notificationBox!.height).toBeLessThanOrEqual(900);
  await page.keyboard.press('Escape');
  await expect(notificationPanel).toBeHidden();
  await expect(notificationButton).toBeFocused();

  await profile.focus();
  await page.keyboard.press('Enter');
  const profileMenu = page.getByRole('menu');
  await expect(profileMenu).toBeVisible();
  const askAi = profileMenu.getByTestId('profile-ask-ai-item');
  const largeFont = profileMenu.getByTestId('profile-large-font-item');
  await expect(askAi).toHaveAttribute('role', 'menuitemcheckbox');
  await expect(largeFont).toHaveAttribute('role', 'menuitemcheckbox');
  await expect(profileMenu.getByTestId('profile-logout-item')).toBeVisible();
  await screenshot(page, 'profile-menu-desktop');
  await askAi.click();
  const assistant = page.getByRole('complementary', { name: 'Спросить ИИ' });
  await expect(assistant).toBeVisible();
  await expect(assistant.getByRole('textbox', { name: 'Сообщение ассистенту' })).toBeFocused();
  await screenshot(page, 'profile-open-assistant-desktop');
  await page.keyboard.press('Escape');
  await expect(assistant).toBeHidden();
  await expect(profile).toBeFocused();
  await setLargeFont(page, true);
  await page.reload();
  await expectLightOnly(page);
  expect(await page.locator('html').getAttribute('data-font')).toBe('large');
  await setLargeFont(page, false);

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(header).toBeVisible();
    await expect(utilities).toBeVisible();
    await expectLightOnly(page);
    const measurement = await page.evaluate(() => {
      const utilityGroup = document.querySelector<HTMLElement>('header [role="group"][aria-label]');
      if (!utilityGroup) throw new Error('Missing header utilities');
      const visible = (element: Element) => getComputedStyle(element).display !== 'none';
      const targets = Array.from(utilityGroup.querySelectorAll<HTMLElement>('button')).filter((target) => {
        if (!visible(target)) return false;
        const rect = target.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        targets: targets.map((target) => {
          const rect = target.getBoundingClientRect();
          return { width: rect.width, height: rect.height, right: rect.right };
        }),
      };
    });
    expect(measurement.scrollWidth, `page must not overflow horizontally at ${width}px`).toBeLessThanOrEqual(measurement.clientWidth);
    expect(measurement.targets.length).toBeGreaterThan(0);
    for (const target of measurement.targets) {
      expect(target.width, `header target width at ${width}px`).toBeGreaterThanOrEqual(44);
      expect(target.height, `header target height at ${width}px`).toBeGreaterThanOrEqual(44);
      expect(target.right, `header target must fit at ${width}px`).toBeLessThanOrEqual(width + 1);
    }
    if (width === 320 || width === 1440) await screenshot(page, `header-layout-${width}`);

    await language.click();
    const languageMenu = page.getByRole('menu');
    const ru = languageMenu.getByTestId('header-language-option-ru');
    const kk = languageMenu.getByTestId('header-language-option-kk');
    await expect(ru).toHaveAttribute('role', 'menuitemradio');
    await expect(kk).toHaveAttribute('role', 'menuitemradio');
    for (const option of [ru, kk]) {
      const box = await option.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    }
    await screenshot(page, `language-menu-${width}`);
    await page.keyboard.press('Escape');
    await expect(languageMenu).toBeHidden();
    await expect(language).toBeFocused();
    if (width === 390) {
      await profile.focus();
      await page.keyboard.press('Enter');
      await expect(profileMenu).toBeVisible();
      await profileMenu.getByTestId('profile-ask-ai-item').click();
      const mobileAssistant = page.getByRole('complementary', { name: 'Спросить ИИ' });
      await expect(mobileAssistant.getByRole('textbox', { name: 'Сообщение ассистенту' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(mobileAssistant).toBeHidden();
      await expect(profile).toBeFocused();
    }
  }

  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/home');
  const bento = page.getByTestId('bento-navigation');
  await expect(page.locator('aside')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const assertHomeLabelsFit = async (language: 'ru' | 'kk') => {
    const labels = await bento.locator('nav[aria-label]').first().locator('[data-testid^="bento-nav-card-"]').evaluateAll((links) =>
      links.map((link) => {
        const article = link.closest('article');
        const label = link.querySelector<HTMLElement>(':scope > span:nth-of-type(2) > span');
        if (!article || !label) return { id: link.getAttribute('data-testid'), missing: true, textRight: 0, cardRight: 0, scrollWidth: 0, clientWidth: 0, wordRectCounts: [] };
        const cardBounds = article.getBoundingClientRect();
        const textBounds = label.getBoundingClientRect();
        const textNode = label.firstChild;
        const text = textNode?.textContent ?? '';
        const wordRectCounts = textNode?.nodeType === Node.TEXT_NODE
          ? Array.from(text.matchAll(/\S+/g), (match) => {
            const range = document.createRange();
            const start = match.index ?? 0;
            range.setStart(textNode, start);
            range.setEnd(textNode, start + match[0].length);
            return range.getClientRects().length;
          })
          : [];
        return { id: link.getAttribute('data-testid'), missing: false, textRight: textBounds.right, cardRight: cardBounds.right, scrollWidth: label.scrollWidth, clientWidth: label.clientWidth, wordRectCounts };
      }),
    );
    expect(labels.length, `${language} home must render role-available navigation cards`).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label.missing, `${language} ${label.id} title must be in the tile`).toBe(false);
      if (!label.missing) {
        expect(label.textRight, `${language} ${label.id} title must fit its tile`).toBeLessThanOrEqual(label.cardRight + 1);
        expect(label.scrollWidth, `${language} ${label.id} title words must wrap`).toBeLessThanOrEqual(label.clientWidth + 1);
        expect(label.wordRectCounts.length, `${language} ${label.id} title words must be measurable`).toBeGreaterThan(0);
        for (const rectCount of label.wordRectCounts) {
          expect(rectCount, `${language} ${label.id} title must wrap between words, never through a word`).toBe(1);
        }
      }
    }
  };
  await selectLanguage(page, 'ru');
  await assertHomeLabelsFit('ru');
  await screenshot(page, 'home-mobile-320-ru');
  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await assertHomeLabelsFit('ru');
    if (width === 1024 || width === 1440) await screenshot(page, `home-desktop-${width}-ru`);
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await selectLanguage(page, 'kk');
  await assertHomeLabelsFit('kk');
  await screenshot(page, 'home-mobile-320-kk');
  await selectLanguage(page, 'ru');
  await page.setViewportSize({ width: 390, height: 844 });
  const homeExplore = bento.getByTestId('bento-nav-card-explore');
  await homeExplore.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/home/explore');
  await expect(page.getByRole('navigation', { name: t('nav.groupNavigation', { group: t('nav.sectionExplore') }) })).toBeVisible();
  await expect(bento.getByTestId('bento-leaf-card-map')).toBeVisible();
  await screenshot(page, 'explore-hub-mobile-390');
  await bento.getByTestId('bento-leaf-card-map').click();
  await expect(page).toHaveURL('/map');
  await expect(page.getByTestId('bento-selected-leaf')).toBeVisible();
  await bento.getByTestId('bento-selected-leaf').click();
  await expect(page).toHaveURL('/home/explore');
  await page.getByTestId('bento-home-link').click();
  await expect(page).toHaveURL('/home');
  await page.setViewportSize({ width: 320, height: 844 });
  await selectLanguage(page, 'kk');
  await expect(page.getByRole('heading', { name: tKk('nav.homeTitle') })).toBeVisible();
  await screenshot(page, 'home-kazakh-320');
  await selectLanguage(page, 'ru');
  await expectLightOnly(page);
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);

  const browser = page.context().browser();
  if (!browser) throw new Error('Missing browser for light-only login screenshots');
  const loginContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'ru-RU' });
  try {
    const loginPage = await loginContext.newPage();
    await loginPage.route('**/api/v1/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Unauthenticated' }) }));
    await loginPage.addInitScript(() => localStorage.setItem('saq_theme', 'dark'));
    await loginPage.goto(new URL('/login', page.url()).toString());
    await expect(loginPage.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();
    await expect(loginPage).toHaveTitle('SAQ QURYLYS');
    await expect(loginPage.getByText('SAQ QURYLYS', { exact: true })).toBeVisible();
    await expectLightOnly(loginPage);
    const faviconHref = await loginPage.locator('link[rel="icon"]').getAttribute('href');
    expect(faviconHref).toBe('/saq-qurylys-mark.svg');
    const faviconResponse = await loginPage.request.get(new URL(faviconHref!, loginPage.url()).toString());
    expect(faviconResponse.status()).toBe(200);
    expect(faviconResponse.headers()['content-type']).toContain('image/svg+xml');

    for (const { width, height } of [
      { width: 320, height: 600 },
      { width: 320, height: 844 },
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await loginPage.setViewportSize({ width, height });
      await expectLightOnly(loginPage);
      const languageTrigger = loginPage.getByTestId('header-language-trigger');
      const brand = loginPage.locator('img[src="/saq-qurylys-mark.svg"]');
      const triggerBox = await languageTrigger.boundingBox();
      const brandBox = await brand.boundingBox();
      expect(triggerBox).not.toBeNull();
      expect(brandBox).not.toBeNull();
      expect(triggerBox!.x).toBeGreaterThanOrEqual(0);
      expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(width);
      expect(triggerBox!.y + triggerBox!.height).toBeLessThanOrEqual(height);
      await languageTrigger.click();
      await expect(loginPage.getByTestId('header-language-option-ru')).toBeVisible();
      await screenshot(loginPage, `login-language-${width}`);
      await loginPage.keyboard.press('Escape');
      await expect(languageTrigger).toBeFocused();
    }
  } finally {
    await loginContext.close();
  }
});

test('map filters by zone, selects a real object and opens its dossier under dark OS settings', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer');
  await page.route('https://tiles.openfreemap.org/styles/**', (route) => route.fulfill({
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({
      version: 8,
      sources: {},
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8ecf2' } }],
    }),
  }));
  await page.goto('/map');
  await expect(page.getByRole('main').getByRole('heading', { name: 'Карта объектов' })).toBeVisible();
  await screenshot(page, 'map-light-1440');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expectLightOnly(page);
  await screenshot(page, 'map-light-under-dark-os-1440');

  const zones = page.getByRole('group', { name: /Количество объектов по зонам/ });
  const yellow = zones.getByRole('button').nth(1);
  await yellow.click();
  await expect(yellow).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: /ЖК Северный бриз/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /ЖК Радужный парк/ })).toHaveCount(0);
  const inspect = page.getByRole('button', { name: 'Выбрать объект: ЖК Северный бриз' });
  await inspect.click();
  await expect(inspect).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Объекты по убыванию риска' }).getByRole('heading', { name: 'ЖК Северный бриз' })).toBeVisible();
  await page.getByRole('link', { name: 'Открыть карточку объекта' }).click();
  await expect(page).toHaveURL(/\/objects\/7$/);
  expect(harness.unexpected).toEqual([]);
  expect(harness.mutations).toEqual([]);
  expect(harness.pageErrors).toEqual([]);
});

test('graph search selects an object node and opens its real dossier', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer');
  await page.goto('/graph');
  await expect(page.getByRole('main').getByRole('heading', { name: 'Граф связей' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Граф связей' })).toBeVisible();
  await screenshot(page, 'graph-light-1440');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expectLightOnly(page);
  await screenshot(page, 'graph-light-under-dark-os-1440');

  await page.getByRole('textbox', { name: 'Поиск в графе' }).fill('Северный бриз');
  await page.getByRole('button', { name: 'ЖК Северный бриз Объект (цвет — зона)' }).click();
  const inspector = page.getByRole('complementary', { name: 'Выбранная связь' });
  await expect(inspector.getByRole('heading', { name: 'ЖК Северный бриз' })).toBeVisible();
  await expect(inspector.getByText('Связано с узлами: 2')).toBeVisible();
  await inspector.getByRole('button', { name: 'Открыть' }).click();
  await expect(page).toHaveURL(/\/objects\/7$/);
  expect(harness.unexpected).toEqual([]);
  expect(harness.mutations).toEqual([]);
  expect(harness.pageErrors).toEqual([]);
});

test('activity notification opens below the sticky header and navigates to its event', async ({ page }) => {
  const event: ActivityEvent = {
    id: 'signal_created:ui-42',
    kind: 'signal_created',
    at: '2026-10-16T11:30:00Z',
    object_id: 7,
    object_name: objectRow.name,
    ad_id: null,
    signal_id: 42,
    origin: 'manual',
    platform: null,
    score_before: null,
    score_after: null,
    zone_before: null,
    zone_after: null,
    number: 'SIG-UI-0042',
    is_demo: false,
  };
  const harness = await installMocks(page, 'mio_officer', { activityEvents: [] });
  await page.setViewportSize({ width: 1440, height: 900 });
  const initialActivityPoll = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/activity');
  await page.goto('/work');
  await initialActivityPoll;
  harness.state.activityEvents = [event];

  const activity = page.getByRole('button', { name: /SIG-UI-0042/ });
  await expect(activity).toBeVisible();
  await expect(page.getByText('Мониторинг', { exact: true })).toBeHidden();
  await activity.hover();
  const liveRegion = page.getByTestId('activity-live-region');
  await expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  await expect(liveRegion).toContainText('SIG-UI-0042');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await activity.hover();
    const metrics = await page.evaluate(() => {
      const header = document.querySelector('header');
      const island = document.querySelector<HTMLElement>('[data-open="true"][data-place="below"]');
      if (!header || !island) throw new Error('Open activity island was not placed below the header');
      const headerRect = header.getBoundingClientRect();
      const islandRect = island.getBoundingClientRect();
      return {
        headerBottom: headerRect.bottom,
        islandLeft: islandRect.left,
        islandRight: islandRect.right,
        islandTop: islandRect.top,
        islandBottom: islandRect.bottom,
        viewportWidth: document.documentElement.clientWidth,
      };
    });
    expect(metrics.islandTop, `activity popover must clear header at ${width}px`).toBeGreaterThanOrEqual(metrics.headerBottom + 7);
    expect(metrics.islandLeft, `activity popover left bound at ${width}px`).toBeGreaterThanOrEqual(16);
    expect(metrics.islandRight, `activity popover right bound at ${width}px`).toBeLessThanOrEqual(metrics.viewportWidth - 16);
    expect(metrics.islandBottom).toBeGreaterThan(metrics.islandTop);
    if (width === 320) await screenshot(page, 'monitoring-activity-open-320');
  }
  await activity.click();
  await expect(page).toHaveURL(/\/signals\/42$/);
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('mobile object next-step anchors clear the sticky header and available signal action is explicit', async ({ page }) => {
  const longName = `ЖК Северный бриз — ${'очень длинное название объекта '.repeat(5)}`;
  const harness = await installMocks(page, 'mio_officer', { object: makeObject('yellow', longName), assignments: [makeAssignment()] });
  let assignmentsResolved = false;
  await page.route('**/api/v1/objects/7/assignments', async (route) => {
    if (route.request().method() === 'GET') {
      await page.waitForTimeout(1200);
      assignmentsResolved = true;
    }
    await route.fallback();
  });
  const measures: Array<{ width: number; headerBottom: number; targetTop: number; gap: number }> = [];

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/objects/7');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toContainText('ЖК Северный бриз');
    await expect(page.getByRole('button', { name: 'Создать карточку вручную' })).toBeVisible();
    if (width === 390) {
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('bento-home-link')).toBeFocused();
    }
    const anchor = page.getByRole('link', { name: 'К причинам оценки' });
    await anchor.click();
    await expect(page).toHaveURL(/#risk$/);
    const measurement = await page.evaluate(() => {
      const header = document.querySelector('header');
      const target = document.querySelector('#risk');
      if (!header || !target) throw new Error('Missing sticky header or #risk anchor');
      const headerBottom = header.getBoundingClientRect().bottom;
      const targetTop = target.getBoundingClientRect().top;
      return { headerBottom, targetTop, gap: targetTop - headerBottom };
    });
    measures.push({ width, ...measurement });
    expect.soft(measurement.targetTop, `#risk must clear the sticky header at ${width}px`).toBeGreaterThanOrEqual(measurement.headerBottom);
    const pageWidth = await page.evaluate(() => ({ inner: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    expect.soft(pageWidth.scroll, `long object names must not cause horizontal overflow at ${width}px`).toBeLessThanOrEqual(pageWidth.inner);
    if (width === 390) await screenshot(page, 'object-mobile-390-risk');
  }

  await page.setViewportSize({ width: 320, height: 844 });
  assignmentsResolved = false;
  const assignmentsResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/objects/7/assignments');
  await page.goto('/objects/7#risk');
  const riskTarget = page.locator('#risk');
  await expect(riskTarget).toBeVisible();
  expect(assignmentsResolved).toBe(false);
  const initialRiskBox = await riskTarget.boundingBox();
  expect(initialRiskBox).not.toBeNull();
  await assignmentsResponse;
  await expect.poll(() => assignmentsResolved).toBe(true);
  await expect.poll(async () => {
    const [headerBottom, riskTop] = await page.evaluate(() => [
      document.querySelector('header')?.getBoundingClientRect().bottom ?? Infinity,
      document.querySelector('#risk')?.getBoundingClientRect().top ?? -Infinity,
    ]);
    return riskTop - headerBottom;
  }).toBeGreaterThanOrEqual(0);
  const settledRiskBox = await riskTarget.boundingBox();
  expect(settledRiskBox).not.toBeNull();
  expect(settledRiskBox!.y).toBeLessThan(844);
  await screenshot(page, 'object-mobile-320-cold-risk-after-assignments');

  await writeFile(`${screenshotDir}/object-anchor-offsets.json`, JSON.stringify(measures, null, 2));
  await test.info().attach('object-anchor-offsets.json', {
    body: Buffer.from(JSON.stringify(measures, null, 2)),
    contentType: 'application/json',
  });
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('object hash links activate the section and scroll document, inspection, and complaint anchors into view', async ({ page }) => {
  const object = makeRegistryObject();
  object.inspections = [{ id: 61, object_id: 7, inspected_at: '2026-10-16T10:00:00Z', readiness_pct: 30, lat: null, lon: null, inspector_id: 1, note: 'Fixture inspection', evidence: [] }];
  object.complaints = [{ id: 62, object_id: 7, received_at: '2026-10-16T10:00:00Z', source: 'eotinish', external_id: null, is_collective: true, signatories_count: 3, summary: 'Fixture complaint', status: 'new', confirmed_payments: false, is_verified: false, verified_by: null, verified_at: null }];
  const harness = await installMocks(page, 'mio_officer', { object, evidenceContents: registryContentFixtures() });
  harness.expectedCancelledEvidenceIds.add(5190);
  for (const hash of ['#documents', '#inspection-61', '#complaint-62']) {
    await page.goto(`/objects/7${hash}`);
    const target = page.locator(hash);
    await expect(target).toBeVisible();
    const targetRect = await target.boundingBox();
    expect(targetRect).not.toBeNull();
    expect(targetRect!.y).toBeGreaterThanOrEqual(0);
    expect(targetRect!.y).toBeLessThan(900);
    if (hash === '#inspection-61') await expect(page.getByRole('tab', { name: 'Материалы и проверки' })).toHaveAttribute('aria-selected', 'true');
    if (hash === '#documents') await expect(page.getByRole('tab', { name: 'Проверка' })).toHaveAttribute('aria-selected', 'true');
  }
  expectCleanBrowser(harness);
});

test('registry answers show readable latest data, group identical captures and preserve file evidence', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer', {
    object: makeRegistryObject(),
    evidenceContents: registryContentFixtures(),
  });
  await page.goto('/objects/7');

  const registryAction = page.getByRole('button', { name: 'Открыть сохранённые сведения из реестра' });
  await expect(registryAction).toHaveCount(1);
  await expect(registryAction).toContainText('2 версии');

  const photo = page.getByRole('img', { name: 'Фото #5190' });
  await expect(photo).toBeVisible();
  await page.getByRole('button', { name: 'Фото #5190' }).click();
  const photoDialog = page.getByRole('dialog', { name: 'Фото #5190' });
  await expect(photoDialog.getByRole('img', { name: 'Фото #5190' })).toBeVisible();
  harness.expectedCancelledEvidenceIds.add(5190);
  await page.keyboard.press('Escape');
  await expect(photoDialog).toBeHidden();

  const pdfButton = page.getByRole('button', { name: 'PDF', exact: true });
  await expect(pdfButton).toBeVisible();
  const pdfResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/evidence/5191/content');
  await pdfButton.click();
  await pdfResponse;

  await registryAction.click();
  const dialog = page.getByRole('dialog', { name: 'Сведения из реестра' });
  await expect(dialog.getByText('ЖК Учебный дом · актуальные сведения', { exact: true })).toBeVisible();
  await expect(dialog.getByText('г. Учебный, ул. Примерная, 1', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Орган выдачи тестовых гарантий', { exact: true })).toBeVisible();
  await expect(dialog.getByText('ГАРАНТИЯ-ТЕСТ-002', { exact: true })).toBeVisible();
  await expect(dialog.getByText('ТОО Учебный застройщик', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Название объекта', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Основание', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Номер документа', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Дата выдачи', { exact: true })).toBeVisible();
  await expect(dialog.getByText('16.10.2026', { exact: true })).toBeVisible();
  await expect(dialog).not.toContainText('"success":true');
  await expect(dialog).not.toContainText('Object Details retrieved successfully');
  await expect(dialog.getByText(/Последняя сохранённая версия/)).toContainText('#5183');

  const versionSelect = dialog.getByLabel('Сохранённые версии');
  await expect(versionSelect).toHaveValue(`sha:${registryShaB}`);
  await expect(versionSelect.locator('option')).toHaveCount(2);
  const history = dialog.getByText('История сохранений (3)', { exact: true });
  await history.click();
  const historyList = dialog.locator('details').last();
  for (const id of [5181, 5182, 5183]) await expect(historyList.getByText(new RegExp(`#${id}`))).toBeVisible();
  await screenshot(page, 'registry-response-history');

  harness.expectedCancelledEvidenceIds.add(5183);
  await versionSelect.selectOption(`sha:${registryShaA}`);
  await expect(dialog.getByText('ЖК Учебный дом', { exact: true })).toBeVisible();
  await expect(dialog.getByText('ГАРАНТИЯ-ТЕСТ-001', { exact: true })).toBeVisible();
  await expect(dialog.getByText('ЖК Учебный дом · актуальные сведения', { exact: true })).toHaveCount(0);
  harness.expectedCancelledEvidenceIds.add(5182);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await registryAction.click();
  const reopened = page.getByRole('dialog', { name: 'Сведения из реестра' });
  await expect(reopened.getByLabel('Сохранённые версии')).toHaveValue(`sha:${registryShaB}`);
  await expect(reopened.getByText('ЖК Учебный дом · актуальные сведения', { exact: true })).toBeVisible();
  await screenshot(page, 'registry-response-latest');
  await page.setViewportSize({ width: 320, height: 844 });
  const mobileDialogBox = await reopened.boundingBox();
  expect(mobileDialogBox).not.toBeNull();
  expect(mobileDialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(mobileDialogBox!.x + mobileDialogBox!.width).toBeLessThanOrEqual(320);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await screenshot(page, 'registry-response-latest-320');
  await page.screenshot({ path: `${screenshotDir}/registry-response-latest-320-viewport.png` });
  const dialogHasScrollableContent = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return false;
    return [dialog, ...dialog.querySelectorAll<HTMLElement>('*')].some((element) => {
      const style = getComputedStyle(element);
      return element.scrollHeight > element.clientHeight + 1 && ['auto', 'scroll'].includes(style.overflowY);
    });
  });
  expect(dialogHasScrollableContent).toBe(true);
  await page.mouse.move(160, 720);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return false;
    return [dialog, ...dialog.querySelectorAll<HTMLElement>('*')].some((element) => element.scrollTop > 0);
  })).toBe(true);
  harness.expectedCancelledEvidenceIds.add(5183);
  await page.keyboard.press('Escape');
  await expect(reopened).toBeHidden();

  expect(harness.evidenceRequests.length).toBeGreaterThanOrEqual(3);
  expect(harness.evidenceRequests.every((request) => request.authorization === 'Bearer mock-ui-session')).toBe(true);
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('registry response reports unsupported and malformed archives and keeps the original download', async ({ page }) => {
  const object = makeRegistryObject();
  object.documents[0].evidence = [
    makeEvidence(5301, 'registry_response', 'application/json', 'e'.repeat(64), '2026-10-14T09:00:00Z'),
    makeEvidence(5302, 'registry_response', 'application/json', 'f'.repeat(64), '2026-10-16T11:00:00Z'),
  ];
  const harness = await installMocks(page, 'mio_officer', {
    object,
    evidenceContents: {
      5301: { contentType: 'application/json', body: '{not-json' },
      5302: { contentType: 'application/json', body: '{"success":true,"data":{"unrecognized":{}}}' },
    },
  });
  await page.goto('/objects/7');
  await page.getByRole('button', { name: 'Открыть сохранённые сведения из реестра' }).click();
  const dialog = page.getByRole('dialog', { name: 'Сведения из реестра' });
  await expect(dialog.getByText('Формат сохранённого ответа не распознан. Оригинал можно скачать.')).toBeVisible();
  await expect(dialog).not.toContainText('"success":true');

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Скачать исходный ответ' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('registry-response-5302.json');
  await expect.poll(() => harness.evidenceRequests.some((request) => request.id === 5302)).toBe(true);

  harness.expectedCancelledEvidenceIds.add(5302);
  await dialog.getByLabel('Сохранённые версии').selectOption(`sha:${'e'.repeat(64)}`);
  await expect(dialog.getByText('Сохранённый ответ повреждён или не читается как JSON. Оригинал можно скачать.')).toBeVisible();
  expect(harness.evidenceRequests.filter((request) => request.id === 5301).length).toBeGreaterThanOrEqual(1);
  expect(harness.evidenceRequests.every((request) => request.authorization === 'Bearer mock-ui-session')).toBe(true);
  expect(harness.mutations).toEqual([]);
  harness.expectedCancelledEvidenceIds.add(5301);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expectCleanBrowser(harness);
});

test('registry response load failure offers a working retry', async ({ page }) => {
  const object = makeRegistryObject();
  object.documents[0].evidence = [
    makeEvidence(5401, 'registry_response', 'application/json', '9'.repeat(64), '2026-10-16T11:00:00Z'),
  ];
  const harness = await installMocks(page, 'mio_officer', {
    object,
    evidenceContents: {
      5401: { contentType: 'application/json', body: registryResponseJson('ЖК Повторная проверка', 'ГАРАНТИЯ-ТЕСТ-003') },
    },
    evidenceFailures: { 5401: 2 },
  });
  await page.goto('/objects/7');
  await page.getByRole('button', { name: 'Открыть сохранённые сведения из реестра' }).click();
  const dialog = page.getByRole('dialog', { name: 'Сведения из реестра' });
  await expect(dialog.getByRole('alert')).toContainText('Не удалось загрузить сохранённый ответ. Повторите попытку или скачайте оригинал.');
  const evidenceRequests = () => harness.evidenceRequests.filter((request) => request.id === 5401);
  await expect.poll(() => evidenceRequests().length).toBe(2);
  await dialog.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(dialog.getByText('ЖК Повторная проверка', { exact: true })).toBeVisible();
  expect(evidenceRequests()).toHaveLength(3);
  expect(harness.evidenceRequests.every((request) => request.authorization === 'Bearer mock-ui-session')).toBe(true);
  expect(harness.mutations).toEqual([]);
  harness.expectedCancelledEvidenceIds.add(5401);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expectCleanBrowser(harness);
});

test('object review reuses an open card, suppresses creation on stale lookup, and retries safely', async ({ page }) => {
  const active = makeSignal('returned', 'gask');
  active.number = 'SIG-OPEN-7';
  const existing = await installMocks(page, 'mio_officer', { signals: [active] });
  await page.goto('/objects/7');
  await expect(page.getByText(/уже есть открытая карточка проверки SIG-OPEN-7/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Открыть карточку проверки' })).toHaveAttribute('href', '/signals/42');
  await expect(page.getByRole('button', { name: 'Создать карточку вручную' })).toHaveCount(0);
  expect(existing.mutations).toEqual([]);
  expectCleanBrowser(existing);

  const failed = await installMocks(page, 'mio_officer', { failReturnedCount: 2 });
  await page.goto('/objects/7');
  await expect(page.getByRole('alert').filter({ hasText: 'Не удалось проверить карточки объекта' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Создать карточку вручную' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Проверить снова' }).click();
  await expect(page.getByRole('button', { name: 'Создать карточку вручную' })).toBeVisible();
  expect(failed.listRequests.filter((url) => url.searchParams.get('status') === 'returned')).toHaveLength(3);
  expect(failed.mutations).toEqual([]);
  expect(failed.unexpected).toEqual([]);
  expect(failed.pageErrors).toEqual([]);
  expect(failed.failedApiRequests).toEqual([]);
  expect(failed.consoleErrors).toEqual([
    'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
    'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
  ]);
  await screenshot(page, 'object-review-retried');
});

test('ad review makes AI scope visible, confirms the match and reports object-link changes', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer');
  await page.goto('/ads?ad=11');
  const article = page.getByRole('article', { name: t('ads:card.label', { id: 11 }) });
  await expect(article).toBeVisible();
  await article.locator('details').filter({ hasText: t('ads:llm.badge') }).locator('summary').click();
  const aiPanel = page.getByRole('region', { name: 'Подсказки ИИ' });
  await expect(aiPanel).toBeVisible();
  await expect(aiPanel.getByText('Схемы оплаты', { exact: true })).toBeVisible();
  await expect(aiPanel.getByText('Рассрочка', { exact: true })).toBeVisible();
  await expect(aiPanel.getByText('Готовность', { exact: true })).toBeVisible();
  await expect(aiPanel.getByText('65%', { exact: true })).toBeVisible();
  await expect(aiPanel.getByText('Цена до сдачи', { exact: true })).toBeVisible();
  await expect(aiPanel.getByText('заявление найдено', { exact: true })).toBeVisible();
  await screenshot(page, 'ads-llm-before-review');

  await page.getByRole('button', { name: 'Подтвердить сведения ИИ' }).click();
  await expect(aiPanel.getByRole('status').filter({ hasText: /Сохранено то, что подтверждает текст/ })).toBeVisible();
  await expect(aiPanel.getByRole('status')).toContainText('Проверьте связь и откройте объект.');
  await expect.poll(() => harness.mutations.some((item) => item.path === '/ads/11/accept-llm')).toBe(true);
  expect(harness.mutations.filter((item) => item.method === 'POST' && item.path === '/ads/11/accept-llm')).toHaveLength(1);

  await page.getByRole('button', { name: t('ads:link.confirm') }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Связь подтверждена.' })).toBeVisible();
  const confirmed = harness.mutations.find((item) => item.method === 'PATCH' && item.path === '/ads/11');
  expect(confirmed?.body).toEqual({ status: 'captured' });

  await page.getByRole('button', { name: 'Изменить объект' }).click();
  const objectSelect = page.getByRole('combobox', { name: 'Объект' }).last();
  await objectSelect.fill('Малахит');
  await page.getByRole('option', { name: /D-08 · ЖК Малахит/ }).click();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Привязка сохранена. Сверьте, что публикация относится к выбранному объекту.' })).toBeVisible();
  const linkMutation = harness.mutations.find((item) => item.method === 'PATCH' && item.path === '/ads/11' && (item.body as { object_id?: number }).object_id === 8);
  expect(linkMutation?.body).toEqual({ object_id: 8 });
  await screenshot(page, 'ads-llm-object-confirmed');
  expectCleanBrowser(harness);
});

test('legacy ad unlink requires an explicit city and sends it to the API', async ({ page }) => {
  const ad = makeReviewAd(81, {
    status: 'captured',
    object_id: 7,
    object_name: objectRow.name,
    linked_object: { id: 7, code: objectRow.code, name: objectRow.name },
    unlinked_territory_id: null,
    unlinked_territory_saved: false,
    phrase_hits: [],
  });
  const harness = await installMocks(page, 'mio_officer', { ads: [ad], territories: [cityTerritory] });

  await page.goto('/ads?ad=81');
  const card = page.getByRole('article', { name: t('ads:card.label', { id: ad.id }) });
  await card.getByRole('button', { name: t('ads:link.change') }).click();
  const popover = page.locator('[data-slot="popover-content"]').last();
  await popover.getByRole('button', { name: t('common:ui.clear') }).click();

  const citySelect = popover.getByRole('combobox', { name: t('ads:link.unlinkCity') });
  await expect(citySelect).toBeVisible();
  const save = popover.getByRole('button', { name: t('common:save') });
  await expect(save).toBeDisabled();
  await citySelect.click();
  await page.getByRole('option', { name: cityTerritory.name, exact: true }).click();
  await expect(save).toBeEnabled();
  await save.click();

  const unlinkMutation = harness.mutations.find(({ method, path }) => method === 'PATCH' && path === '/ads/81');
  expect(unlinkMutation?.body).toEqual({ object_id: null, territory_id: cityTerritory.id });
  expectCleanBrowser(harness);
});

test('known baseline ad unlink restores its city without asking for another choice', async ({ page }) => {
  const ad = makeReviewAd(82, {
    status: 'captured',
    object_id: 7,
    object_name: objectRow.name,
    linked_object: { id: 7, code: objectRow.code, name: objectRow.name },
    unlinked_territory_id: 1,
    unlinked_territory_saved: true,
    phrase_hits: [],
  });
  const harness = await installMocks(page, 'mio_officer', { ads: [ad] });

  await page.goto('/ads?ad=82');
  const card = page.getByRole('article', { name: t('ads:card.label', { id: ad.id }) });
  await card.getByRole('button', { name: t('ads:link.change') }).click();
  const popover = page.locator('[data-slot="popover-content"]').last();
  await popover.getByRole('button', { name: t('common:ui.clear') }).click();

  await expect(popover.getByRole('combobox', { name: t('ads:link.unlinkCity') })).toHaveCount(0);
  await popover.getByRole('button', { name: t('common:save') }).click();
  const unlinkMutation = harness.mutations.find(({ method, path }) => method === 'PATCH' && path === '/ads/82');
  expect(unlinkMutation?.body).toEqual({ object_id: null });
  expectCleanBrowser(harness);
});

test('known no-territory baseline unlinks without asking for a city', async ({ page }) => {
  const ad = makeReviewAd(83, {
    status: 'captured',
    territory_id: null,
    object_id: 7,
    object_name: objectRow.name,
    linked_object: { id: 7, code: objectRow.code, name: objectRow.name },
    unlinked_territory_id: null,
    unlinked_territory_saved: true,
    phrase_hits: [],
  });
  const harness = await installMocks(page, 'mio_officer', { ads: [ad] });

  await page.goto('/ads?ad=83');
  const card = page.getByRole('article', { name: t('ads:card.label', { id: ad.id }) });
  await card.getByRole('button', { name: t('ads:link.change') }).click();
  const popover = page.locator('[data-slot="popover-content"]').last();
  await popover.getByRole('button', { name: t('common:ui.clear') }).click();

  await expect(popover.getByRole('combobox', { name: t('ads:link.unlinkCity') })).toHaveCount(0);
  await popover.getByRole('button', { name: t('common:save') }).click();
  const unlinkMutation = harness.mutations.find(({ method, path }) => method === 'PATCH' && path === '/ads/83');
  expect(unlinkMutation?.body).toEqual({ object_id: null });
  expectCleanBrowser(harness);
});

test('ads review queue keeps server defaults, guards completion, and advances through persisted triage', async ({ page }) => {
  const first = makeReviewAd(11, {
    status: 'verification',
    object_id: 7,
    linked_object: { id: 7, code: objectRow.code, name: objectRow.name },
    phrase_hits: [{
      id: 111, ad_post_id: 11, phrase_id: 1, category: 'booking', matched_text: 'Бронирование квартир', start: 0, end: 20,
      weight: 2, detected_by: 'dictionary', confirmed: null, confirmed_by: null,
    }],
    queue_reasons: ['uncertain_object', 'unreviewed_phrase_hits'],
  });
  const second = makeReviewAd(12, {
    status: 'captured', object_id: null, object_name: null, linked_object: null,
    review_state: 'unreviewed', queue_reasons: ['manual_review'],
  });
  const retry = makeReviewAd(13, {
    status: 'captured', object_id: null, object_name: null, linked_object: null,
    review_state: 'reviewed', queue_reasons: ['ocr_pending'], ocr_status: 'pending',
  });
  const harness = await installMocks(page, 'mio_officer', { ads: [first, second, retry] });

  await page.goto('/ads?queue=true');
  await expect(page.getByRole('button', { name: 'Публикация №11' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Публикация №12' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Публикация №13' })).toBeVisible();
  await expect.poll(() => harness.adListRequests.some((url) => url.searchParams.get('queue') === 'true' && !url.searchParams.has('review_state'))).toBe(true);
  const reviewedAction = page.getByRole('button', { name: 'Отметить разобранной' });
  await expect(reviewedAction).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Отметить нерелевантной' })).toBeEnabled();
  expect(harness.mutations.filter(({ path }) => path.endsWith('/accept-llm'))).toEqual([]);

  await page.getByRole('button', { name: t('ads:hits.confirmDictionary') }).click();
  await page.getByRole('button', { name: t('ads:link.confirm') }).click();
  await expect(reviewedAction).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Отметить нерелевантной' })).toBeDisabled();
  await reviewedAction.click();
  await expect(page).toHaveURL(/\/ads\?queue=true&ad=11$/);
  await expect(page.getByText('Состояние проверки сохранено')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Публикация №11' })).toBeVisible();
  expect(harness.state.ads.find((ad) => ad.id === 11)?.review_state).toBe('reviewed');
  expect(harness.state.ads.find((ad) => ad.id === 11)?.queue_reasons).toEqual([]);
  expect(harness.adListRequests.some((url) => url.searchParams.get('queue') === 'true' && !url.searchParams.has('review_state'))).toBe(true);
  expect(harness.adListRequests.some((url) => url.searchParams.get('queue') === 'true' && url.searchParams.get('review_state') === 'unreviewed')).toBe(false);

  await page.getByRole('button', { name: t('ads:review.next') }).click();
  await expect(page).toHaveURL(/\/ads\?queue=true&ad=12$/);
  await expect(page.getByRole('article', { name: 'Публикация №12' })).toBeVisible();
  await page.getByLabel('Заметка для команды').fill('Ждём уточнение источника');
  await page.getByRole('button', { name: 'Отложить' }).click();
  await expect(page).toHaveURL(/\/ads\?queue=true&ad=12$/);
  await expect(page.getByText(t('ads:review.result.deferred'))).toBeVisible();
  expect(harness.state.ads.find((ad) => ad.id === 12)?.review_note).toBe('Ждём уточнение источника');
  await page.getByRole('button', { name: t('ads:review.next') }).click();
  await expect(page).toHaveURL(/\/ads\?queue=true&ad=13$/);
  await expect(page.getByRole('button', { name: 'Публикация №13' })).toBeVisible();
  await expect(page.getByText('Текст с изображений ещё распознаётся')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отметить разобранной' })).toBeDisabled();

  const stateSelect = page.getByRole('combobox', { name: 'Состояние проверки' });
  await stateSelect.click();
  await page.getByRole('option', { name: 'Отложено' }).click();
  await expect(page).toHaveURL(/review_state=deferred/);
  await page.getByRole('button', { name: 'Публикация №12' }).click();
  await expect(page.getByRole('article', { name: 'Публикация №12' })).toBeVisible();
  await expect(page.getByLabel('Заметка для команды')).toHaveValue('Ждём уточнение источника');
  await page.getByRole('button', { name: 'Вернуть на проверку' }).click();
  await expect(page).toHaveURL(/\/ads\?queue=true&ad=12$/);
  await expect(page.getByRole('article', { name: 'Публикация №12' })).toBeVisible();
  expect(harness.state.ads.find((ad) => ad.id === 12)?.review_state).toBe('unreviewed');
  expect(harness.state.ads.find((ad) => ad.id === 12)?.review_note).toBe('Ждём уточнение источника');
  expect(harness.mutations.filter(({ method, path }) => method === 'PATCH' && path.endsWith('/triage')).map(({ body }) => body)).toEqual([
    { state: 'reviewed', note: null },
    { state: 'deferred', note: 'Ждём уточнение источника' },
    { state: 'unreviewed', note: 'Ждём уточнение источника' },
  ]);
  expect(harness.mutations.filter(({ path }) => path.endsWith('/accept-llm'))).toEqual([]);
  expect(harness.mutations.some(({ path }) => path.includes('/score') || path.includes('/risk'))).toBe(false);
  expectCleanBrowser(harness);
});

test('desktop ad selection keeps the deep list position and bounds long details to the sticky pane', async ({ page }) => {
  const longText = Array.from({ length: 72 }, (_, index) =>
    `Scroll fixture paragraph ${index + 1}: проверяем выбранную публикацию в длинном списке без потери контекста.`,
  ).join('\n');
  const ads = Array.from({ length: 20 }, (_, index) => makeReviewAd(500 + index, {
    author: `@scroll_fixture_${index + 1}`,
    text: index === 19 ? longText : `Scroll fixture publication ${index + 1}`,
    review_state: 'unreviewed',
    queue_reasons: ['manual_review'],
  }));
  const harness = await installMocks(page, 'mio_officer', { ads });
  await page.setViewportSize({ width: 1440, height: 768 });
  await page.goto('/ads?queue=true&platform=instagram&is_demo=false&q=fixture');

  const list = page.getByTestId('ads-list-panel');
  const details = page.getByTestId('ads-details-panel');
  const lastRow = list.locator('[data-ad-id="519"]');
  await expect(lastRow).toBeVisible();
  await lastRow.scrollIntoViewIfNeeded();
  const listPosition = await page.evaluate(() => window.scrollY);
  expect(listPosition).toBeGreaterThan(0);
  await lastRow.click();

  await expect(page).toHaveURL(/ad=519/);
  const selectedArticle = page.getByRole('article', { name: t('ads:card.label', { id: 519 }) });
  await expect(selectedArticle).toBeVisible();
  await selectedArticle.getByRole('button', { name: t('ads:text.expand') }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(listPosition);
  const visiblePane = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('[data-app-header]');
    const pane = document.querySelector<HTMLElement>('[data-testid="ads-details-panel"]');
    const article = pane?.querySelector<HTMLElement>('article[aria-label]');
    const list = document.querySelector<HTMLElement>('[data-testid="ads-list-panel"]');
    if (!header || !pane || !article || !list) throw new Error('Missing app header, publication list, details pane, or selected article');
    const headerBounds = header.getBoundingClientRect();
    const paneBounds = pane.getBoundingClientRect();
    const articleBounds = article.getBoundingClientRect();
    const listBounds = list.getBoundingClientRect();
    return {
      documentScrollY: window.scrollY,
      headerBottom: headerBounds.bottom,
      listTop: listBounds.top,
      listBottom: listBounds.bottom,
      paneTop: paneBounds.top,
      paneBottom: paneBounds.bottom,
      viewportHeight: window.innerHeight,
      paneClientHeight: pane.clientHeight,
      paneScrollHeight: pane.scrollHeight,
      paneScrollTop: pane.scrollTop,
      articleTop: articleBounds.top,
      previousButtonTop: pane.querySelector<HTMLElement>('[aria-label="Предыдущая публикация"]')?.getBoundingClientRect().top,
      nextButtonTop: pane.querySelector<HTMLElement>('[aria-label="Следующая публикация"]')?.getBoundingClientRect().top,
    };
  });
  expect(visiblePane.paneTop).toBeGreaterThanOrEqual(visiblePane.headerBottom);
  expect(visiblePane.paneBottom).toBeLessThanOrEqual(visiblePane.viewportHeight);
  expect(visiblePane.articleTop).toBeGreaterThanOrEqual(visiblePane.headerBottom);
  expect(visiblePane.previousButtonTop).toBeGreaterThanOrEqual(visiblePane.headerBottom);
  expect(visiblePane.nextButtonTop).toBeGreaterThanOrEqual(visiblePane.headerBottom);
  expect(visiblePane.paneScrollHeight).toBeGreaterThan(visiblePane.paneClientHeight);
  expect(visiblePane.paneScrollTop).toBe(0);
  await screenshot(page, 'ads-scroll-desktop-selected-1440x768', false);
  await test.info().attach('ads-scroll-desktop-metrics.json', {
    body: Buffer.from(JSON.stringify({ listPosition, ...visiblePane }, null, 2)),
    contentType: 'application/json',
  });
  await writeFile(`${screenshotDir}/ads-scroll-desktop-metrics.json`, JSON.stringify({ listPosition, ...visiblePane }, null, 2));
  await details.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => details.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const adjacentRow = list.locator('[data-ad-id="518"]');
  await adjacentRow.click();
  await expect(page).toHaveURL(/ad=518/);
  await expect(page.getByRole('article', { name: t('ads:card.label', { id: 518 }) })).toBeVisible();
  await expect.poll(() => details.evaluate((element) => element.scrollTop)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(listPosition);
  const query = new URL(page.url()).searchParams;
  expect(query.get('queue')).toBe('true');
  expect(query.get('platform')).toBe('instagram');
  expect(query.get('is_demo')).toBe('false');
  expect(query.get('q')).toBe('fixture');
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('narrow ad selection is a URL-backed detail step that restores the filtered list and focus', async ({ page }) => {
  const longText = Array.from({ length: 36 }, (_, index) =>
    `Scroll fixture paragraph ${index + 1}: содержимое публикации остаётся доступным в отдельном экране.`,
  ).join('\n');
  const ads = Array.from({ length: 20 }, (_, index) => makeReviewAd(500 + index, {
    author: `@scroll_fixture_${index + 1}`,
    text: index === 19 ? longText : `Scroll fixture publication ${index + 1}`,
    review_state: 'unreviewed',
    queue_reasons: ['manual_review'],
  }));
  const harness = await installMocks(page, 'mio_officer', { ads });

  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/ads?queue=true&platform=instagram&is_demo=false&q=fixture');
    const list = page.getByTestId('ads-list-panel');
    const details = page.getByTestId('ads-details-panel');
    const lastRow = list.locator('[data-ad-id="519"]');
    await expect(lastRow).toBeVisible();
    await expect(details).toBeHidden();
    await lastRow.scrollIntoViewIfNeeded();
    const priorListPosition = await page.evaluate(() => window.scrollY);
    expect(priorListPosition).toBeGreaterThan(0);
    await lastRow.click();

    await expect.poll(() => new URL(page.url()).searchParams.get('ad')).toBe('519');
    await expect(list).toBeHidden();
    await expect(details).toBeVisible();
    const selectedArticle = page.getByRole('article', { name: t('ads:card.label', { id: 519 }) });
    await expect(selectedArticle).toBeVisible();
    await expect(details).toBeFocused();
    await selectedArticle.getByRole('button', { name: t('ads:text.expand') }).click();
    const detailBounds = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('[data-app-header]');
      const pane = document.querySelector<HTMLElement>('[data-testid="ads-details-panel"]');
      if (!header || !pane) throw new Error('Missing app header or publication details pane');
      return {
        documentScrollY: window.scrollY,
        headerBottom: header.getBoundingClientRect().bottom,
        paneTop: pane.getBoundingClientRect().top,
        paneBottom: pane.getBoundingClientRect().bottom,
      };
    });
    expect(detailBounds.paneTop).toBeGreaterThanOrEqual(detailBounds.headerBottom - 1);
    if (width === 390) {
      await screenshot(page, 'ads-mobile-detail-selected-390', false);
      await test.info().attach('ads-mobile-detail-metrics.json', {
        body: Buffer.from(JSON.stringify({ width, priorListPosition, ...detailBounds }, null, 2)),
        contentType: 'application/json',
      });
      await writeFile(`${screenshotDir}/ads-mobile-detail-metrics.json`, JSON.stringify({ width, priorListPosition, ...detailBounds }, null, 2));
    }
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    const detailPageScroll = await page.evaluate(() => window.scrollY);
    expect(detailPageScroll).toBeGreaterThan(0);
    expect(await details.evaluate((element) => element.scrollHeight)).toBeLessThanOrEqual(await details.evaluate((element) => element.clientHeight) + 1);

    await page.goBack();
    await expect.poll(() => new URL(page.url()).searchParams.has('ad')).toBe(false);
    await expect(list).toBeVisible();
    await expect(details).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(priorListPosition);
    await expect(list.locator('[data-ad-id="519"]')).toBeFocused();
    if (width === 390) await screenshot(page, 'ads-mobile-list-restored-390', false);
    let query = new URL(page.url()).searchParams;
    expect(query.get('queue')).toBe('true');
    expect(query.get('platform')).toBe('instagram');
    expect(query.get('is_demo')).toBe('false');
    expect(query.get('q')).toBe('fixture');

    await page.goForward();
    await expect.poll(() => new URL(page.url()).searchParams.get('ad')).toBe('519');
    await expect(details).toBeVisible();
    await page.getByTestId('ads-mobile-back-to-list').click();
    await expect.poll(() => new URL(page.url()).searchParams.has('ad')).toBe(false);
    await expect(list.locator('[data-ad-id="519"]')).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(priorListPosition);
    query = new URL(page.url()).searchParams;
    expect(query.get('queue')).toBe('true');
    expect(query.get('platform')).toBe('instagram');
    expect(query.get('is_demo')).toBe('false');
    expect(query.get('q')).toBe('fixture');

    await page.goto('/ads?queue=true&platform=instagram&is_demo=false&q=fixture&ad=519');
    await expect(list).toBeHidden();
    await expect(details).toBeVisible();
    await expect(page.getByRole('article', { name: t('ads:card.label', { id: 519 }) })).toBeVisible();
    await page.getByTestId('ads-mobile-back-to-list').click();
    await expect.poll(() => new URL(page.url()).searchParams.has('ad')).toBe(false);
    await expect(list).toBeVisible();
    query = new URL(page.url()).searchParams;
    expect(query.get('queue')).toBe('true');
    expect(query.get('platform')).toBe('instagram');
    expect(query.get('is_demo')).toBe('false');
    expect(query.get('q')).toBe('fixture');
  }

  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('manual text-only analysis failure can be retried and blocks review until full polling completes', async ({ page }) => {
  const manualAd = makeReviewAd(88, {
    url: null,
    author: null,
    origin: 'manual',
    text: 'Ручная публикация без ссылки',
    object_id: null,
    object_name: null,
    linked_object: null,
    status: 'captured',
    review_state: 'unreviewed',
    queue_reasons: ['analysis_failed'],
    capture_status: null,
    capture_error: null,
    ocr_status: null,
    llm_status: 'disabled',
    analysis_status: 'failed',
    phrase_hits: [],
  });
  const harness = await installMocks(page, 'mio_officer', {
    manualAd,
    analysisRetryFailures: 1,
    expectedApi503Responses: 1,
  });

  await page.goto('/ads?queue=true');
  await page.getByRole('button', { name: t('ads:actions.manual') }).click();
  const dialog = page.getByRole('dialog', { name: t('ads:manual.title') });
  await dialog.getByRole('textbox', { name: t('ads:manual.text') }).fill(manualAd.text ?? '');
  await dialog.getByRole('button', { name: t('ads:manual.submit'), exact: true }).click();
  await expect(dialog).toBeHidden();

  const card = page.getByRole('article', { name: t('ads:card.label', { id: manualAd.id }) });
  const reviewed = page.getByRole('button', { name: t('ads:review.markReviewed'), exact: true });
  await expect(card.getByRole('alert').filter({ hasText: t('ads:analysis.statusFailed') })).toBeVisible();
  await expect(card.getByRole('link', { name: /example\.invalid/ })).toHaveCount(0);
  await expect(reviewed).toBeDisabled();

  const retry = card.getByRole('button', { name: t('ads:analysis.retry'), exact: true });
  await retry.click();
  await expect(card.getByRole('alert').filter({ hasText: t('ads:analysis.retryError') })).toBeVisible();
  await expect(retry).toBeEnabled();

  await retry.click();
  await expect(card.getByText(t('ads:analysis.statusPending'))).toBeVisible();
  await expect(reviewed).toBeDisabled();
  await expect
    .poll(() => harness.state.ads.find((ad) => ad.id === manualAd.id)?.analysis_status, { timeout: 10_000 })
    .toBe('done');
  await expect
    .poll(() => harness.state.ads.find((ad) => ad.id === manualAd.id)?.llm_status, { timeout: 10_000 })
    .toBe('done');
  await expect(reviewed).toBeEnabled();

  const manualCreate = harness.mutations.find(({ method, path }) => method === 'POST' && path === '/ads/manual');
  expect(manualCreate?.body).toContain('name="text"');
  expect(manualCreate?.body).not.toContain('name="url"');
  expect(harness.mutations.filter(({ method, path }) => method === 'POST' && path === '/ads/88/retry-analysis')).toHaveLength(2);
  await reviewed.click();
  await expect.poll(() => harness.state.ads.find((ad) => ad.id === manualAd.id)?.review_state).toBe('reviewed');
  expectCleanBrowser(harness);
});

test('legacy no-URL ad with failed OCR can be retried from its card', async ({ page }) => {
  const ad = makeReviewAd(93, {
    url: null,
    author: null,
    origin: 'manual',
    text: null,
    object_id: null,
    object_name: null,
    linked_object: null,
    status: 'captured',
    review_state: 'unreviewed',
    queue_reasons: ['ocr_failed'],
    capture_status: null,
    capture_error: null,
    ocr_status: 'failed',
    llm_status: 'done',
    analysis_status: null,
    phrase_hits: [],
  });
  const harness = await installMocks(page, 'mio_officer', { ad, ads: [ad] });

  await page.goto('/ads?queue=true');
  const card = page.getByRole('article', { name: t('ads:card.label', { id: ad.id }) });
  const retry = card.getByRole('button', { name: t('ads:analysis.retry'), exact: true });

  await expect(card.getByRole('link', { name: /example\.invalid/ })).toHaveCount(0);
  await expect(card.getByRole('alert').filter({ hasText: t('ads:analysis.statusFailed') })).toBeVisible();
  await expect(retry).toBeEnabled();
  await retry.click();

  await expect(card.getByText(t('ads:analysis.statusPending'))).toBeVisible();
  await expect.poll(() => harness.state.ads.find((item) => item.id === ad.id)?.analysis_status, { timeout: 10_000 }).toBe('done');
  await expect.poll(() => harness.state.ads.find((item) => item.id === ad.id)?.ocr_status, { timeout: 10_000 }).toBe('done');
  await expect(card.getByRole('alert').filter({ hasText: t('ads:analysis.statusFailed') })).toHaveCount(0);
  await expect(card.getByRole('status').filter({ hasText: t('ads:analysis.statusPending') })).toHaveCount(0);
  await expect(retry).toHaveCount(0);
  expect(harness.mutations.filter(({ method, path }) => method === 'POST' && path === `/ads/${ad.id}/retry-analysis`)).toHaveLength(1);
  expectCleanBrowser(harness);
});

test('legacy capture failure can be retried without a mandatory analysis status', async ({ page }) => {
  const ad = makeReviewAd(94, {
    status: 'captured',
    review_state: 'unreviewed',
    queue_reasons: ['capture_failed'],
    capture_status: 'failed',
    capture_error: 'The page could not be loaded',
    ocr_status: null,
    llm_status: 'disabled',
    analysis_status: null,
    phrase_hits: [],
  });
  const harness = await installMocks(page, 'mio_officer', { ad, ads: [ad] });

  await page.goto('/ads?queue=true');
  const card = page.getByRole('article', { name: t('ads:card.label', { id: ad.id }) });
  await expect(card.getByRole('alert').filter({ hasText: t('ads:analysis.statusFailed') })).toBeVisible();
  await expect(card.getByRole('button', { name: t('ads:analysis.retry'), exact: true })).toBeEnabled();
  expectCleanBrowser(harness);
});

test('failed LLM analysis can be retried without rerunning publication analysis', async ({ page }) => {
  const ad = makeReviewAd(89, {
    status: 'captured',
    review_state: 'unreviewed',
    review_note: null,
    queue_reasons: ['llm_failed'],
    capture_status: 'done',
    capture_error: null,
    ocr_status: null,
    llm_status: 'failed',
    analysis_status: 'done',
    object_id: null,
    object_name: null,
    linked_object: null,
    phrase_hits: [],
  });
  const harness = await installMocks(page, 'mio_officer', {
    ad,
    ads: [ad],
    analysisRetryFailures: 1,
    expectedApi503Responses: 1,
  });

  await page.goto('/ads?queue=true');
  const card = page.getByRole('article', { name: t('ads:card.label', { id: ad.id }) });
  const retry = card.getByRole('button', { name: t('ads:llm.retry'), exact: true });
  const reviewed = page.getByRole('button', { name: t('ads:review.markReviewed'), exact: true });
  const note = card.getByRole('textbox', { name: t('ads:review.noteLabel') });

  await expect(card.getByRole('alert')).toContainText(t('ads:llm.statusFailed'));
  await expect(card.getByRole('button', { name: t('ads:analysis.retry'), exact: true })).toHaveCount(0);
  await expect(reviewed).toBeDisabled();
  await expect(note).toHaveValue('');

  await retry.click();
  await expect(card.getByRole('alert').filter({ hasText: t('ads:llm.retryError') })).toBeVisible();
  await expect(retry).toBeEnabled();

  await retry.click();
  await expect(card.getByText(t('ads:llm.statusPending'))).toBeVisible();
  expect(harness.state.ads.find((item) => item.id === ad.id)?.analysis_status).toBe('done');
  expect(harness.state.ads.find((item) => item.id === ad.id)?.llm_status).toBe('pending');
  await expect(reviewed).toBeDisabled();

  await expect.poll(() => harness.state.ads.find((item) => item.id === ad.id)?.llm_status, { timeout: 10_000 }).toBe('done');
  await expect(reviewed).toBeEnabled();
  await expect(note).toHaveValue('');
  expect(harness.state.ads.find((item) => item.id === ad.id)?.analysis_status).toBe('done');
  expect(harness.mutations.filter(({ method, path }) => method === 'POST' && path === `/ads/${ad.id}/retry-analysis`)).toHaveLength(2);
  expectCleanBrowser(harness);
});

test('combined publication and LLM failures expose only the publication retry', async ({ page }) => {
  const ad = makeReviewAd(91, {
    status: 'captured',
    review_state: 'unreviewed',
    queue_reasons: ['analysis_failed', 'llm_failed'],
    capture_status: 'done',
    capture_error: null,
    ocr_status: null,
    llm_status: 'failed',
    analysis_status: 'failed',
    object_id: null,
    object_name: null,
    linked_object: null,
    phrase_hits: [],
  });
  const harness = await installMocks(page, 'mio_officer', { ad, ads: [ad] });

  await page.goto('/ads?queue=true');
  const card = page.getByRole('article', { name: t('ads:card.label', { id: ad.id }) });
  await expect(card.getByRole('button', { name: t('ads:analysis.retry'), exact: true })).toHaveCount(1);
  await expect(card.getByRole('button', { name: t('ads:llm.retry'), exact: true })).toHaveCount(0);
  expectCleanBrowser(harness);
});

test('LLM retry remains available for legacy ads without a mandatory analysis status', async ({ page }) => {
  const ad = makeReviewAd(92, {
    status: 'captured',
    review_state: 'unreviewed',
    queue_reasons: ['llm_failed'],
    capture_status: 'done',
    capture_error: null,
    ocr_status: null,
    llm_status: 'failed',
    analysis_status: null,
    object_id: null,
    object_name: null,
    linked_object: null,
    phrase_hits: [],
  });
  const harness = await installMocks(page, 'mio_officer', { ad, ads: [ad] });

  await page.goto('/ads?queue=true');
  const card = page.getByRole('article', { name: t('ads:card.label', { id: ad.id }) });
  const retry = card.getByRole('button', { name: t('ads:llm.retry'), exact: true });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(card.getByText(t('ads:llm.statusPending'))).toBeVisible();
  expect(harness.state.ads.find((item) => item.id === ad.id)?.analysis_status).toBeNull();
  expect(harness.state.ads.find((item) => item.id === ad.id)?.llm_status).toBe('pending');
  expectCleanBrowser(harness);
});

test('pending LLM work polls after required analysis is done without a focus change', async ({ page }) => {
  const ad = makeReviewAd(90, {
    status: 'captured',
    review_state: 'unreviewed',
    queue_reasons: ['llm_pending'],
    capture_status: 'done',
    capture_error: null,
    ocr_status: null,
    llm_status: 'pending',
    analysis_status: 'done',
    object_id: null,
    object_name: null,
    linked_object: null,
    phrase_hits: [],
  });
  const harness = await installMocks(page, 'mio_officer', {
    ad,
    ads: [ad],
    llmPollsRemaining: 1,
  });

  await page.goto('/ads?queue=true');
  const card = page.getByRole('article', { name: t('ads:card.label', { id: ad.id }) });
  const reviewed = page.getByRole('button', { name: t('ads:review.markReviewed'), exact: true });
  await expect(card.getByText(t('ads:llm.statusPending'))).toBeVisible();
  await expect(reviewed).toBeDisabled();
  expect(harness.state.ads.find((item) => item.id === ad.id)?.analysis_status).toBe('done');

  const initialListRequests = harness.adListRequests.length;
  const initialDetailRequests = harness.adDetailRequests.filter((id) => id === ad.id).length;
  await expect.poll(() => harness.adListRequests.length, { timeout: 10_000 }).toBeGreaterThan(initialListRequests);
  await expect.poll(() => harness.adDetailRequests.filter((id) => id === ad.id).length, { timeout: 10_000 }).toBeGreaterThan(initialDetailRequests);
  await expect.poll(() => harness.state.ads.find((item) => item.id === ad.id)?.llm_status, { timeout: 10_000 }).toBe('done');
  await expect(reviewed).toBeEnabled();
  expect(harness.state.ads.find((item) => item.id === ad.id)?.analysis_status).toBe('done');
  expectCleanBrowser(harness);
});

test('mobile queue boundary keeps its detail step stable while loading but ordinary paging stays on the list', async ({ page }) => {
  const ads = Array.from({ length: 21 }, (_, index) => makeReviewAd(index + 1, {
    review_state: 'unreviewed',
    queue_reasons: ['manual_review'],
  }));
  const harness = await installMocks(page, 'mio_officer', { ads });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ads?queue=true&page=2&ad=21');
  const list = page.getByTestId('ads-list-panel');
  const details = page.getByTestId('ads-details-panel');
  const pagination = page.getByRole('navigation', { name: t('ads:feed.pagination') });
  await expect(page.getByRole('article', { name: t('ads:card.label', { id: 21 }) })).toBeVisible();
  await expect(list).toBeHidden();
  await expect(pagination).toBeHidden();

  harness.state.adListDelayMs = 1200;
  await page.getByRole('button', { name: t('ads:review.previous') }).click();
  await expect.poll(() => harness.adListRequests.some((url) => url.searchParams.get('offset') === '0')).toBe(true);
  await expect(details).toBeVisible();
  await expect(list).toBeHidden();
  await expect(pagination).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.get('ad')).toBe('20');
  await expect(page.getByRole('article', { name: t('ads:card.label', { id: 20 }) })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('article', { name: t('ads:card.label', { id: 20 }) })).toBeVisible();
  await expect(page.getByRole('button', { name: t('ads:review.next') })).toBeEnabled();
  const priorSecondPageRequests = harness.adListRequests.filter((url) => url.searchParams.get('offset') === '20').length;
  await page.getByRole('button', { name: t('ads:review.next') }).click();
  await expect.poll(() => harness.adListRequests.filter((url) => url.searchParams.get('offset') === '20').length).toBeGreaterThan(priorSecondPageRequests);
  await expect(details).toBeVisible();
  await expect(list).toBeHidden();
  await expect(pagination).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.get('ad')).toBe('21');
  await expect(page.getByRole('article', { name: t('ads:card.label', { id: 21 }) })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('article', { name: t('ads:card.label', { id: 21 }) })).toBeVisible();
  await expect(page.getByRole('button', { name: t('ads:review.previous') })).toBeEnabled();
  const priorCanceledPageRequests = harness.adListRequests.filter((url) => url.searchParams.get('offset') === '0').length;
  await page.getByRole('button', { name: t('ads:review.previous') }).click();
  await expect.poll(() => harness.adListRequests.filter((url) => url.searchParams.get('offset') === '0').length).toBeGreaterThan(priorCanceledPageRequests);
  await expect(details).toBeVisible();
  await expect(list).toBeHidden();
  await page.getByTestId('ads-mobile-back-to-list').click();
  await expect(page).toHaveURL('/ads?queue=true&page=1');
  await expect(details).toBeHidden();
  await expect(list).toBeVisible();
  await page.waitForTimeout(1300);
  await expect(details).toBeHidden();
  await expect(list).toBeVisible();

  await page.goto('/ads?queue=true&page=1&object_id=7');
  await expect(page.getByRole('button', { name: t('ads:card.label', { id: 1 }), exact: true })).toBeVisible();
  await expect(list).toBeVisible();
  await expect(details).toBeHidden();
  await expect(pagination).toBeVisible();
  await page.getByRole('button', { name: t('pagination.next') }).click();
  await expect.poll(() => harness.adListRequests.some((url) => url.searchParams.get('object_id') === '7' && url.searchParams.get('offset') === '20')).toBe(true);
  await expect(list).toBeVisible();
  await expect(details).toBeHidden();
  await expect(pagination).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  await expect(page.getByRole('button', { name: t('ads:card.label', { id: 21 }) })).toBeVisible();
  expect(new URL(page.url()).searchParams.has('ad')).toBe(false);
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('queue boundary navigation selects the actual previous-page last row and never shows an off-filter ordinal', async ({ page }) => {
  const ads = Array.from({ length: 21 }, (_, index) => makeReviewAd(index + 1, {
    review_state: 'unreviewed',
    queue_reasons: ['manual_review'],
  }));
  ads[19]!.phrase_hits = [{
    id: 120, ad_post_id: 20, phrase_id: 1, category: 'booking', matched_text: 'Бронирование квартир', start: 0, end: 20,
    weight: 2, detected_by: 'dictionary', confirmed: null, confirmed_by: null,
  }];
  ads[19]!.queue_reasons = ['manual_review', 'unreviewed_phrase_hits'];
  const harness = await installMocks(page, 'mio_officer', { ads });
  await page.goto('/ads?queue=true&page=2&ad=21');
  await expect(page.getByRole('article', { name: t('ads:card.label', { id: 21 }) })).toBeVisible();
  await expect(page.getByText(t('ads:review.progress', { current: 21, total: 21 }))).toBeVisible();
  await page.getByRole('button', { name: t('ads:review.previous') }).click();
  await expect(page).toHaveURL('/ads?queue=true&page=1&ad=20');
  await expect(page.getByRole('article', { name: t('ads:card.label', { id: 20 }) })).toBeVisible();
  await expect(page.getByText(t('ads:review.progress', { current: 20, total: 21 }))).toBeVisible();
  await page.getByLabel(t('ads:review.noteLabel')).fill('Сохранить заметку на границе страницы');
  await page.getByRole('button', { name: t('ads:hits.confirmDictionary') }).click();
  await expect(page).toHaveURL('/ads?queue=true&page=1&ad=20');
  await expect(page.getByRole('article', { name: t('ads:card.label', { id: 20 }) })).toBeVisible();
  await expect(page.getByLabel(t('ads:review.noteLabel'))).toHaveValue('Сохранить заметку на границе страницы');
  await page.goBack();
  await expect(page).toHaveURL('/ads?queue=true&page=2&ad=21');
  await expect(page.getByRole('article', { name: t('ads:card.label', { id: 21 }) })).toBeVisible();

  await page.goto('/ads?queue=true&review_state=reviewed&ad=21');
  await expect(page.getByRole('article', { name: t('ads:card.label', { id: 21 }) })).toBeVisible();
  await expect(page.getByText(/Публикация \d+ из \d+/)).toHaveCount(0);
  expect(harness.adListRequests.some((url) => url.searchParams.get('offset') === '20' && url.searchParams.get('limit') === '20')).toBe(true);
  expectCleanBrowser(harness);
});

test('exact duplicate advisories keep all publications visible and open the scoped server group', async ({ page }) => {
  const sharedText = 'Одинаковый текст объявления из одного источника';
  const peer = makeReviewAd(12, {
    text: sharedText, source_account_id: 3,
    duplicate_count: 1,
    duplicate_instances: [{ id: 11, url: 'https://example.invalid/post/11', platform: 'instagram', source_label: '@sever_build' }],
  });
  const source = makeReviewAd(11, {
    text: sharedText, source_account_id: 3,
    duplicate_count: 1,
    duplicate_instances: [{ id: 12, url: 'https://example.invalid/post/12', platform: 'instagram', source_label: '@sever_build' }],
  });
  const harness = await installMocks(page, 'mio_officer', { ads: [source, peer] });

  await page.goto('/ads');
  await expect(page.getByRole('button', { name: 'Публикация №11' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Публикация №12' })).toBeVisible();
  await page.locator('details[aria-label]').filter({ hasText: t('ads:review.exactDuplicates') }).locator('summary').click();
  await page.getByRole('button', { name: t('ads:review.openDuplicateGroup') }).click();
  await expect(page).toHaveURL(/duplicate_of=11/);
  await expect(page.getByRole('button', { name: 'Публикация №11' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Публикация №12' })).toBeVisible();
  await expect.poll(() => harness.adListRequests.some((url) => url.searchParams.get('duplicate_of') === '11' && !url.searchParams.has('queue'))).toBe(true);
  await expect(page.getByText('Источник: @sever_build').first()).toBeVisible();
  await page.getByRole('button', { name: 'Вернуться к списку' }).click();
  await expect(page).toHaveURL('/ads');
  await expect(page.getByRole('button', { name: 'Публикация №11' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Публикация №12' })).toBeVisible();
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('publication context preserves the demo label and returns to the selected queue item', async ({ page }) => {
  const demoAd = makeReviewAd(11, { is_demo: true });
  const harness = await installMocks(page, 'mio_officer', { ads: [demoAd] });
  await page.goto('/ads?queue=true');
  await page.getByRole('button', { name: t('ads:card.label', { id: 11 }) }).click();
  await page.getByRole('link', { name: t('ads:link.checkObject') }).click();
  await expect(page).toHaveURL(/\/objects\/7\?from_ad=11&returnTo=%2Fads%3Fqueue%3Dtrue%26ad%3D11#ads$/);

  const context = page.locator('#ads');
  await expect(context).toBeFocused();
  await expect(context.getByText(t('demo.badge'), { exact: true })).toBeVisible();
  await expect(context.getByText(demoAd.text!, { exact: true })).toBeVisible();
  await screenshot(page, 'ads-object-context-demo');
  await context.getByRole('link', { name: t('objects:card.publication.return') }).click();
  await expect(page).toHaveURL('/ads?queue=true&ad=11');
  await expect(page.getByRole('article', { name: t('ads:card.label', { id: 11 }) })).toBeVisible();
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('an assignment URL missing from the object explains the gap and does not focus another task', async ({ page }) => {
  const assignment = makeAssignment();
  const harness = await installMocks(page, 'mio_officer', { assignments: [assignment] });
  await page.goto('/objects/7?assignment=999#assignments');
  await expect(page.getByText(t('assignments:section.focusUnavailable'), { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: t('assignments:section.openAll') })).toHaveAttribute('href', '/control');
  await expect(page.locator('#assignments [aria-current="true"]')).toHaveCount(0);
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('admin sees the signal route summary without MIO recipient navigation actions', async ({ page }) => {
  const signal = makeSignal('requires_confirmation', 'gask');
  const harness = await installMocks(page, 'admin', { signal });
  await page.goto('/signals/42');
  const routeSummary = t('signals:detail.prepareSummary.readOnly', {
    recipient: t('enums:recipient.gask'),
    days: t('signals:reviewDays', { count: signal.review_days }),
  });
  await expect(page.getByText(routeSummary, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: t('signals:detail.prepareSummary.route') })).toHaveCount(0);
  await expect(page.getByRole('button', { name: t('signals:actions.confirmSend') })).toHaveCount(0);
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('signal filter group headings stay localized for registry and recipient roles', async ({ page }) => {
  const statusRows = (['requires_confirmation', 'returned', 'responded', 'sent', 'closed'] as SignalStatus[]).map((status, index) => {
    const signal = makeSignal(status, 'gask');
    signal.id = 42 + index;
    signal.number = `SIG-2026-${String(42 + index).padStart(4, '0')}`;
    return signal;
  });
  const harness = await installMocks(page, 'mio_officer', { signals: statusRows });
  await page.goto('/signals');
  for (const group of ['action', 'waiting', 'history']) {
    await expect(page.getByText(t(`signals:list.filters.groups.${group}`), { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/list\.filters\.groups\./)).toHaveCount(0);
  await selectLanguage(page, 'kk');
  for (const group of ['action', 'waiting', 'history']) {
    await expect(page.getByText(tKk(`signals:list.filters.groups.${group}`), { exact: true })).toBeVisible();
  }

  harness.state.role = 'gask';
  await page.reload();
  for (const group of ['action', 'answered', 'history']) {
    await expect(page.getByText(tKk(`signals:list.filters.groups.${group}`), { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/list\.filters\.groups\./)).toHaveCount(0);
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('unsaved signal drafts protect Link and browser-back navigation and preserve edits on Stay', async ({ page }) => {
  const signal = makeSignal('requires_confirmation', 'gask');
  const harness = await installMocks(page, 'mio_officer', { signal, signals: [signal] });
  await page.goto('/signals');
  await page.getByRole('link', { name: signal.number }).click();
  await expect(page).toHaveURL(/\/signals\/42\?/);
  const note = page.getByRole('textbox', { name: t('signals:sections.note') });
  await note.fill('Черновик должен сохраниться при выборе «Остаться»');

  await page.getByRole('link', { name: t('signals:detail.back') }).click();
  const blocker = page.getByRole('alertdialog', { name: t('signals:unsaved.leaveTitle') });
  await expect(blocker).toBeVisible();
  await blocker.getByRole('button', { name: t('signals:unsaved.stay') }).click();
  await expect(page).toHaveURL(/\/signals\/42\?/);
  await expect(note).toHaveValue('Черновик должен сохраниться при выборе «Остаться»');

  await page.evaluate(() => window.history.back());
  await expect(blocker).toBeVisible();
  await blocker.getByRole('button', { name: t('signals:unsaved.stay') }).click();
  await expect(page).toHaveURL(/\/signals\/42\?/);
  await expect(note).toHaveValue('Черновик должен сохраниться при выборе «Остаться»');

  await page.getByTestId('bento-nav-card-work').click();
  await expect(blocker).toBeVisible();
  await blocker.getByRole('button', { name: t('signals:unsaved.leave') }).click();
  await expect(page).toHaveURL(/\/work$/);
  expect(harness.mutations).toEqual([]);
  expect(harness.state.signal.sections.note).toBe('');
  expectCleanBrowser(harness);
});

test('saving a signal draft clears its navigation blocker', async ({ page }) => {
  const signal = makeSignal('requires_confirmation', 'gask');
  const harness = await installMocks(page, 'mio_officer', { signal });
  await page.goto('/signals/42');
  await page.getByRole('textbox', { name: t('signals:sections.note') }).fill('Сохранённое примечание');
  await page.getByRole('button', { name: t('signals:unsaved.save') }).click();
  await expect(page.getByRole('status').filter({ hasText: t('signals:unsaved.message') })).toHaveCount(0);
  expect(harness.state.signal.sections.note).toBe('Сохранённое примечание');
  expect(harness.mutations.filter(({ method, path }) => method === 'PATCH' && path === '/signals/42')).toHaveLength(1);
  await page.getByTestId('bento-nav-card-work').click();
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expectCleanBrowser(harness);
});

test('switching from a reviewed ad to another ad keeps the second ad review action available', async ({ page }) => {
  const secondAd = { ...structuredClone(adFixture), id: 12, url: 'https://example.invalid/post/12', status: 'verification' as const };
  const harness = await installMocks(page, 'mio_officer', { ads: [structuredClone(adFixture), secondAd] });
  await page.goto('/ads?ad=11');
  const firstArticle = page.getByRole('article', { name: 'Публикация №11' });
  await firstArticle.locator('details').filter({ hasText: t('ads:llm.badge') }).locator('summary').click();
  await expect(firstArticle.getByRole('button', { name: 'Подтвердить сведения ИИ' })).toBeVisible();
  await firstArticle.getByRole('button', { name: 'Подтвердить сведения ИИ' }).click();
  await expect(firstArticle.getByRole('status').filter({ hasText: /Сохранено то, что подтверждает текст/ })).toBeVisible();

  await page.getByRole('button', { name: 'Публикация №12' }).click();
  await expect(page).toHaveURL(/\/ads\?ad=12$/);
  const secondArticle = page.getByRole('article', { name: 'Публикация №12' });
  await expect(secondArticle).toBeVisible();
  await secondArticle.locator('details').filter({ hasText: t('ads:llm.badge') }).locator('summary').click();
  await expect(secondArticle.getByRole('button', { name: 'Подтвердить сведения ИИ' })).toBeVisible();
  expect(harness.mutations.filter(({ method, path }) => method === 'POST' && path === '/ads/11/accept-llm')).toHaveLength(1);
  expect(harness.mutations.filter(({ method, path }) => method === 'POST' && path === '/ads/12/accept-llm')).toHaveLength(0);
  expectCleanBrowser(harness);
});

test('disabled collectors route staff to manual ad entry without starting a collector', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer', { ads: [] });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/sources');
  await expect(page.getByTestId('bento-section-panel').getByRole('article').filter({ hasText: 'ЖК Северный бриз · объявления OLX' })).toBeVisible();
  let dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  const watchSource = page.getByRole('switch', { name: 'Следить за источником ЖК Северный бриз · объявления OLX' });
  await watchSource.click();
  await expect(watchSource).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => harness.mutations.filter(({ method, path }) => method === 'PATCH' && path === '/source-accounts/3')).toHaveLength(1);
  expect(harness.mutations.find(({ path }) => path === '/source-accounts/3')?.body).toEqual({ is_watched: false });
  await page.setViewportSize({ width: 390, height: 844 });
  dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  await expect(page.getByText(/Автоматический сбор включён для 0 из 4 платформ/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Собрать сейчас' })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Добавить рекламу по ссылке или вручную' })).toHaveAttribute('href', '/ads');
  await page.getByRole('link', { name: 'Добавить рекламу по ссылке или вручную' }).click();
  await expect(page).toHaveURL(/\/ads$/);
  await expect(page.getByTestId('ads-list-panel').getByText('Рекламных публикаций пока нет')).toBeVisible();
  await page.getByRole('button', { name: 'Добавить вручную' }).first().click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Добавить публикацию вручную' })).toBeVisible();
  await screenshot(page, 'ads-manual-entry');
  expect(harness.mutations.filter(({ method }) => method !== 'PATCH')).toEqual([]);
  expectCleanBrowser(harness);
});

test('recipient filters stay role-aware; send, answer and close each have explicit next steps', async ({ page }) => {
  const signal = makeSignal('requires_confirmation', 'gask');
  const harness = await installMocks(page, 'mio_officer', { signal, signals: [signal] });

  await page.goto('/signals/42');
  await expect(page.getByRole('heading', { level: 2, name: 'Проверьте факты и получателя' })).toBeVisible();
  await page.getByRole('button', { name: 'Подтвердить и направить' }).click();
  const sendDialog = page.getByRole('dialog', { name: 'Подтвердить и направить' });
  await expect(sendDialog).toBeVisible();
  await expect(sendDialog.getByText('Перед отправкой проверьте адресата, срок и последствия.')).toBeVisible();
  await expect(sendDialog.getByText(/После направления редактирование карточки будет заблокировано/)).toBeVisible();
  await sendDialog.getByRole('button', { name: 'Подтвердить и направить' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Карточка направлена — ожидаем ответ' })).toBeVisible();
  const sendMutation = harness.mutations.find((item) => item.path === '/signals/42/confirm-and-send');
  expect(sendMutation?.body).toEqual({ recipient: 'gask' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const sentStatusSummary = page.getByRole('heading', { name: t('signals:detail.waitingSummary.title'), exact: true });
  const nextStepSummary = page.getByRole('heading', { name: t('signals:detail.next.waitingTitle'), exact: true });
  await expect(sentStatusSummary).toBeVisible();
  await expect(nextStepSummary).toBeVisible();
  const statusBox = await sentStatusSummary.boundingBox();
  const nextStepBox = await nextStepSummary.boundingBox();
  expect(statusBox).not.toBeNull();
  expect(nextStepBox).not.toBeNull();
  expect(statusBox!.y + statusBox!.height).toBeLessThan(nextStepBox!.y);
  await screenshot(page, 'signal-sent-status-first-mobile-390');
  await page.setViewportSize({ width: 1440, height: 900 });
  await screenshot(page, 'signal-sent-next-step');

  harness.state.role = 'gask';
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'Внесите результат рассмотрения' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Внести результат' })).toBeVisible();
  await page.getByRole('button', { name: 'Внести результат' }).click();
  const responseDialog = page.getByRole('dialog', { name: 'Внести результат' });
  await responseDialog.getByLabel('Результат рассмотрения').fill('Проверка проведена, меры приняты.');
  await responseDialog.getByRole('button', { name: 'Внести результат' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Ответ передан сотруднику МИО' })).toBeVisible();
  expect(harness.mutations.find((item) => item.path === '/signals/42/response')?.body).toEqual({
    response_text: 'Проверка проведена, меры приняты.',
  });
  await expect(page.getByRole('button', { name: 'Закрыть карточку' })).toHaveCount(0);

  harness.state.role = 'mio_officer';
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'Проверьте ответ и закройте карточку' })).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть карточку' }).click();
  const closeDialog = page.getByRole('dialog', { name: 'Закрыть карточку' });
  await expect(closeDialog).toBeVisible();
  await expect(closeDialog.getByText(/Карточка SIG-2026-0042 будет закрыта/)).toBeVisible();
  await closeDialog.getByRole('button', { name: 'Закрыть карточку' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Проверка завершена' })).toBeVisible();
  expect(harness.mutations.filter((item) => item.path === '/signals/42/close')).toHaveLength(1);

  await page.goto('/signals?status=responded&object_id=7&page=3');
  const list = page.getByRole('group', { name: 'Этап карточки' });
  await expect(list.getByRole('button', { name: 'Ответ получен' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Объект' })).toBeVisible();
  await expect.poll(() => harness.listRequests.some((url) =>
    url.searchParams.get('status') === 'responded' && url.searchParams.get('object_id') === '7' && url.searchParams.get('offset') === '50',
  )).toBe(true);

  harness.state.role = 'gask';
  await page.reload();
  await expect(page.getByRole('group', { name: 'Этап карточки' }).getByRole('button', { name: 'Ответ получен' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Объект' })).toHaveCount(0);
  await expect.poll(() => harness.listRequests.slice(-1)[0]?.searchParams.has('object_id')).toBe(false);
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await expect(page).toHaveURL(/\/signals$/);
  expect(harness.mutations.every((item) => item.path.startsWith('/signals/42/'))).toBe(true);
  expectCleanBrowser(harness);
});

test('registry staff can review and download a signal package without changing the card lifecycle', async ({ page }) => {
  const signal = makeSignal('requires_confirmation', 'gask');
  const harness = await installMocks(page, 'mio_officer', {
    signal,
    signalMaterials: makeSignalMaterials(signal),
    materialsDelayMs: 150,
    packageDelayMs: 200,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/signals/42');
  await expect(page.getByRole('heading', { level: 2, name: 'Проверьте факты и получателя' })).toBeVisible();
  const openPackage = page.getByRole('button', { name: 'Подготовить пакет' });
  await expect(openPackage).toBeVisible();
  expect(harness.materialRequests).toHaveLength(0);

  await openPackage.click();
  const dialog = page.getByRole('dialog', { name: 'Подготовка пакета материалов' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Загрузка…')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Состав пакета' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Отдельные исходные файлы доказательств' })).toBeVisible();
  await expect(dialog.getByText(/Сигнальная карточка в PDF включается целиком, если доступна/)).toBeVisible();
  await expect(dialog.getByText('Черновик: пакет не направляется адресату.')).toBeVisible();
  await expect(dialog.getByText('Черновик: пакет не направляется адресату.', { exact: true })).toHaveCount(1);
  await expect(dialog.getByText('Сохранённый снимок карточки')).toBeVisible();
  await expect(dialog.getByText('Предпросмотр на')).toBeVisible();
  await expect(dialog.getByText('Сигнальная карточка (PDF)', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Сопроводительное письмо (DOCX)', { exact: true })).toBeVisible();
  await expect(dialog.getByText('В снимке перечислено 50 публикаций; перечень при создании карточки мог быть ограничен.', { exact: true })).toHaveCount(1);
  await expect(dialog.getByText('Не хватает материалов')).toBeVisible();
  await expect(dialog.getByText('Файл не входит в снимок материалов').first()).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(4);
  const facadeFile = dialog.getByRole('checkbox', { name: 'Включить исходный файл: Фото фасада' });
  const protocolFile = dialog.getByRole('checkbox', { name: 'Включить исходный файл: Протокол обхода' });
  const unavailableFile = dialog.getByRole('checkbox', { name: 'Включить исходный файл: Файл вне снимка' });
  await expect(facadeFile).toBeChecked();
  await expect(protocolFile).toBeChecked();
  await expect(unavailableFile).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Подтвердить и направить' })).toHaveCount(0);
  const facadeRow = dialog.locator('li').filter({ hasText: 'Фото фасада' });
  await expect(facadeRow.getByRole('link', { name: 'Открыть источник: Фото фасада' })).toBeVisible();
  await expect(facadeRow.getByText(/^Размер:/)).toBeVisible();
  await expect(facadeRow.getByText(/^Зафиксировано:/)).toBeVisible();
  const facadeDetails = facadeRow.locator('details');
  await expect(facadeDetails).not.toHaveAttribute('open', '');
  await facadeDetails.locator('summary').click();
  await expect(facadeDetails.getByText(/^SHA-256:/)).toBeVisible();
  await facadeDetails.locator('summary').click();
  await screenshot(page, 'signal-package-dialog-light', false);

  await expect.poll(() => harness.materialRequests.length).toBe(1);
  expect(harness.materialRequests[0]?.url.pathname).toBe('/api/v1/signals/42/materials');
  expect(harness.materialRequests[0]?.authorization).toBe('Bearer mock-ui-session');

  const zipButton = dialog.getByRole('button', { name: 'Скачать ZIP' });
  const allResponsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/signals/42/package.zip');
  const allDownloadPromise = page.waitForEvent('download');
  await zipButton.click();
  await expect(zipButton).toHaveAttribute('aria-busy', 'true');
  const allResponse = await allResponsePromise;
  expect(allResponse.headers()['content-type']).toContain('application/zip');
  const allDownload = await allDownloadPromise;
  await expect(zipButton).not.toHaveAttribute('aria-busy', 'true');
  expect(allDownload.suggestedFilename()).toBe('SAQ_QURYLYS_SIG-2026-0042_package.zip');
  await expect.poll(() => harness.downloadRequests.filter(({ url }) => url.pathname === '/api/v1/signals/42/package.zip')).toHaveLength(1);
  const packageRequests = () => harness.downloadRequests.filter(({ url }) => url.pathname === '/api/v1/signals/42/package.zip');
  expect(packageRequests()[0]?.authorization).toBe('Bearer mock-ui-session');
  expect(packageRequests()[0]?.url.searchParams.get('include_evidence')).toBe('true');
  expect(packageRequests()[0]?.url.searchParams.has('evidence_id')).toBe(false);

  await facadeFile.click();
  await expect(facadeFile).not.toBeChecked();
  const partialDownloadPromise = page.waitForEvent('download');
  await zipButton.click();
  await partialDownloadPromise;
  expect(packageRequests()[1]?.url.searchParams.has('include_evidence')).toBe(false);
  expect(packageRequests()[1]?.url.searchParams.getAll('evidence_id')).toEqual(['502', '504']);

  await dialog.getByRole('button', { name: 'Не включать исходные файлы' }).click();
  await expect(facadeFile).not.toBeChecked();
  await expect(protocolFile).not.toBeChecked();
  const noEvidenceDownloadPromise = page.waitForEvent('download');
  await zipButton.click();
  await noEvidenceDownloadPromise;
  expect(packageRequests()[2]?.url.searchParams.get('include_evidence')).toBe('false');
  expect(packageRequests()[2]?.url.searchParams.has('evidence_id')).toBe(false);
  expect(harness.state.signal.status).toBe('requires_confirmation');
  expect(harness.mutations).toEqual([]);

  await dialog.getByRole('button', { name: 'Закрыть' }).last().click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectLightOnly(page);
  await openPackage.click();
  await expect(dialog).toBeVisible();
  await screenshot(page, 'signal-package-dialog-light-under-dark-os', false);
  await dialog.getByRole('button', { name: 'Закрыть' }).last().click();

  await selectLanguage(page, 'kk');
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await page.getByRole('button', { name: 'Пакетті дайындау' }).click();
  const kkDialog = page.getByRole('dialog', { name: 'Материалдар пакетін дайындау' });
  await expect(kkDialog.getByRole('heading', { name: 'Дәлелдердің жеке бастапқы файлдары' })).toBeVisible();
  harness.state.packageFailure = {
    status: 413,
    code: 'package_file_too_large',
    message: 'File exceeds the package size limit',
  };
  const errorResponsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/signals/42/package.zip');
  await kkDialog.getByRole('button', { name: 'ZIP жүктеп алу' }).click();
  await expect(kkDialog.getByRole('button', { name: 'ZIP жүктеп алу' })).toHaveAttribute('aria-busy', 'true');
  expect((await errorResponsePromise).status()).toBe(413);
  await expect(page.getByText('Пакетті жүктеу мүмкін болмады', { exact: true })).toBeVisible();
  await expect(page.getByText('Файлдардың бірінің өлшемі рұқсат етілген шектен асты.', { exact: true })).toBeVisible();
  expect(packageRequests()[3]?.authorization).toBe('Bearer mock-ui-session');
  expect(packageRequests()[3]?.url.searchParams.get('include_evidence')).toBe('false');
  expect(harness.state.signal.status).toBe('requires_confirmation');
  expect(harness.mutations).toEqual([]);
  await screenshot(page, 'signal-package-dialog-light-kk-error', false);
  await kkDialog.getByRole('button', { name: 'Жабу' }).last().click();

  await selectLanguage(page, 'ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.setViewportSize({ width: 320, height: 844 });
  await setLargeFont(page, true);
  await openPackage.click();
  await expect(dialog).toBeVisible();
  const mobileBox = await dialog.boundingBox();
  const mobileOverflow = await dialog.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(mobileBox).not.toBeNull();
  expect(mobileBox!.x).toBeGreaterThanOrEqual(0);
  expect(mobileBox!.x + mobileBox!.width).toBeLessThanOrEqual(320);
  expect(mobileOverflow.scroll).toBeLessThanOrEqual(mobileOverflow.client);
  const body = dialog.locator('[data-slot="signal-package-body"]');
  const bodyScroll = await body.evaluate((element) => ({
    client: element.clientHeight,
    scroll: element.scrollHeight,
  }));
  expect(bodyScroll.scroll).toBeGreaterThan(bodyScroll.client);
  await expect(body).toHaveCSS('overflow-y', 'auto');
  const header = dialog.locator('[data-slot="dialog-header"]');
  const headerBox = await header.boundingBox();
  expect(headerBox).not.toBeNull();
  const mobileZipButton = dialog.getByRole('button', { name: 'Скачать ZIP' });
  const closeButton = dialog.getByRole('button', { name: 'Закрыть' }).last();
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const assertButtonInViewport = async (button: typeof mobileZipButton) => {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight);
    return box!.y;
  };
  const headerY = headerBox!.y;
  const zipButtonY = await assertButtonInViewport(mobileZipButton);
  const closeButtonY = await assertButtonInViewport(closeButton);
  await body.evaluate((element) => {
    const scrollable = element as HTMLElement;
    scrollable.scrollTop = scrollable.scrollHeight;
  });
  await expect.poll(() => body.evaluate((element) => (element as HTMLElement).scrollTop)).toBeGreaterThan(0);
  expect((await header.boundingBox())?.y).toBe(headerY);
  expect(await assertButtonInViewport(mobileZipButton)).toBe(zipButtonY);
  expect(await assertButtonInViewport(closeButton)).toBe(closeButtonY);
  const longEvidenceRow = dialog.locator('li').filter({
    hasText: 'Акт обследования входной группы и мест общего пользования с приложением перечня замечаний',
  });
  await longEvidenceRow.scrollIntoViewIfNeeded();
  await expect(longEvidenceRow).toBeVisible();
  expect(await assertButtonInViewport(mobileZipButton)).toBe(zipButtonY);
  expect(await assertButtonInViewport(closeButton)).toBe(closeButtonY);
  await screenshot(page, 'signal-package-mobile-320-large-ru', false);
  await expect(dialog.getByRole('heading', { name: 'Отдельные исходные файлы доказательств' })).toBeVisible();
  expect(harness.state.signal.status).toBe('requires_confirmation');
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('signal package preview is available to admins and not fetched for recipient roles', async ({ page }) => {
  const signal = makeSignal('sent', 'gask');
  const harness = await installMocks(page, 'admin', { signal, signalMaterials: makeSignalMaterials(signal) });
  await page.goto('/signals/42');
  const openPackage = page.getByRole('button', { name: 'Подготовить пакет' });
  await expect(openPackage).toBeVisible();
  await openPackage.click();
  const dialog = page.getByRole('dialog', { name: 'Подготовка пакета материалов' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Архивная PDF-копия сигнальной карточки', { exact: true })).toBeVisible();
  await expect.poll(() => harness.materialRequests.length).toBe(1);
  expect(harness.materialRequests[0]?.authorization).toBe('Bearer mock-ui-session');

  harness.state.role = 'gask';
  await page.reload();
  await expect(page.getByRole('button', { name: 'Подготовить пакет' })).toHaveCount(0);
  expect(harness.materialRequests).toHaveLength(1);
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('signal package waits for unsaved card edits without autosaving or sending', async ({ page }) => {
  const signal = makeSignal('requires_confirmation', 'gask');
  const harness = await installMocks(page, 'mio_officer', {
    signal,
    signalMaterials: makeSignalMaterials(signal),
  });
  await page.goto('/signals/42');
  await page.getByRole('textbox', { name: 'Примечание' }).fill('Несохранённая правка карточки');
  const saveButton = page.getByRole('button', { name: 'Сохранить' });
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();
  await expect(page.getByRole('status').filter({ hasText: 'Есть несохранённые изменения' })).toBeVisible();

  await page.getByRole('button', { name: 'Подготовить пакет' }).click();
  const dialog = page.getByRole('dialog', { name: 'Подготовка пакета материалов' });
  await expect(dialog.getByRole('alert')).toContainText('сначала сохраните изменения кнопкой «Сохранить»');
  await expect(dialog.getByRole('button', { name: 'Скачать ZIP' })).toBeDisabled();
  expect(harness.materialRequests[0]?.authorization).toBe('Bearer mock-ui-session');
  expect(harness.downloadRequests.filter(({ url }) => url.pathname === '/api/v1/signals/42/package.zip')).toHaveLength(0);
  expect(harness.state.signal.sections.note).not.toBe('Несохранённая правка карточки');
  expect(harness.state.signal.status).toBe('requires_confirmation');
  expect(harness.mutations).toEqual([]);

  await dialog.getByRole('button', { name: 'Закрыть' }).last().click();
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('signal creation runs once after a successful object lookup and navigates to the new card', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer', { object: makeObject('green') });
  await page.goto('/objects/7');
  await expect(page.getByText(/По текущей оценке дополнительных задач нет/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Создать карточку вручную' })).toBeVisible();
  await page.getByRole('button', { name: 'Создать карточку вручную' }).click();
  await expect(page).toHaveURL(/\/signals\/88$/);
  expect(harness.mutations.filter((item) => item.method === 'POST' && item.path === '/signals')).toHaveLength(1);
  expect(harness.mutations.find((item) => item.path === '/signals')?.body).toEqual({ object_id: 7 });
  await screenshot(page, 'signal-created-from-object');
  expectCleanBrowser(harness);
});

test('signal URL filters clear status, object and page together', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer');
  await page.goto('/signals?status=responded&object_id=7&page=3');
  await expect(page.getByRole('button', { name: 'Сбросить фильтры' })).toBeVisible();
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await expect(page).toHaveURL(/\/signals$/);
  await expect.poll(() => harness.listRequests.some((url) =>
    url.searchParams.get('status') === 'responded' && url.searchParams.get('object_id') === '7' && url.searchParams.get('offset') === '50',
  )).toBe(true);
  await expect.poll(() => harness.listRequests.some((url) =>
    !url.searchParams.has('status') && !url.searchParams.has('object_id') && url.searchParams.get('offset') === '0',
  )).toBe(true);
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test('a sent card addressed to MIO is shown as an operator response task', async ({ page }) => {
  const sentToMio = makeSignal('sent', 'mio');
  const harness = await installMocks(page, 'mio_officer', { signals: [sentToMio] });
  await page.goto('/work');
  await expect(page.getByRole('link', { name: 'Внести результат по карточке SIG-2026-0042' })).toHaveAttribute('href', '/signals/42');
  await screenshot(page, 'work-mio-sent-to-mio');
  expect(harness.mutations).toEqual([]);
  expectCleanBrowser(harness);
});

test.describe('Ask AI panel', () => {
  const panelName = 'Спросить ИИ';

  test('opens from the header with page starters, takes focus and returns it on Escape', async ({ page }) => {
    const harness = await installMocks(page, 'mio_officer');
    await page.goto('/objects/7');
    const opener = page.getByTestId('header-user-trigger');
    await openAssistantFromProfile(page);
    const panel = page.getByRole('complementary', { name: panelName });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { level: 2, name: /^(Доброе утро|Добрый день|Добрый вечер)\.$/ })).toBeVisible();
    await expect(panel.getByText('Чем займёмся?')).toBeVisible();
    await expect(panel.getByRole('button', { name: /Почему у объекта такая зона\?/ })).toBeVisible();
    await expect(panel.getByRole('button', { name: /Какие документы проверить\?/ })).toBeVisible();
    await expect(panel.getByText('Объект № 7')).toBeVisible();
    await expect(panel.getByText('ИИ может ошибаться. Проверяйте данные в карточках.')).toBeVisible();
    const composer = panel.getByRole('textbox', { name: 'Сообщение ассистенту' });
    await expect(composer).toBeFocused();
    const composerRadius = await composer.locator('..').evaluate((frame) =>
      Number.parseFloat(getComputedStyle(frame).borderTopLeftRadius),
    );
    expect(composerRadius).toBeGreaterThanOrEqual(12);
    await screenshot(page, 'assistant-empty-desktop');

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(opener).toBeFocused();
    expectCleanBrowser(harness);
  });

  test('a starter sends the page entity and language; the markdown answer links navigate without reload', async ({ page }) => {
    const harness = await installMocks(page, 'mio_officer');
    await page.goto('/objects/7');
    await openAssistantFromProfile(page);
    const panel = page.getByRole('complementary', { name: panelName });
    await panel.getByRole('button', { name: /Почему у объекта такая зона\?/ }).click();

    await expect(panel.getByText('жёлтой', { exact: true })).toBeVisible();
    expect(harness.mutations.find((item) => item.path === '/assistant/chat')?.body).toEqual({
      messages: [{ role: 'user', content: 'Почему у объекта такая зона?' }],
      page: { path: '/objects/7', entity: { type: 'object', id: 7 } },
      language: 'ru',
    });
    await expect(panel.getByText('Ищу объекты: Северный')).toBeVisible();
    await expect(panel.getByRole('listitem').filter({ hasText: 'пункт два' })).toBeVisible();
    await expect(panel.getByRole('link', { name: 'документацию' })).toHaveCount(0);
    await expect(panel.getByText('документацию (example.invalid)')).toBeVisible();

    const sourcesToggle = panel.getByRole('button', { name: 'Источники (2)' });
    await expect(sourcesToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(panel.getByRole('link', { name: 'Зоны риска' })).toHaveCount(0);
    await sourcesToggle.click();
    await expect(panel.getByRole('link', { name: 'Зоны риска' })).toHaveAttribute('href', '/work');
    await expect(panel.getByText('Термины', { exact: true })).toBeVisible();
    await screenshot(page, 'assistant-answer-desktop');

    await page.goto('/work');
    await expect(panel).toBeVisible();
    await page.evaluate(() => { (window as unknown as { noReload: boolean }).noReload = true; });
    await panel.getByRole('link', { name: 'ЖК Северный бриз' }).click();
    await expect(page).toHaveURL(/\/objects\/7$/);
    expect(await page.evaluate(() => (window as unknown as { noReload?: boolean }).noReload)).toBe(true);
    expectCleanBrowser(harness);
  });

  test('keeps the conversation after reload, lists it and starts a new one', async ({ page }) => {
    await installMocks(page, 'mio_officer');
    await page.goto('/work');
    await openAssistantFromProfile(page);
    const panel = page.getByRole('complementary', { name: panelName });
    await panel.getByRole('button', { name: /С чего начать день\?/ }).click();
    await expect(panel.getByText('жёлтой', { exact: true })).toBeVisible();

    await panel.getByRole('button', { name: 'Расширить панель' }).click();
    await expect(panel.getByRole('button', { name: 'Сузить панель' })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(panel).toBeVisible();
    await expect(panel.getByText('жёлтой', { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Сузить панель' })).toHaveAttribute('aria-pressed', 'true');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(panel.getByRole('button', { name: 'Диалоги' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Новый диалог' })).toBeVisible();
    await panel.getByRole('button', { name: 'Диалоги' }).click();
    await expect(page.getByRole('list', { name: 'Диалоги' }).getByRole('button', { name: 'С чего начать день?', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Новый диалог' }).first().click();
    await expect(panel.getByRole('button', { name: /С чего начать день\?/ })).toBeVisible();
    await expect(panel.getByText('жёлтой', { exact: true })).toHaveCount(0);

    await panel.getByRole('button', { name: 'Диалоги' }).click();
    await page.getByRole('button', { name: 'С чего начать день?', exact: true }).click();
    await expect(panel.getByText('жёлтой', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Диалоги' }).click();
    await page.getByRole('button', { name: 'Удалить диалог: С чего начать день?' }).click();
    await expect(page.getByRole('button', { name: 'Удалить диалог: С чего начать день?' })).toHaveCount(0);
    await expect(panel.getByRole('heading', { level: 2 })).toBeVisible();
  });

  test('Enter sends, Shift+Enter adds a line, the page chip can be removed for one message', async ({ page }) => {
    const harness = await installMocks(page, 'mio_officer');
    await page.goto('/ads?ad=11');
    await openAssistantFromProfile(page);
    const panel = page.getByRole('complementary', { name: panelName });
    await expect(panel.getByText('Объявление № 11')).toBeVisible();
    await expect(panel.getByRole('button', { name: /Как подтвердить находки ИИ\?/ })).toBeVisible();
    const composer = panel.getByRole('textbox', { name: 'Сообщение ассистенту' });
    await composer.fill('первая');
    await composer.press('Shift+Enter');
    await composer.pressSequentially('вторая');
    expect(harness.mutations).toEqual([]);
    await panel.getByRole('button', { name: 'Не передавать страницу в этом сообщении' }).click();
    await composer.press('Enter');
    await expect(panel.getByText('жёлтой', { exact: true })).toBeVisible();
    expect(harness.mutations.find((item) => item.path === '/assistant/chat')?.body).toEqual({
      messages: [{ role: 'user', content: 'первая\nвторая' }],
      language: 'ru',
    });
    await expect(panel.getByText('Объявление № 11')).toBeVisible();
  });

  test('an error event shows inline and Retry asks again', async ({ page }) => {
    const failed = sse([{ type: 'delta', text: 'Начало' }, { type: 'error', code: 'llm_unavailable', message: 'down' }]);
    const harness = await installMocks(page, 'mio_officer', { assistantReplies: [failed] });
    await page.goto('/work');
    await openAssistantFromProfile(page);
    const panel = page.getByRole('complementary', { name: panelName });
    await panel.getByRole('button', { name: /С чего начать день\?/ }).click();
    await expect(panel.getByRole('alert')).toContainText('Языковая модель сейчас недоступна');
    await panel.getByRole('button', { name: 'Повторить' }).click();
    await expect(panel.getByText('жёлтой', { exact: true })).toBeVisible();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    const chats = harness.mutations.filter((item) => item.path === '/assistant/chat');
    expect(chats).toHaveLength(2);
    expect(chats[1]?.body).toEqual(chats[0]?.body);
  });

  test('a stream that ends without done is shown as an error with Retry', async ({ page }) => {
    const cut = sse([{ type: 'delta', text: 'Начало' }]);
    const harness = await installMocks(page, 'mio_officer', { assistantReplies: [cut] });
    await page.goto('/work');
    await openAssistantFromProfile(page);
    const panel = page.getByRole('complementary', { name: panelName });
    await panel.getByRole('button', { name: /С чего начать день\?/ }).click();
    await expect(panel.getByRole('alert')).toContainText('Связь прервалась');
    await panel.getByRole('button', { name: 'Повторить' }).click();
    await expect(panel.getByText('жёлтой', { exact: true })).toBeVisible();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    expect(harness.mutations.filter((item) => item.path === '/assistant/chat')).toHaveLength(2);
  });

  test('Stop aborts the stream and keeps the answer marked as stopped', async ({ page }) => {
    const harness = await installMocks(page, 'mio_officer', { assistantHangs: true });
    await page.goto('/signals');
    await openAssistantFromProfile(page);
    const panel = page.getByRole('complementary', { name: panelName });
    await panel.getByRole('button', { name: /Как отправить карточку в ГАСК\?/ }).click();
    await panel.getByRole('button', { name: 'Остановить' }).click();
    await expect(panel.getByText('Остановлено', { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Отправить' })).toBeVisible();
    expect(harness.unexpected).toEqual([]);
    expect(harness.pageErrors).toEqual([]);
  });

  test('is absent when the module is off', async ({ page }) => {
    const harness = await installMocks(page, 'mio_officer', { assistantEnabled: false });
    await page.goto('/work');
    await expect(page.getByRole('group', { name: 'Действия и настройки' })).toBeVisible();
    await page.getByTestId('header-user-trigger').click();
    await expect(page.getByTestId('profile-ask-ai-item')).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: panelName })).toHaveCount(0);
    expect(harness.unexpected).toEqual([]);
    expect(harness.pageErrors).toEqual([]);
  });

  test('covers the screen on a phone and closes back to the header button', async ({ page }) => {
    const harness = await installMocks(page, 'mio_officer');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/work');
    const opener = page.getByTestId('header-user-trigger');
    await openAssistantFromProfile(page);
    const panel = page.getByRole('complementary', { name: panelName });
    await expect(panel).toBeVisible();
    expect(await panel.boundingBox()).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
    const composer = panel.getByRole('textbox', { name: 'Сообщение ассистенту' });
    await expect(composer).toBeFocused();
    const composerRadius = await composer.locator('..').evaluate((frame) =>
      Number.parseFloat(getComputedStyle(frame).borderTopLeftRadius),
    );
    expect(composerRadius).toBeGreaterThanOrEqual(12);
    await screenshot(page, 'assistant-empty-mobile');
    await panel.getByRole('button', { name: /С чего начать день\?/ }).click();
    await expect(panel.getByText('жёлтой', { exact: true })).toBeVisible();
    await screenshot(page, 'assistant-answer-mobile');
    await panel.getByRole('link', { name: 'ЖК Северный бриз' }).click();
    await expect(page).toHaveURL(/\/objects\/7$/);
    await expect(panel).toBeHidden();
    await openAssistantFromProfile(page);
    await panel.getByRole('button', { name: 'Закрыть' }).click();
    await expect(panel).toBeHidden();
    await expect(opener).toBeFocused();
    expectCleanBrowser(harness);
  });
});

test('global search opens object and signal results on desktop and stays inside a narrow phone viewport', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer');
  await page.goto('/work');
  const search = page.getByRole('combobox', { name: 'Глобальный поиск' });
  await expect(search).toBeVisible();
  const searchPill = search.locator('xpath=..');
  const searchBox = await searchPill.boundingBox();
  expect(searchBox).not.toBeNull();
  const searchRadius = await searchPill.evaluate((element) => Number.parseFloat(getComputedStyle(element).borderTopLeftRadius));
  expect(searchRadius).toBeGreaterThanOrEqual(searchBox!.height / 2);
  const focusBeforeShortcut = await page.evaluate(() => ({
    tag: document.activeElement?.tagName ?? null,
    testId: document.activeElement instanceof HTMLElement ? document.activeElement.dataset.testid ?? null : null,
    label: document.activeElement instanceof HTMLElement ? document.activeElement.getAttribute('aria-label') : null,
  }));
  await page.keyboard.press('/');
  const focusAfterShortcut = await page.evaluate(() => ({
    tag: document.activeElement?.tagName ?? null,
    testId: document.activeElement instanceof HTMLElement ? document.activeElement.dataset.testid ?? null : null,
    label: document.activeElement instanceof HTMLElement ? document.activeElement.getAttribute('aria-label') : null,
  }));
  await expect(search, `slash shortcut focus: ${JSON.stringify({ before: focusBeforeShortcut, after: focusAfterShortcut })}`).toBeFocused();
  await search.fill('42');

  const listbox = page.getByRole('listbox', { name: 'Глобальный поиск' });
  await expect(page.getByRole('group', { name: 'Объекты' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Застройщики' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Сигнальные карточки' })).toBeVisible();
  const unlinkedDeveloper = page.getByRole('option', { name: /ТОО Без объектов/ });
  await expect(unlinkedDeveloper).toHaveAttribute('aria-disabled', 'true');
  const signal = page.getByRole('option', { name: /SIG-2026-0042/ });
  await screenshot(page, 'global-search-desktop-light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectLightOnly(page);
  await search.focus();
  await expect(listbox).toBeVisible();
  await screenshot(page, 'global-search-desktop-dark');
  await search.press('ArrowDown');
  await search.press('ArrowDown');
  await expect(signal).toHaveAttribute('aria-selected', 'true');
  await search.press('Enter');
  await expect(page).toHaveURL(/\/signals\/42$/);

  await expectLightOnly(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/work');
  const mobileSearch = page.getByRole('combobox', { name: 'Глобальный поиск' });
  await mobileSearch.fill('ЖК');
  await expect(page.getByRole('group', { name: 'Объекты' })).toBeVisible();
  const mobileObjectResult = page.getByRole('group', { name: 'Объекты' }).getByRole('option', { name: /ЖК Северный бриз/ });
  await expect(mobileObjectResult).toBeVisible();
  const resultText = await mobileObjectResult.locator('span').first().evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    text: element.textContent,
  }));
  expect(resultText.text).toContain('ЖК Северный бриз');
  expect(resultText.scrollWidth).toBeLessThanOrEqual(resultText.clientWidth + 1);
  const mobileInputGroupBox = await mobileSearch.locator('xpath=..').boundingBox();
  const mobileSearchRowBox = await mobileSearch.locator('xpath=../..').boundingBox();
  const mobileListBox = await listbox.boundingBox();
  const mobileUtilityBox = await page.getByRole('group', { name: 'Действия и настройки' }).boundingBox();
  const mobileDocumentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(mobileInputGroupBox).not.toBeNull();
  expect(mobileSearchRowBox).not.toBeNull();
  expect(mobileInputGroupBox!.x).toBe(mobileSearchRowBox!.x);
  expect(mobileInputGroupBox!.width).toBe(mobileSearchRowBox!.width);
  expect(mobileInputGroupBox!.width).toBeGreaterThan(250);
  expect(mobileUtilityBox).not.toBeNull();
  expect(mobileInputGroupBox!.y).toBeGreaterThanOrEqual(mobileUtilityBox!.y + mobileUtilityBox!.height);
  expect(mobileDocumentWidth).toBeLessThanOrEqual(320);
  expect(mobileListBox).not.toBeNull();
  expect(mobileListBox!.x).toBeGreaterThanOrEqual(0);
  expect(mobileListBox!.x + mobileListBox!.width).toBeLessThanOrEqual(320);
  await screenshot(page, 'global-search-mobile-320-light');
  await page.getByRole('group', { name: 'Объекты' }).getByRole('option', { name: /ЖК Северный бриз/ }).click();
  await expect(page).toHaveURL(/\/objects\/7$/);
  expect(harness.searchQueries).toContain('42');
  expect(harness.searchQueries).toContain('ЖК');
  expectCleanBrowser(harness);
});

test('registry staff can filter assignments and task authors and assignees get the right actions', async ({ page }) => {
  const assigneeTask = makeAssignment({
    author_id: 2,
    author_name: 'Сотрудник ГАСК',
    assignee_id: 1,
    assignee_name: 'Сотрудник МИО',
    task: 'Проверить сведения по объекту',
    due_date: '2026-10-01',
    is_overdue: true,
    days_overdue: 15,
  });
  const authorTask = makeAssignment({
    id: 62,
    author_id: 1,
    author_name: 'Сотрудник МИО',
    assignee_id: 2,
    assignee_name: 'Сотрудник ГАСК',
    task: 'Проверить документы по объекту',
    due_date: '2026-10-25',
  });
  const harness = await installMocks(page, 'mio_officer', { assignments: [assigneeTask, authorTask] });

  await page.goto('/work');
  await expect(page.getByRole('heading', { level: 2, name: 'Мои поручения' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Все поручения на контроле' })).toHaveAttribute('href', '/control');
  await screenshot(page, 'work-assignments-light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectLightOnly(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectLightOnly(page);
  await screenshot(page, 'work-assignments-light-under-dark-os');
  const mine = page.getByRole('listitem').filter({ hasText: assigneeTask.task });
  await expect(mine.getByRole('button', { name: 'Отметить выполненным' })).toBeVisible();
  await expect(mine.getByRole('button', { name: 'Отменить поручение' })).toHaveCount(0);

  await page.goto('/control?filter=overdue');
  await expect(page.getByRole('heading', { level: 1, name: 'На контроле' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Просроченные' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('row').filter({ hasText: assigneeTask.task })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: authorTask.task })).toHaveCount(0);
  expect(harness.assignmentRequests.some((url) => url.searchParams.get('overdue') === 'true')).toBe(true);
  await expectLightOnly(page);
  await screenshot(page, 'control-assignments-light-under-dark-os');
  await expectLightOnly(page);
  await screenshot(page, 'control-assignments-light');

  await page.goto('/objects/7#assignments');
  await expect(page.getByRole('heading', { name: 'Поручения' })).toBeVisible();
  await screenshot(page, 'object-assignments-light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectLightOnly(page);
  await expectLightOnly(page);
  await screenshot(page, 'object-assignments-light-under-dark-os');
  const assigneeItem = page.getByRole('listitem').filter({ hasText: assigneeTask.task });
  const authorItem = page.getByRole('listitem').filter({ hasText: authorTask.task });
  await expect(assigneeItem.getByRole('button', { name: 'Отметить выполненным' })).toBeVisible();
  await expect(assigneeItem.getByRole('button', { name: 'Отменить поручение' })).toHaveCount(0);
  await expect(authorItem.getByRole('button', { name: 'Отметить выполненным' })).toBeVisible();
  await authorItem.getByRole('button', { name: 'Отменить поручение' }).click();
  await expect(authorItem).toContainText('Отменить это поручение?');
  await authorItem.getByRole('button', { name: 'Да, отменить' }).click();
  await expect.poll(() => harness.mutations.filter((item) => item.path === '/assignments/62')).toHaveLength(1);
  expect(harness.mutations.find((item) => item.path === '/assignments/62')?.body).toEqual({ status: 'cancelled' });

  await assigneeItem.getByRole('button', { name: 'Отметить выполненным' }).click();
  const completeDialog = page.getByRole('dialog', { name: 'Отметить поручение выполненным' });
  await completeDialog.getByRole('textbox', { name: 'Что сделано и что выяснилось' }).fill('Сведения проверены.');
  await completeDialog.getByRole('button', { name: 'Отметить выполненным' }).click();
  await expect.poll(() => harness.mutations.filter((item) => item.path === '/assignments/61')).toHaveLength(1);
  expect(harness.mutations.find((item) => item.path === '/assignments/61')?.body).toEqual({ status: 'done', result: 'Сведения проверены.' });
  expectCleanBrowser(harness);
});

test('recipients are redirected away from registry assignment control', async ({ page }) => {
  const harness = await installMocks(page, 'gask');
  await page.goto('/control');
  await expect(page).toHaveURL(/\/signals$/);
  await expect(page.getByRole('link', { name: 'На контроле' })).toHaveCount(0);
  expect(harness.unexpected).toEqual([]);
  expect(harness.pageErrors).toEqual([]);
});

test('object register exports its complete filtered query and fits the mobile header', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer', { exportDelayMs: 200 });
  await page.goto('/objects?zone=red&territory=11&district=110&q=North&page=4');

  const exportButton = page.getByRole('button', { name: 'Скачать Excel' });
  await expect(exportButton).toBeVisible();
  await expect.poll(() => harness.objectListRequests.length).toBeGreaterThan(0);
  const listRequest = harness.objectListRequests.at(-1)!;
  expect(listRequest.searchParams.get('zone')).toBe('red');
  expect(listRequest.searchParams.get('territory_id')).toBe('11');
  expect(listRequest.searchParams.get('district_id')).toBe('110');
  expect(listRequest.searchParams.get('q')).toBe('North');
  expect(listRequest.searchParams.get('limit')).toBe('25');
  expect(listRequest.searchParams.get('offset')).toBe('75');

  const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/objects/export.xlsx');
  const downloadPromise = page.waitForEvent('download');
  await exportButton.click();
  await expect(exportButton).toHaveAttribute('aria-busy', 'true');
  const response = await responsePromise;
  expect(response.headers()['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^SAQ_QURYLYS_ЖК_\d{4}-\d{2}-\d{2}\.xlsx$/);
  const exportRequest = harness.downloadRequests.find(({ url }) => url.pathname === '/api/v1/objects/export.xlsx');
  expect(exportRequest?.authorization).toBe('Bearer mock-ui-session');
  expect(exportRequest?.url.searchParams.get('zone')).toBe('red');
  expect(exportRequest?.url.searchParams.get('territory_id')).toBe('11');
  expect(exportRequest?.url.searchParams.get('district_id')).toBe('110');
  expect(exportRequest?.url.searchParams.get('q')).toBe('North');
  expect(exportRequest?.url.searchParams.has('limit')).toBe(false);
  expect(exportRequest?.url.searchParams.has('offset')).toBe(false);

  await page.setViewportSize({ width: 320, height: 844 });
  await expect(exportButton).toBeVisible();
  const buttonBox = await exportButton.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(buttonBox!.x).toBeGreaterThanOrEqual(0);
  expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await screenshot(page, 'objects-export-mobile-320');
  expectCleanBrowser(harness);
});

test('signal workbook follows list filters, surfaces export limits, and is localized', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer', {
    exportDelayMs: 200,
    exportFailurePaths: ['/signals/export.xlsx'],
    expectedExport413Responses: 1,
  });
  await page.goto('/signals?status=responded&object_id=7&page=4');

  const exportButton = page.getByRole('button', { name: 'Скачать Excel' });
  await expect(exportButton).toBeVisible();
  await expect.poll(() => harness.listRequests.some((url) =>
    url.searchParams.get('status') === 'responded' &&
    url.searchParams.get('object_id') === '7' &&
    url.searchParams.get('offset') === '75',
  )).toBe(true);

  await exportButton.click();
  await expect(exportButton).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByText('Не удалось скачать карточки')).toBeVisible();
  await expect(page.getByText('Экспорт превышает лимит в 10 000 строк. Уточните фильтры.')).toBeVisible();
  const failedExport = harness.downloadRequests.find(({ url }) => url.pathname === '/api/v1/signals/export.xlsx');
  expect(failedExport?.authorization).toBe('Bearer mock-ui-session');
  expect(failedExport?.url.searchParams.get('status')).toBe('responded');
  expect(failedExport?.url.searchParams.get('object_id')).toBe('7');
  expect(failedExport?.url.searchParams.has('limit')).toBe(false);
  expect(failedExport?.url.searchParams.has('offset')).toBe(false);

  harness.state.exportFailurePaths = [];
  const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/signals/export.xlsx');
  const downloadPromise = page.waitForEvent('download');
  await exportButton.click();
  const response = await responsePromise;
  expect(response.headers()['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^SAQ_QURYLYS_Сигналы_\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(harness.downloadRequests).toHaveLength(2);

  await page.evaluate(() => localStorage.setItem('saq_lang', 'kk'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Excel жүктеп алу' })).toBeVisible();
  harness.state.exportFailurePaths = ['/signals/export.xlsx'];
  harness.state.expectedExport413Responses = 2;
  await page.getByRole('button', { name: 'Excel жүктеп алу' }).click();
  await expect(page.getByText('Экспорт 10 000 жол шегінен асты. Сүзгілерді нақтылаңыз.')).toBeVisible();
  expectCleanBrowser(harness);
});

test('recipient signal export omits the unavailable object filter and keeps authorization', async ({ page }) => {
  const harness = await installMocks(page, 'gask', { signals: [makeSignal('sent', 'gask')] });
  await page.goto('/signals?status=sent&object_id=7&page=2');

  const exportButton = page.getByRole('button', { name: 'Скачать Excel' });
  await expect(exportButton).toBeVisible();
  await expect.poll(() => harness.listRequests.some((url) =>
    url.searchParams.get('status') === 'sent' && !url.searchParams.has('object_id'),
  )).toBe(true);
  const downloadPromise = page.waitForEvent('download');
  await exportButton.click();
  await downloadPromise;

  const exportRequest = harness.downloadRequests.find(({ url }) => url.pathname === '/api/v1/signals/export.xlsx');
  expect(exportRequest?.authorization).toBe('Bearer mock-ui-session');
  expect(exportRequest?.url.searchParams.get('status')).toBe('sent');
  expect(exportRequest?.url.searchParams.has('object_id')).toBe(false);
  expect(exportRequest?.url.searchParams.has('limit')).toBe(false);
  expect(exportRequest?.url.searchParams.has('offset')).toBe(false);
  expectCleanBrowser(harness);
});

test('work reports and object dossiers download authenticated PDF files', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer');
  await page.goto('/work');
  const reportPanel = page.locator('section[aria-labelledby="work-report-title"]');
  const reportZones = reportPanel.getByRole('combobox');
  const reportScreenshot = async (name: string) => {
    await screenshot(page, name);
  };

  await page.locator('details').filter({ hasText: t('work.openReport') }).locator('summary').click();
  await expect(reportZones).toBeVisible();
  await expect(reportZones).toContainText('Красные и жёлтые');
  await reportScreenshot('report-priority-light-ru');
  const reportDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сформировать доклад (PDF)' }).click();
  const reportDownload = await reportDownloadPromise;
  expect(reportDownload.suggestedFilename()).toMatch(/^doklad-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.pdf$/);
  await screenshot(page, 'work-report-light');
  const reportRequests = () => harness.downloadRequests.filter(({ url }) => url.pathname === '/api/v1/dashboard/report.pdf');
  const priorityRequests = reportRequests();
  expect(priorityRequests).toHaveLength(1);
  expect(priorityRequests[0]!.url.searchParams.get('zones')).toBe('priority');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectLightOnly(page);
  await reportScreenshot('report-priority-light-under-dark-os-ru');
  await screenshot(page, 'work-report-light-under-dark-os');
  await reportZones.click();
  await expect(page.getByRole('option', { name: 'Красные и жёлтые' })).toBeVisible();
  await page.getByRole('option', { name: 'Все объекты', exact: true }).click();
  await expect(reportZones).toContainText('Все объекты');
  await reportScreenshot('report-all-light-under-dark-os-ru');
  const allZonesDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сформировать доклад (PDF)' }).click();
  const allZonesDownload = await allZonesDownloadPromise;
  expect(allZonesDownload.suggestedFilename()).toMatch(/^doklad-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.pdf$/);
  const completedReportRequests = reportRequests();
  expect(completedReportRequests).toHaveLength(2);
  const priorityRequest = completedReportRequests[0]!;
  const allZonesRequest = completedReportRequests[1]!;
  expect(priorityRequest.authorization).toBe('Bearer mock-ui-session');
  expect(allZonesRequest.authorization).toBe('Bearer mock-ui-session');
  expect(priorityRequest.url.searchParams.get('zones')).toBe('priority');
  expect(allZonesRequest.url.searchParams.get('zones')).toBe('all');
  for (const request of [priorityRequest, allZonesRequest]) {
    expect(request.url.searchParams.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(request.url.searchParams.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(request.url.searchParams.get('from')! <= request.url.searchParams.get('to')!).toBe(true);
  }
  expect(allZonesRequest.url.searchParams.get('from')).toBe(priorityRequest.url.searchParams.get('from'));
  expect(allZonesRequest.url.searchParams.get('to')).toBe(priorityRequest.url.searchParams.get('to'));

  await page.keyboard.press('Escape');
  await expectLightOnly(page);
  await reportScreenshot('report-all-light-ru');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/work');
  await page.locator('details').filter({ hasText: t('work.openReport') }).locator('summary').click();
  await expect(reportPanel.getByRole('combobox')).toContainText('Красные и жёлтые');
  await reportScreenshot('report-mobile-320-light-ru-priority');
  const mobileReportButton = reportPanel.getByRole('button', { name: /PDF/ });
  await expect(reportPanel).toBeVisible();
  await expect(mobileReportButton).toBeVisible();
  const normalPanelBox = await reportPanel.boundingBox();
  const normalButtonBox = await mobileReportButton.boundingBox();
  const normalZonesBox = await reportPanel.getByRole('combobox').boundingBox();
  expect(normalPanelBox).not.toBeNull();
  expect(normalButtonBox).not.toBeNull();
  expect(normalZonesBox).not.toBeNull();
  expect(normalButtonBox!.x).toBeGreaterThanOrEqual(normalPanelBox!.x);
  expect(normalButtonBox!.x + normalButtonBox!.width).toBeLessThanOrEqual(normalPanelBox!.x + normalPanelBox!.width);
  expect(normalZonesBox!.x).toBeGreaterThanOrEqual(normalPanelBox!.x);
  expect(normalZonesBox!.x + normalZonesBox!.width).toBeLessThanOrEqual(normalPanelBox!.x + normalPanelBox!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await screenshot(page, 'work-report-mobile-320-light');

  await setLargeFont(page, true);
  for (const language of ['RU', 'ҚАЗ']) {
    await selectLanguage(page, language === 'RU' ? 'ru' : 'kk');
    const currentZones = reportPanel.getByRole('combobox');
    const priorityLabel = language === 'RU' ? 'Красные и жёлтые' : 'Қызыл және сары аймақтар';
    const allLabel = language === 'RU' ? 'Все объекты' : 'Барлық объектілер';
    const selectedLabel = language === 'RU' ? priorityLabel : allLabel;
    await expect(reportPanel.getByText(language === 'RU' ? 'Перечень объектов' : 'Объектілер тізімі')).toBeVisible();
    await expect(currentZones).toContainText(selectedLabel);
    await currentZones.click();
    await expect(page.getByRole('option', { name: priorityLabel, exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: allLabel, exact: true })).toBeVisible();
    if (language === 'RU') {
      await page.getByRole('option', { name: allLabel, exact: true }).click();
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(currentZones).toContainText(allLabel);
    await expect(mobileReportButton).toBeVisible();
    const panelBox = await reportPanel.boundingBox();
    const buttonBox = await mobileReportButton.boundingBox();
    const zonesBox = await currentZones.boundingBox();
    const labelBox = await mobileReportButton.locator('span').boundingBox();
    expect(panelBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    expect(zonesBox).not.toBeNull();
    expect(labelBox).not.toBeNull();
    expect(buttonBox!.x).toBeGreaterThanOrEqual(panelBox!.x);
    expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width);
    expect(zonesBox!.x).toBeGreaterThanOrEqual(panelBox!.x);
    expect(zonesBox!.x + zonesBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width);
    expect(labelBox!.x).toBeGreaterThanOrEqual(buttonBox!.x);
    expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(buttonBox!.x + buttonBox!.width);
    expect(labelBox!.y).toBeGreaterThanOrEqual(buttonBox!.y);
    expect(labelBox!.y + labelBox!.height).toBeLessThanOrEqual(buttonBox!.y + buttonBox!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await reportScreenshot(`report-mobile-320-large-${language === 'RU' ? 'ru' : 'kk'}-all`);
    await screenshot(page, `work-report-mobile-320-large-${language === 'RU' ? 'ru' : 'kk'}`);
  }
  await selectLanguage(page, 'ru');
  await page.keyboard.press('Escape');
  await setLargeFont(page, false);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectLightOnly(page);
  await page.keyboard.press('Escape');

  await page.goto('/objects/7');
  const dossierDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сформировать дело' }).click();
  const dossierDownload = await dossierDownloadPromise;
  expect(dossierDownload.suggestedFilename()).toBe('D-07-dossier.pdf');
  const dossierRequest = harness.downloadRequests.find(({ url }) => url.pathname === '/api/v1/objects/7/dossier.pdf');
  expect(dossierRequest?.authorization).toBe('Bearer mock-ui-session');
  await screenshot(page, 'object-dossier-light-under-dark-os');
  await expectLightOnly(page);
  await screenshot(page, 'object-dossier-light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectLightOnly(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /Оформление/ })).toHaveCount(0);
  await page.emulateMedia({ media: 'print' });
  await expect.poll(() => page.evaluate(() =>
    window.matchMedia('print').matches &&
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() === '#fff' &&
    getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)',
  )).toBe(true);
  const printState = await page.evaluate(() => {
    const hiddenControls = Array.from(document.querySelectorAll<HTMLElement>('[data-print="hide"]'));
    const sidebar = document.querySelector<HTMLElement>('aside[data-print="hide"]');
    const mainShell = document.querySelector<HTMLElement>('[data-print="main-shell"]');
    const main = document.querySelector<HTMLElement>('main');
    return {
      theme: document.documentElement.dataset.theme,
      pathname: window.location.pathname,
      printMediaMatches: window.matchMedia('print').matches,
      hiddenControlsAreHidden: hiddenControls.every((element) => getComputedStyle(element).display === 'none'),
      sidebarAbsent: sidebar === null,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      rootBgToken: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
      bodyBgToken: getComputedStyle(document.body).getPropertyValue('--bg').trim(),
      mainShellPaddingRight: mainShell ? getComputedStyle(mainShell).paddingRight : null,
      mainMargin: main ? getComputedStyle(main).margin : null,
      mainPadding: main ? getComputedStyle(main).padding : null,
      mainWidth: main?.getBoundingClientRect().width ?? 0,
      viewportWidth: window.innerWidth,
    };
  });
  expect(printState.theme).toBe('light');
  expect(printState.pathname).toBe('/objects/7');
  expect(printState.printMediaMatches).toBe(true);
  expect(printState.hiddenControlsAreHidden).toBe(true);
  expect(printState.sidebarAbsent).toBe(true);
  await expect(page.getByTestId('risk-plain-summary')).toBeVisible();
  expect(printState.bodyBackground).toBe('rgb(255, 255, 255)');
  expect(printState.bodyColor).toBe('rgb(0, 0, 0)');
  expect(printState.rootBgToken).toBe('#fff');
  expect(printState.bodyBgToken).toBe('#fff');
  expect(printState.mainShellPaddingRight).toBe('0px');
  expect(printState.mainMargin).toBe('0px');
  expect(printState.mainPadding).toBe('0px');
  expect(printState.mainWidth).toBeGreaterThan(0);
  expect(printState.mainWidth).toBe(printState.viewportWidth);
  await screenshot(page, 'object-dossier-print');
  expectCleanBrowser(harness);
});

test('mocked logout sends the bearer token and does not restore it on reload', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer');
  await page.goto('/work');
  await page.getByRole('button', { name: 'Меню пользователя' }).first().click();
  await page.getByRole('menuitem', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('saq_token'))).toBeNull();
  expect(harness.logoutAuthorization).toBe('Bearer mock-ui-session');
  expect(harness.mutations.filter((item) => item.method === 'POST' && item.path === '/auth/logout')).toHaveLength(1);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();
  await page.goto('/work');
  await expect(page).toHaveURL(/\/login$/);
  expect(harness.pageErrors).toEqual([]);
});

test('manual ad photo selection enforces per-file, count and aggregate limits', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer');
  await page.goto('/ads');
  await page.getByRole('button', { name: t('ads:actions.manual') }).click();
  const dialog = page.getByRole('dialog', { name: t('ads:manual.title') });
  const input = dialog.locator('input[type="file"]');
  await expect(input).toBeEnabled();
  await expect(dialog.getByText(t('ads:manual.photosHint', { maxPhotos: 20, maxFile: 25, maxTotal: 100 }))).toBeVisible();
  await page.evaluate(() => {
    const trackedWindow = window as Window & { __createdPreviewUrls?: number };
    trackedWindow.__createdPreviewUrls = 0;
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object) => {
      trackedWindow.__createdPreviewUrls = (trackedWindow.__createdPreviewUrls ?? 0) + 1;
      return original(object);
    };
  });
  const selectSizedPhotos = (photos: Array<{ name: string; size: number }>) =>
    input.evaluate((element, selectedPhotos) => {
      const fileInput = element as HTMLInputElement;
      const files = new DataTransfer();
      for (const photo of selectedPhotos) {
        const file = new File(['x'], photo.name, { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: photo.size });
        files.items.add(file);
      }
      fileInput.files = files.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    }, photos);
  const removePhoto = async (name: string) => {
    await dialog.getByRole('button', { name: t('ads:manual.removePhoto', { name }) }).click();
  };
  const mib = 1024 * 1024;

  await selectSizedPhotos([{ name: 'photo-26mb.png', size: 26 * mib }]);
  await expect(dialog.getByText(t('ads:manual.photosFileTooLarge', { name: 'photo-26mb.png', max: 25 }))).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'photo-26mb.png' })).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { __createdPreviewUrls?: number }).__createdPreviewUrls)).toBe(0);

  await selectSizedPhotos([
    { name: 'photo-24-a.png', size: 24.5 * mib },
    { name: 'photo-24-b.png', size: 24.5 * mib },
  ]);
  await expect(dialog.getByRole('img', { name: 'photo-24-a.png' })).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'photo-24-b.png' })).toBeVisible();
  await expect(dialog.getByText(t('ads:manual.photosTotalTooLarge', { max: 100 }))).toHaveCount(0);
  await removePhoto('photo-24-a.png');
  await removePhoto('photo-24-b.png');

  await selectSizedPhotos([
    { name: 'photo-20-a.png', size: 20 * mib },
    { name: 'photo-20-b.png', size: 20 * mib },
    { name: 'photo-20-c.png', size: 20 * mib },
  ]);
  await expect(dialog.locator('img')).toHaveCount(3);
  await removePhoto('photo-20-a.png');
  await removePhoto('photo-20-b.png');
  await removePhoto('photo-20-c.png');

  await selectSizedPhotos(Array.from({ length: 4 }, (_, index) => ({ name: `photo-25-${index + 1}.png`, size: 25 * mib })));
  await expect(dialog.locator('img')).toHaveCount(4);
  await selectSizedPhotos([{ name: 'photo-over-total.png', size: 1 }]);
  await expect(dialog.getByText(t('ads:manual.photosTotalTooLarge', { max: 100 }))).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'photo-over-total.png' })).toHaveCount(0);
  for (let index = 1; index <= 4; index += 1) await removePhoto(`photo-25-${index}.png`);

  await selectSizedPhotos(Array.from({ length: 21 }, (_, index) => ({ name: `photo-${index + 1}.png`, size: 1 })));
  await expect(dialog.getByText(t('ads:manual.photosTooMany', { max: 20 }))).toBeVisible();
  await expect(dialog.locator('img')).toHaveCount(20);
  await expect(dialog.getByRole('img', { name: 'photo-21.png' })).toHaveCount(0);
  expect(harness.mutations.filter(({ method, path }) => method === 'POST' && path === '/ads/manual')).toHaveLength(0);
});

test('manual ad photo selection uses the configured per-file limit', async ({ page }) => {
  const mib = 1024 * 1024;
  await installMocks(page, 'mio_officer', {
    adUploadLimits: { max_file_bytes: 10 * mib, max_total_bytes: 100 * mib, max_photos: 20 },
  });
  await page.goto('/ads');
  await page.getByRole('button', { name: t('ads:actions.manual') }).click();
  const dialog = page.getByRole('dialog', { name: t('ads:manual.title') });
  const input = dialog.locator('input[type="file"]');
  await expect(input).toBeEnabled();
  await expect(dialog.getByText(t('ads:manual.photosHint', { maxPhotos: 20, maxFile: 10, maxTotal: 100 }))).toBeVisible();
  const selectSizedPhoto = (name: string, size: number) =>
    input.evaluate((element, selected) => {
      const file = new File(['x'], selected.name, { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: selected.size });
      const files = new DataTransfer();
      files.items.add(file);
      const fileInput = element as HTMLInputElement;
      fileInput.files = files.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    }, { name, size });

  await selectSizedPhoto('photo-11mb.png', 11 * mib);
  await expect(dialog.getByText(t('ads:manual.photosFileTooLarge', { name: 'photo-11mb.png', max: 10 }))).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'photo-11mb.png' })).toHaveCount(0);
  await selectSizedPhoto('photo-10mb.png', 10 * mib);
  await expect(dialog.getByRole('img', { name: 'photo-10mb.png' })).toBeVisible();
});

test('manual ad photo picker accepts JPEG, PNG and WebP and rejects other image formats', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer');
  await page.goto('/ads');
  await page.getByRole('button', { name: t('ads:actions.manual') }).click();
  const dialog = page.getByRole('dialog', { name: t('ads:manual.title') });
  const input = dialog.locator('input[type="file"]');
  await expect(input).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');

  let photoInput = input;
  const selectPhoto = (name: string, mimeType: string, contents: number[] = [120]) =>
    photoInput.evaluate((element, selected) => {
      const file = new File([new Uint8Array(selected.contents)], selected.name, { type: selected.mimeType });
      const files = new DataTransfer();
      files.items.add(file);
      const fileInput = element as HTMLInputElement;
      fileInput.files = files.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    }, { name, mimeType, contents });

  await selectPhoto('animation.png', 'image/gif');
  await expect(dialog.getByText(t('ads:manual.photosUnsupportedType', { name: 'animation.png' }))).toBeVisible();
  await expect(dialog.locator('img')).toHaveCount(0);

  await selectPhoto('building.avif', 'image/avif');
  await expect(dialog.getByText(t('ads:manual.photosUnsupportedType', { name: 'building.avif' }))).toBeVisible();
  await expect(dialog.locator('img')).toHaveCount(0);

  await dialog.getByLabel(t('ads:manual.text')).fill('Объявление без неподдерживаемых фото');
  await dialog.getByRole('button', { name: t('ads:manual.submit') }).click();
  await expect(dialog).toBeHidden();
  const manualAds = harness.mutations.filter(({ method, path }) => method === 'POST' && path === '/ads/manual');
  expect(manualAds).toHaveLength(1);
  expect(manualAds[0]?.body).not.toContain('name="photos"');
  expect(manualAds[0]?.body).not.toContain('filename=');

  await page.getByRole('button', { name: t('ads:actions.manual') }).click();
  const reopenedDialog = page.getByRole('dialog', { name: t('ads:manual.title') });
  const reopenedInput = reopenedDialog.locator('input[type="file"]');
  photoInput = reopenedInput;
  const supportedPhotos = [
    ['photo.png', 'image/png'],
    ['photo.jpg', 'image/jpeg'],
    ['photo.webp', 'image/webp'],
    ['photo-without-mime.png', ''],
  ] as const;
  for (const [name, mimeType] of supportedPhotos) {
    const contents = name.endsWith('.png') ? Array.from(transparentPng) : undefined;
    await selectPhoto(name, mimeType, contents);
  }
  for (const [name] of supportedPhotos) await expect(reopenedDialog.getByRole('img', { name })).toBeVisible();
  await expect(reopenedDialog.locator('img')).toHaveCount(supportedPhotos.length);
  expect(harness.mutations.filter(({ method, path }) => method === 'POST' && path === '/ads/manual')).toHaveLength(1);
  await expect(reopenedInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');
});

test('manual ad photo picker stays disabled until upload limits load and offers retry', async ({ page }) => {
  await installMocks(page, 'mio_officer', { adUploadLimitsFailures: 1 });
  await page.goto('/ads');
  await page.getByRole('button', { name: t('ads:actions.manual') }).click();
  const dialog = page.getByRole('dialog', { name: t('ads:manual.title') });
  const input = dialog.locator('input[type="file"]');

  await expect(dialog.getByRole('alert')).toContainText(t('ads:manual.photosLimitsUnavailable'));
  await expect(input).toBeDisabled();
  await expect(dialog.getByRole('button', { name: t('ads:manual.submit') })).toBeEnabled();
  await dialog.getByRole('button', { name: t('common:retry') }).click();
  await expect(input).toBeEnabled();
  await expect(dialog.getByRole('button', { name: t('ads:manual.submit') })).toBeEnabled();
});

test('manual ad without photos submits when upload limits stay unavailable', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer');
  const limitResponses: number[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname === '/api/v1/ads/upload-limits') limitResponses.push(response.status());
  });
  await page.route('**/api/v1/ads/upload-limits', (route) =>
    json(route, { detail: { code: 'temporary_failure', message: 'Could not load upload limits' } }, 500),
  );
  await page.goto('/ads');
  await page.getByRole('button', { name: t('ads:actions.manual') }).click();
  const dialog = page.getByRole('dialog', { name: t('ads:manual.title') });
  const input = dialog.locator('input[type="file"]');
  await expect(dialog.getByRole('alert')).toContainText(t('ads:manual.photosLimitsUnavailable'));
  await expect.poll(() => limitResponses.length).toBeGreaterThan(0);
  expect(limitResponses.every((status) => status === 500)).toBe(true);
  await expect(input).toBeDisabled();
  await dialog.getByLabel(t('ads:manual.text')).fill('Текст объявления без фото');
  await dialog.getByRole('combobox', { name: t('ads:manual.platform') }).click();
  await page.getByRole('option', { name: 'Instagram' }).click();
  const submit = dialog.getByRole('button', { name: t('ads:manual.submit') });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText(t('common:toasts.created'))).toBeVisible();
  const manualAds = harness.mutations.filter(({ method, path }) => method === 'POST' && path === '/ads/manual');
  expect(manualAds).toHaveLength(1);
  const [manualAd] = manualAds;
  expect(manualAd).toBeDefined();
  expect(manualAd?.body).toContain('name="text"');
  expect(manualAd?.body).toContain('name="platform"');
  expect(manualAd?.body).not.toContain('name="photos"');
  expect(manualAd?.body).not.toContain('filename=');
  expect(harness.unexpected).toEqual([]);
});

test('an old pending ad keeps polling until capture and OCR reach terminal states', async ({ page }) => {
  const pendingAd = {
    ...structuredClone(adFixture),
    created_at: '2020-01-01T00:00:00Z',
    capture_status: 'pending' as const,
    ocr_status: 'pending' as const,
  };
  const harness = await installMocks(page, 'mio_officer', { ads: [pendingAd] });
  let adsResponses = 0;
  page.on('response', (response) => {
    if (new URL(response.url()).pathname === '/api/v1/ads') adsResponses += 1;
  });

  await page.goto('/ads');
  await expect.poll(() => adsResponses, { timeout: 7_000 }).toBe(2);
  harness.state.ads = [{ ...pendingAd, capture_status: 'done', ocr_status: 'done' }];
  await expect.poll(() => adsResponses, { timeout: 5_000 }).toBe(3);
  await page.waitForTimeout(3_500);
  expect(adsResponses).toBe(3);
});

test('a 401 for the current bearer token ends the authenticated session', async ({ page }) => {
  const harness = await installMocks(page, 'mio_officer');
  let authorization: string | null = null;
  await page.route(new RegExp('/api/v1/ads(?:\\?.*)?$'), async (route) => {
    authorization = route.request().headers().authorization ?? null;
    await json(route, { detail: 'Unauthenticated' }, 401);
  });

  await page.goto('/ads');
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('saq_token'))).toBeNull();
  expect(authorization).toBe('Bearer mock-ui-session');
  expect(harness.pageErrors).toEqual([]);
});
