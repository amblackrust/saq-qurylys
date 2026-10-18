import { useState } from 'react';
import { IconExternalLink, IconPackage } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { downloadFile } from '@/api/client';
import { useSignalMaterials } from '@/api/hooks/signals';
import { errorMessage } from '@/api/queryClient';
import type { SignalDetail, SignalMaterialFile } from '@/api/types';
import { ErrorBlock, LoadingBlock } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEnum } from '@/i18n/useEnum';
import { useFormat } from '@/i18n/useFormat';
import { isHttpUrl } from '@/features/ads/url';
import { toast } from '@/lib/toast';

interface Props {
  opened: boolean;
  onClose: () => void;
  detail: SignalDetail;
  dirty: boolean;
}

interface EvidenceSelection {
  signalId: number;
  ids: number[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function SignalPackageDialog({ opened, onClose, detail, dirty }: Props) {
  const { t } = useTranslation('signals');
  const { t: tc } = useTranslation();
  const e = useEnum();
  const { dateTime } = useFormat();
  const materialsQuery = useSignalMaterials(detail.id, opened);
  const [selection, setSelection] = useState<EvidenceSelection | null>(null);
  const [downloading, setDownloading] = useState(false);
  const materials = materialsQuery.data;
  const evidenceFiles = (materials?.files ?? []).filter(
    (file): file is SignalMaterialFile & { evidence_id: number } => file.kind === 'evidence' && file.evidence_id !== null,
  );
  const availableEvidence = evidenceFiles.filter((file) => file.available);
  const availableEvidenceIds = new Set(availableEvidence.map((file) => file.evidence_id));
  const selectedEvidenceIds = [...new Set(
    selection?.signalId === detail.id
      ? selection.ids
      : availableEvidence.filter((file) => file.selected).map((file) => file.evidence_id),
  )].filter((id) => availableEvidenceIds.has(id));
  const selectedIds = new Set(selectedEvidenceIds);
  const visibleWarnings = materials
    ? materials.warnings.filter(
        (warning) => !materials.snapshot_publications_capped || warning !== t('package.publicationsCapped'),
      )
    : [];
  const includedFiles = (materials?.files ?? []).filter(
    (file) => file.available && (file.kind !== 'evidence' || (file.evidence_id !== null && selectedIds.has(file.evidence_id))),
  );
  const totalBytes = includedFiles.reduce((sum, file) => sum + (file.size_bytes ?? 0), 0);
  const unknownSizeFiles = includedFiles.filter((file) => file.size_bytes === null).length;
  const maxEvidenceCount = materials?.limits.max_evidence_files ?? 0;
  const maxFileBytes = materials?.limits.max_file_bytes ?? 0;
  const maxTotalBytes = materials?.limits.max_total_bytes ?? 0;
  const overEvidenceLimit = selectedEvidenceIds.length > maxEvidenceCount;
  const overFileLimit = includedFiles.some((file) => file.size_bytes !== null && file.size_bytes > maxFileBytes);
  const overTotalLimit = totalBytes > maxTotalBytes;
  const exceedsLimits = overEvidenceLimit || overFileLimit || overTotalLimit;

  const setSelected = (id: number, checked: boolean) => {
    setSelection({
      signalId: detail.id,
      ids: checked ? [...new Set([...selectedEvidenceIds, id])] : selectedEvidenceIds.filter((item) => item !== id),
    });
  };

  const selectAll = () => setSelection({ signalId: detail.id, ids: availableEvidence.map((file) => file.evidence_id) });
  const selectNone = () => setSelection({ signalId: detail.id, ids: [] });

  const download = async () => {
    if (!materials || exceedsLimits || dirty) return;
    const params = new URLSearchParams();
    if (selectedEvidenceIds.length === availableEvidence.length && availableEvidence.length > 0) {
      params.set('include_evidence', 'true');
    } else if (selectedEvidenceIds.length === 0) {
      params.set('include_evidence', 'false');
    } else {
      [...selectedEvidenceIds].sort((a, b) => a - b).forEach((id) => params.append('evidence_id', String(id)));
    }

    setDownloading(true);
    try {
      await downloadFile(
        `/signals/${detail.id}/package.zip?${params.toString()}`,
        `AYQYN_${materials.number}_package.zip`,
      );
    } catch (error) {
      toast.error(errorMessage(error), { title: t('package.downloadError') });
    } finally {
      setDownloading(false);
    }
  };

  const fileLabel = (file: SignalMaterialFile) => {
    if (file.kind === 'evidence') return file.source_label;
    if (file.kind === 'signal_pdf' && materials && !materials.is_draft) return t('package.files.signal_pdf_archived');
    return t(`package.files.${file.kind}`);
  };
  const renderFile = (file: SignalMaterialFile, index: number) => {
    const label = fileLabel(file);
    const visibleMetadata = (
      <div className="mt-1 grid min-w-0 gap-0.5 text-xs text-text-3">
        {file.size_bytes !== null && <span>{t('package.fileSize', { size: formatBytes(file.size_bytes) })}</span>}
        {file.captured_at && <span>{t('package.capturedAt', { date: dateTime(file.captured_at) })}</span>}
        {file.source_url && isHttpUrl(file.source_url) && (
          <a href={file.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-0 items-center gap-1 break-all text-link hover:underline">
            <IconExternalLink className="size-3.5 shrink-0" aria-hidden />
            {t('package.sourceLink', { source: file.source_label })}
          </a>
        )}
      </div>
    );
    const technicalDetails = (
      <details className="min-w-0 text-xs text-text-3">
        <summary className="block min-h-11 cursor-pointer py-2">{t('package.technicalDetails')}</summary>
        <div className="grid min-w-0 gap-0.5 pb-1 [overflow-wrap:anywhere]">
          <span>{t('package.archiveName', { filename: file.filename })}</span>
          {file.content_type && <span>{t('package.contentType', { type: file.content_type })}</span>}
          {file.sha256 && <span>{t('package.sha256', { hash: file.sha256 })}</span>}
        </div>
      </details>
    );

    return (
      <li key={`${file.kind}-${file.evidence_id ?? index}`} className="min-w-0 rounded border border-border bg-surface px-3 py-2">
        {file.kind === 'evidence' && file.evidence_id !== null ? (
          <div className="flex min-w-0 items-start gap-3">
            <Checkbox
              checked={selectedIds.has(file.evidence_id)}
              disabled={!file.available || (!selectedIds.has(file.evidence_id) && selectedEvidenceIds.length >= maxEvidenceCount)}
              onCheckedChange={(checked) => setSelected(file.evidence_id!, checked === true)}
              aria-label={t('package.selectEvidence', { name: label })}
              className="mt-1"
            />
            <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              <p className="m-0 font-medium text-text">{label}</p>
              {file.available && <span className="block text-xs text-text-3">{t('package.fileAvailable')}</span>}
              {visibleMetadata}
              {technicalDetails}
              {!file.available && (
                <span className="mt-1 block text-sm text-zone-red-ink">{file.missing_reason ?? t('package.unavailable')}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <p className="m-0 font-medium text-text">{label}</p>
            {file.available ? (
              <p className="mb-0 mt-1 text-xs text-text-3">{t('package.fileIncluded')}</p>
            ) : (
              <p className="mb-0 mt-1 text-sm text-zone-red-ink">{file.missing_reason ?? t('package.unavailable')}</p>
            )}
            {visibleMetadata}
            {technicalDetails}
          </div>
        )}
      </li>
    );
  };

  return (
    <Dialog open={opened} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="min-h-0 min-w-0 max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-2xl" aria-describedby={undefined}>
        <DialogHeader className="min-w-0">
          <DialogTitle className="min-w-0 [overflow-wrap:anywhere]">{t('package.title')}</DialogTitle>
          <DialogDescription className="min-w-0 [overflow-wrap:anywhere]">{t('package.description', { number: detail.number })}</DialogDescription>
        </DialogHeader>

        <div data-slot="signal-package-body" className="grid min-h-0 min-w-0 content-start gap-3 overflow-y-auto overscroll-contain">
          {materialsQuery.isPending && <LoadingBlock />}
          {materialsQuery.isError && <ErrorBlock error={materialsQuery.error} onRetry={() => void materialsQuery.refetch()} />}
          {materials && (
            <div className="grid min-w-0 gap-4">
            <div className="min-w-0 rounded border border-border bg-surface px-3 py-2 text-sm [overflow-wrap:anywhere]">
              <p className="m-0 font-medium text-text">
                {materials.is_draft ? t('package.draft') : t('package.notSent')}
              </p>
              <p className="mb-0 mt-1 text-text-2">{t('package.noLifecycleChange')}</p>
            </div>
            {dirty && (
              <p className="m-0 min-w-0 rounded border border-zone-yellow/40 bg-zone-yellow-bg px-3 py-2 text-sm text-zone-yellow-ink [overflow-wrap:anywhere]" role="alert">
                {t('package.unsavedChanges')}
              </p>
            )}

            <dl className="grid min-w-0 gap-1 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-text-3">{t('package.recipient')}</dt>
                <dd className="m-0 min-w-0 text-text [overflow-wrap:anywhere]">{materials.recipient ? e('recipient', materials.recipient) : tc('noValue')}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-text-3">{t('package.snapshotAt')}</dt>
                <dd className="m-0 min-w-0 text-text [overflow-wrap:anywhere]">{dateTime(materials.snapshot_at)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-text-3">{t('package.previewAt')}</dt>
                <dd className="m-0 min-w-0 text-text [overflow-wrap:anywhere]">{dateTime(materials.formed_at)}</dd>
              </div>
            </dl>

            {materials.snapshot_publications_capped && (
              <p className="m-0 min-w-0 rounded border border-zone-yellow/40 bg-zone-yellow-bg px-3 py-2 text-sm text-zone-yellow-ink [overflow-wrap:anywhere]" role="status">
                {t('package.publicationsCapped')}
              </p>
            )}

            {visibleWarnings.length > 0 && (
              <ul className="m-0 grid min-w-0 list-disc gap-1 rounded border border-border bg-surface px-3 py-2 pl-8 text-sm text-text-2 [overflow-wrap:anywhere]" role="status">
                {visibleWarnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
              </ul>
            )}

            <section className="grid min-w-0 gap-2 [overflow-wrap:anywhere]" aria-labelledby="signal-package-files-title">
              <h3 id="signal-package-files-title" className="m-0 text-sm font-semibold text-text">
                {t('package.contents')}
              </h3>
              <ul className="m-0 grid list-none gap-2 p-0">
                {materials.files.filter((file) => file.kind !== 'evidence').map(renderFile)}
              </ul>
            </section>

            <section className="grid min-w-0 gap-2 [overflow-wrap:anywhere]" aria-labelledby="signal-package-evidence-title">
              <h3 id="signal-package-evidence-title" className="m-0 text-sm font-semibold text-text">
                {t('package.evidenceTitle')}
              </h3>
              <p className="m-0 text-sm text-text-2">{t('package.evidenceDescription')}</p>
              {evidenceFiles.length > 0 ? (
                <ul className="m-0 grid list-none gap-2 p-0">
                  {evidenceFiles.map(renderFile)}
                </ul>
              ) : (
                <p className="m-0 min-w-0 text-sm text-text-3 [overflow-wrap:anywhere]">{t('package.noEvidence')}</p>
              )}
            </section>

            <div className="grid min-w-0 gap-2 rounded border border-border bg-surface-sunken px-3 py-2 text-sm [overflow-wrap:anywhere]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 [overflow-wrap:anywhere]">{t('package.selectedEvidence', { count: selectedEvidenceIds.length, max: maxEvidenceCount })}</span>
                <span className="min-w-0 [overflow-wrap:anywhere]">{t('package.totalSize', { size: formatBytes(totalBytes), max: formatBytes(maxTotalBytes) })}</span>
              </div>
              <span>{t('package.totalFiles', { count: includedFiles.length })}</span>
              {unknownSizeFiles > 0 && <p className="m-0 text-text-3" role="status">{t('package.sizeUnknown')}</p>}
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-11 max-w-full whitespace-normal" size="sm" variant="outline" onClick={selectAll} disabled={availableEvidence.length === 0 || availableEvidence.length > maxEvidenceCount}>
                  {t('package.selectAll')}
                </Button>
                <Button className="min-h-11 max-w-full whitespace-normal" size="sm" variant="outline" onClick={selectNone} disabled={selectedEvidenceIds.length === 0}>
                  {t('package.selectNone')}
                </Button>
              </div>
              {overEvidenceLimit && <p className="m-0 text-zone-red-ink" role="alert">{tc('errors.package_evidence_limit')}</p>}
              {overFileLimit && <p className="m-0 text-zone-red-ink" role="alert">{tc('errors.package_file_too_large')}</p>}
              {overTotalLimit && <p className="m-0 text-zone-red-ink" role="alert">{tc('errors.package_total_size_limit')}</p>}
              <p className="m-0 min-w-0 text-xs text-text-3 [overflow-wrap:anywhere]">{t('package.fileLimit', { size: formatBytes(maxFileBytes) })}</p>
            </div>

            {materials.missing_materials.length > 0 && (
              <section className="grid min-w-0 gap-1 rounded border border-zone-yellow/40 bg-zone-yellow-bg px-3 py-2 text-sm text-zone-yellow-ink [overflow-wrap:anywhere]" aria-labelledby="signal-package-missing-title">
                <h3 id="signal-package-missing-title" className="m-0 font-semibold">{t('package.missingTitle')}</h3>
                <ul className="m-0 min-w-0 list-disc pl-5 [overflow-wrap:anywhere]">
                  {materials.missing_materials.map((item, index) => <li key={`${index}-${item.source_label}`}>{item.source_label}: {item.reason}</li>)}
                </ul>
              </section>
            )}
            </div>
          )}
        </div>

        <DialogFooter className="min-w-0">
          <Button className="max-w-full whitespace-normal" variant="secondary" onClick={onClose} disabled={downloading}>{tc('close')}</Button>
          <Button className="max-w-full whitespace-normal" onClick={() => void download()} loading={downloading} disabled={!materials || materialsQuery.isError || exceedsLimits || dirty}>
            <IconPackage />
            {t('package.download')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
