import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { IconSearch } from '@tabler/icons-react';
import { useLinkGraph } from '@/api/hooks/graph';
import type { GraphNode, LinkGraph } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/Chip';
import { EmptyState, QueryBoundary } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import { ZoneDisclaimer } from '@/components/ZoneDisclaimer';
import { parseId } from '@/features/objects/list/filters';
import { FindingsPanel } from './FindingsPanel';
import { Legend } from './Legend';
import { LinkGraphCanvas } from './LinkGraphCanvas';
import { SuggestionsPanel } from './SuggestionsPanel';
import { buildAdjacency, findingNodes, withHolders } from './graphModel';

export function GraphPage() {
  const { t } = useTranslation('graph');
  const [params, setParams] = useSearchParams();
  const objectId = parseId(params.get('object_id'));
  const developerId = objectId === null ? parseId(params.get('developer_id')) : null;
  const seedId = objectId !== null ? `object:${objectId}` : developerId !== null ? `developer:${developerId}` : null;
  const graph = useLinkGraph({ object_id: objectId ?? undefined, developer_id: developerId ?? undefined });

  const seed = graph.data?.nodes.find((node) => node.id === seedId);
  const subtitle = seed ? t(`focus.${seed.type}`, { name: seed.label }) : t('subtitle');

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={subtitle}
        actions={
          seedId !== null && (
            <Button variant="secondary" onClick={() => setParams({})}>
              {t('showAll')}
            </Button>
          )
        }
      />
      <ZoneDisclaimer />
      <QueryBoundary query={graph}>
        {(data) => (
          <GraphWorkspace
            key={seedId ?? 'all'}
            graph={data}
            seedId={seedId}
            stale={graph.isPlaceholderData}
            onRecentre={(id) => setParams({ developer_id: String(id) })}
          />
        )}
      </QueryBoundary>
    </>
  );
}

interface WorkspaceProps {
  graph: LinkGraph;
  seedId: string | null;
  /** showing the previous view while the new one loads */
  stale: boolean;
  onRecentre: (developerId: number) => void;
}

