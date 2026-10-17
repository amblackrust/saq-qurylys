import { useMemo, useState } from 'react';
import { IconHistory, IconInfoCircle, IconMap2 } from '@tabler/icons-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDashboard } from '@/api/hooks/objects';
import { useDistricts } from '@/api/hooks/reference';
import { useTimeline } from '@/api/hooks/timeline';
import type { Dashboard, Zone } from '@/api/types';
import { PageHeader } from '@/components/PageHeader';
import { QueryBoundary } from '@/components/QueryState';
import { ZoneDisclaimer } from '@/components/ZoneDisclaimer';
import { TerritoryFilter } from '@/features/objects/list/TerritoryFilter';
import { parseId, patchParams, useCityScope } from '@/features/objects/list/filters';
import { useFormat } from '@/i18n/useFormat';
import { toLatLon } from '@/lib/geo';
import { DashboardMap } from './DashboardMap';
import { ObjectList } from './ObjectList';
import { TimeMachineBar } from './TimeMachineBar';
import { countZones, rowsAtFrame, useTimeMachine } from './timeMachine';
import { ZoneCounters } from './ZoneCounters';
import { DemoBadge } from '@/components/DemoBadge';
import { ZoneBadge } from '@/components/Zone';
import { useKeyStatusLabel } from '@/i18n/useEnum';

/** Space at the bottom of the map that the time machine bar covers; markers are fitted above it. */
const TIME_BAR_INSET = 130;

export function MapPage() {
  const { t } = useTranslation('map');
  const { t: common } = useTranslation();
  const format = useFormat();
  const [params] = useSearchParams();
  const territoryId = parseId(params.get('territory'));
  const districtId = parseId(params.get('district'));
  // Zone is a client-side narrowing of the loaded objects, so it stays out of the URL.
  const [zone, setZone] = useState<Zone | null>(null);
  const [timeMachine, setTimeMachine] = useState(false);

  const dashboard = useDashboard({ territory_id: territoryId ?? undefined, district_id: districtId ?? undefined });
  const updatedAt = dashboard.data?.last_updated_at ?? null;
  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={updatedAt ? common('lastUpdated', { value: format.dateTime(updatedAt) }) : undefined}
        actions={
          <>
            <Button
              variant={timeMachine ? 'default' : 'secondary'}
              aria-pressed={timeMachine}
              onClick={() => setTimeMachine((on) => !on)}
            >
              <IconHistory />
              {t('timeMachine.toggle')}
            </Button>
            <Button asChild variant="secondary">
              <Link to="/signals">{t('links.signals')}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/ads">{t('links.ads')}</Link>
            </Button>
          </>
        }
      />
      <QueryBoundary query={dashboard}>
        {(data) => (
          <DashboardContent
            data={data}
            territoryId={territoryId}
            districtId={districtId}
            zone={zone}
            stale={dashboard.isPlaceholderData}
            onToggleZone={(next) => setZone((current) => (current === next ? null : next))}
            onClearZone={() => setZone(null)}
            timeMachine={timeMachine}
            onCloseTimeMachine={() => setTimeMachine(false)}
          />
        )}
      </QueryBoundary>
    </>
  );
}

interface ContentProps {
  data: Dashboard;
  territoryId: number | null;
  districtId: number | null;
  zone: Zone | null;
  /** showing the previous filter's data while the new one loads */
  stale: boolean;
  onToggleZone: (zone: Zone) => void;
  onClearZone: () => void;
  /** the time machine is open: the map can show the state of a past date */
  timeMachine: boolean;
  onCloseTimeMachine: () => void;
}