function GraphWorkspace({ graph, seedId, stale, onRecentre }: WorkspaceProps) {
  const { t } = useTranslation('graph');
  const navigate = useNavigate();
  const adjacency = useMemo(() => buildAdjacency(graph), [graph]);
  // One thing at a time is emphasised: a finding chosen in the list, or a phone/account chosen on the graph.
  const [finding, setFinding] = useState<number | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [entitySearch, setEntitySearch] = useState('');
  const selectedNode = graph.nodes.find((node) => node.id === pickedId) ?? null;
  const searchMatches = useMemo(() => {
    const query = entitySearch.trim().toLocaleLowerCase();
    if (!query) return [];
    return graph.nodes
      .filter((node) => node.label.toLocaleLowerCase().includes(query) || node.id.toLocaleLowerCase().includes(query))
      .slice(0, 8);
  }, [entitySearch, graph.nodes]);

  const highlight = useMemo(() => {
    const chosen = finding === null ? undefined : graph.findings[finding];
    if (chosen) return findingNodes(chosen, adjacency);
    return pickedId !== null && adjacency.has(pickedId) ? withHolders(adjacency, pickedId) : null;
  }, [finding, pickedId, graph.findings, adjacency]);

  const selectFinding = useCallback((index: number | null) => {
    setFinding(index);
    setPickedId(null);
  }, []);

  const clearSelection = useCallback(() => {
    setFinding(null);
    setPickedId(null);
  }, []);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      switch (node.type) {
        case 'object':
          void navigate(`/objects/${node.ref_id}`);
          break;
        case 'ad':
          void navigate(`/ads?ad=${node.ref_id}`);
          break;
        case 'developer':
          if (node.id !== seedId && node.ref_id !== null) onRecentre(node.ref_id);
          break;
        default:
          setFinding(null);
          setPickedId((current) => (current === node.id ? null : node.id));
      }
    },
    [navigate, onRecentre, seedId],
  );

  return (
    <div
      className="mt-3.5 flex flex-col gap-3.5 transition-opacity duration-(--dur) data-stale:opacity-60"
      data-stale={stale || undefined}
    >
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-3 shadow-1 dark:shadow-none md:px-4">
        <div className="relative min-w-[min(100%,320px)] flex-1">
          <label htmlFor="graph-entity-search" className="sr-only">{t('search.label')}</label>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-3" aria-hidden />
            <Input
              id="graph-entity-search"
              value={entitySearch}
              onChange={(event) => setEntitySearch(event.currentTarget.value)}
              placeholder={t('search.placeholder')}
              autoComplete="off"
              className="pl-9"
            />
          </div>
          {entitySearch.trim() && (
            <ul className="absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-border-strong bg-surface-raised p-1.5 shadow-2">
              {searchMatches.length ? searchMatches.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-focus"
                    onClick={() => {
                      setFinding(null);
                      setPickedId(node.id);
                      setEntitySearch('');
                    }}
                  >
                    <span className="min-w-0 truncate font-medium">{node.label}</span>
                    <span className="shrink-0 text-xs text-text-3">{t(`legend.${node.type}`)}</span>
                  </button>
                </li>
              )) : <li className="px-3 py-2 text-sm text-text-3">{t('search.empty')}</li>}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{t('metrics.nodes', { count: graph.nodes.length })}</Chip>
          <Chip>{t('metrics.edges', { count: graph.edges.length })}</Chip>
          {selectedNode && <Button variant="ghost" size="sm" onClick={clearSelection}>{t('findings.clear')}</Button>}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-1 dark:shadow-none" aria-label={t('title')}>
          {graph.nodes.length === 0 ? (
            <EmptyState>
              <strong>{t('empty')}</strong>
              <br />
              {t('emptyHint')}
            </EmptyState>
          ) : (
            <>
              <LinkGraphCanvas
                graph={graph}
                highlight={highlight}
                seedId={seedId}
                onNodeClick={handleNodeClick}
                onBackgroundClick={clearSelection}
              />
              <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
                <Legend />
                <p className="m-0 text-xs text-text-3">{t('canvas.hint')}</p>
                {graph.truncated && (
                  <p className="m-0 text-xs text-text-3" role="status">
                    {t('truncated', { count: graph.nodes.length })}
                  </p>
                )}
              </div>
            </>
          )}
        </section>
        <aside className="flex min-w-0 flex-col gap-3" aria-label={t('inspector.title')}>
          <section className="rounded-2xl border border-border bg-surface p-4 shadow-1 dark:shadow-none">
            <h2 className="m-0 text-sm font-semibold">{t('inspector.title')}</h2>
            {selectedNode ? (
              <>
                <p className="mb-1 mt-3 text-xs text-text-3">{t(`legend.${selectedNode.type}`)}</p>
                <h3 className="m-0 break-words text-base font-semibold leading-snug">{selectedNode.label}</h3>
                <p className="mb-0 mt-2 text-sm text-text-2">{t('inspector.connections', { count: adjacency.get(selectedNode.id)?.size ?? 0 })}</p>
                {(selectedNode.type === 'object' || selectedNode.type === 'ad' || (selectedNode.type === 'developer' && selectedNode.id !== seedId)) && (
                  <Button
                    className="mt-3 w-full"
                    size="sm"
                    onClick={() => {
                      if (selectedNode.type === 'object') void navigate(`/objects/${selectedNode.ref_id}`);
                      else if (selectedNode.type === 'ad') void navigate(`/ads?ad=${selectedNode.ref_id}`);
                      else if (selectedNode.ref_id !== null) onRecentre(selectedNode.ref_id);
                    }}
                  >
                    {selectedNode.type === 'developer' ? t('inspector.recentre') : t('inspector.open')}
                  </Button>
                )}
              </>
            ) : <p className="mb-0 mt-2 text-sm text-text-3">{t('inspector.empty')}</p>}
          </section>
          <FindingsPanel findings={graph.findings} nodes={graph.nodes} active={finding} onSelect={selectFinding} />
          <SuggestionsPanel />
        </aside>
      </div>
    </div>
  );
}