function DashboardContent({
  data,
  territoryId,
  districtId,
  zone,
  stale,
  onToggleZone,
  onClearZone,
  timeMachine,
  onCloseTimeMachine,
}: ContentProps) {
  const { t } = useTranslation('map');
  const { t: common } = useTranslation();
  const [, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const keyStatus = useKeyStatusLabel();
  const { city } = useCityScope(territoryId);
  const { data: districts } = useDistricts(city?.id);

  const timeline = useTimeline(timeMachine);
  const frames = timeline.data?.frames;
  const machine = useTimeMachine(frames?.length ?? 0, timeMachine);
  // Today (the last frame), a closed time machine and a history that is still loading all show live data.
  const frame = timeMachine && !machine.isToday ? frames?.[machine.index] : undefined;
  const snapshot = useMemo(() => (frame ? rowsAtFrame(data.objects, frame) : data.objects), [data.objects, frame]);
  const counts = useMemo(() => (frame ? countZones(snapshot) : data.counts), [data.counts, frame, snapshot]);
  // A stable array: the map pushes new data to MapLibre whenever this identity changes.
  const rows = useMemo(
    () => (zone === null ? snapshot : snapshot.filter((row) => row.zone === zone)),
    [snapshot, zone],
  );
  const withoutCoordinates = rows.filter((row) => row.lat === null || row.lon === null).length;
  const hasFilters = territoryId !== null || districtId !== null || zone !== null;
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const selectObject = (id: number) => {
    setSelectedId(id);
    setHighlightedId(id);
  };

  return (
    <div className="flex flex-col gap-3.5 transition-opacity duration-(--dur) data-stale:opacity-60" data-stale={stale || undefined}>
      <ZoneDisclaimer />
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface px-3 py-3 shadow-1 dark:shadow-none md:px-4">
        <div className="min-w-[min(100%,300px)] flex-1">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-2">
            <IconMap2 className="size-4" aria-hidden />
            {t('filters.territory')}
          </label>
          <TerritoryFilter
            territoryId={territoryId}
            districtId={districtId}
            onChange={({ territory, district }) => {
              setParams((prev) =>
                patchParams(prev, {
                  territory: territory === null ? null : String(territory),
                  district: district === null ? null : String(district),
                }),
              );
            }}
          />
        </div>
        <ZoneCounters counts={counts} active={zone} onToggle={onToggleZone} animated={frame === undefined} />
        {hasFilters && (
          <Button
            className="shrink-0"
            variant="ghost"
            onClick={() => {
              onClearZone();
              setParams((prev) => patchParams(prev, { territory: null, district: null }));
            }}
          >
            {common('reset')}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 [--map-h:clamp(320px,58dvh,760px)] xl:grid-cols-[minmax(0,1fr)_360px] xl:items-stretch xl:[--map-h:min(70dvh,760px)]">
        <div className="min-w-0">
          <DashboardMap
            objects={rows}
            districts={districts}
            fallbackCenter={city ? toLatLon(city) : null}
            highlightedId={highlightedId}
            onOpen={(id) => void navigate(`/objects/${id}`)}
            historical={frame !== undefined}
            bottomInset={timeMachine ? TIME_BAR_INSET : 0}
          >
            {timeMachine && <TimeMachineBar timeline={timeline} machine={machine} onClose={onCloseTimeMachine} />}
          </DashboardMap>
          {timeMachine && (
            <p className="mx-1 mt-2 text-xs text-text-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help items-center gap-1 rounded-sm underline decoration-dotted underline-offset-3" tabIndex={0}>
                    <IconInfoCircle className="size-3.5" aria-hidden />
                    {t('timeMachine.note')}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-75">{t('timeMachine.noteHint')}</TooltipContent>
              </Tooltip>
            </p>
          )}
          {withoutCoordinates > 0 && (
            <p className="mx-1 mt-2 text-xs text-text-3">{t('map.withoutCoordinates', { count: withoutCoordinates })}</p>
          )}
        </div>
        <section
          className="flex max-h-[min(55dvh,420px)] min-h-72 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-1 dark:shadow-none xl:max-h-(--map-h)"
          aria-label={t('list.title')}
        >
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="m-0 text-sm font-semibold">{t('inspector.title')}</h2>
              <span className="text-xs tabular-nums text-text-3">{t('inspector.visibleCount', { count: rows.length })}</span>
            </div>
            {selected ? (
              <div className="mt-3 rounded-xl border border-border bg-surface-raised p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 text-xs tabular-nums text-text-3">{selected.code}</p>
                    <h3 className="mb-0 mt-1 break-words text-base font-semibold leading-snug">{selected.name}</h3>
                  </div>
                  <ZoneBadge zone={selected.zone} score={selected.score} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-2">
                  {selected.is_demo && <DemoBadge />}
                  <span>{keyStatus(selected.key_status, selected.key_status_detail)}</span>
                </div>
                {selected.developer_name && <p className="mb-0 mt-2 text-sm text-text-2">{selected.developer_name}</p>}
                <Button className="mt-3 w-full" asChild size="sm">
                  <Link to={`/objects/${selected.id}`}>{t('inspector.open')}</Link>
                </Button>
              </div>
            ) : (
              <p className="mb-0 mt-2 text-sm text-text-3">{t('inspector.empty')}</p>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-border px-4 py-2 text-xs font-medium text-text-2">{t('list.title')}</div>
            <ObjectList
              rows={rows}
              highlightedId={highlightedId}
              selectedId={selectedId}
              onHighlight={setHighlightedId}
              onSelect={selectObject}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
