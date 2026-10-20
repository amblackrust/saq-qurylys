import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { IconPhoto, IconX } from '@tabler/icons-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAdUploadLimits, useCreateManualAd } from '@/api/hooks/ads';
import type { Platform } from '@/api/types';
import { DateTimeInput } from '@/components/form/DateTimeInput';
import { FileInput } from '@/components/form/FileInput';
import { SelectInput } from '@/components/form/SelectInput';
import { SwitchInput } from '@/components/form/SwitchInput';
import { TextArea } from '@/components/form/TextArea';
import { TextInput } from '@/components/form/TextInput';
import { ObjectSelect } from '@/components/ObjectSelect';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEnumOptions } from '@/i18n/useEnum';
import { PLATFORMS, parsePlatform } from './constants';
import { PointPicker } from './PointPicker';
import { isHttpUrl } from './url';

interface Photo {
  file: File;
  /** object URL for the preview; revoked when the photo is removed or the form is closed */
  previewUrl: string;
}

const BYTES_PER_MIB = 1024 * 1024;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (adId: number) => void;
}

const emptyValues = {
  text: '',
  platform: 'other' as Platform,
  url: '',
  object_id: null as number | null,
  /** `YYYY-MM-DD HH:mm:ss` from the picker, local time */
  published_at: null as string | null,
  is_outdoor: false,
  lat: '' as number | string,
  lon: '' as number | string,
};

export function ManualAdModal({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation('ads');
  const { t: tc } = useTranslation('common');
  const options = useEnumOptions();
  const createAd = useCreateManualAd();
  const uploadLimits = useAdUploadLimits(open);
  const limits = uploadLimits.data;
  const limitsLoading = uploadLimits.isPending || uploadLimits.isFetching;
  const limitsReady = !limitsLoading && !uploadLimits.isError && limits !== undefined;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosError, setPhotosError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          text: z.string().trim().min(1, tc('required')),
          platform: z.custom<Platform>(),
          url: z
            .string()
            .trim()
            .refine((value) => value === '' || isHttpUrl(value), t('capture.urlInvalid')),
          object_id: z.number().nullable(),
          published_at: z.string().nullable(),
          is_outdoor: z.boolean(),
          lat: z.union([z.number(), z.string()]),
          lon: z.union([z.number(), z.string()]),
        })
        .superRefine((values, context) => {
          if (!values.is_outdoor) return;
          for (const key of ['lat', 'lon'] as const) {
            if (typeof values[key] !== 'number') context.addIssue({ code: 'custom', path: [key], message: t('point.required') });
          }
        }),
    [t, tc],
  );
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: emptyValues });
  const isOutdoor = useWatch({ control, name: 'is_outdoor' });
  const lat = useWatch({ control, name: 'lat' });
  const lon = useWatch({ control, name: 'lon' });

  const resetAll = () => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    setPhotos([]);
    setPhotosError(null);
    reset(emptyValues);
  };

  const close = () => {
    resetAll();
    onClose();
  };

  const setOutdoor = (outdoor: boolean) => {
    const platform = getValues('platform');
    setValue('is_outdoor', outdoor);
    setValue('platform', outdoor ? 'outdoor' : platform === 'outdoor' ? 'other' : platform);
  };

  const addPhotos = (files: File[]) => {
    if (files.length === 0 || !limitsReady || !limits) return;
    const added: Photo[] = [];
    let totalBytes = photos.reduce((total, photo) => total + photo.file.size, 0);
    let error: string | null = null;

    for (const file of files) {
      if (photos.length + added.length >= limits.max_photos) {
        error ??= t('manual.photosTooMany', { max: limits.max_photos });
        continue;
      }
      if (file.size > limits.max_file_bytes) {
        error ??= t('manual.photosFileTooLarge', {
          name: file.name,
          max: limits.max_file_bytes / BYTES_PER_MIB,
        });
        continue;
      }
      if (totalBytes + file.size > limits.max_total_bytes) {
        error ??= t('manual.photosTotalTooLarge', { max: limits.max_total_bytes / BYTES_PER_MIB });
        continue;
      }
      added.push({ file, previewUrl: URL.createObjectURL(file) });
      totalBytes += file.size;
    }

    setPhotosError(error);
    if (added.length > 0) setPhotos([...photos, ...added]);
  };

  const removePhoto = (photo: Photo) => {
    URL.revokeObjectURL(photo.previewUrl);
    setPhotos(photos.filter((item) => item !== photo));
    setPhotosError(null);
  };

  const submit = handleSubmit((values) => {
    if (!limitsReady || !limits) return;
    if (photos.length > limits.max_photos) {
      setPhotosError(t('manual.photosTooMany', { max: limits.max_photos }));
      return;
    }
    let totalBytes = 0;
    for (const photo of photos) {
      if (photo.file.size > limits.max_file_bytes) {
        setPhotosError(t('manual.photosFileTooLarge', {
          name: photo.file.name,
          max: limits.max_file_bytes / BYTES_PER_MIB,
        }));
        return;
      }
      totalBytes += photo.file.size;
    }
    if (totalBytes > limits.max_total_bytes) {
      setPhotosError(t('manual.photosTotalTooLarge', { max: limits.max_total_bytes / BYTES_PER_MIB }));
      return;
    }

    createAd.mutate(
      {
        text: values.text,
        platform: values.platform,
        url: values.url || undefined,
        object_id: values.object_id,
        published_at: values.published_at ? new Date(values.published_at).toISOString() : undefined,
        is_outdoor: values.is_outdoor,
        lat: values.is_outdoor && typeof values.lat === 'number' ? values.lat : undefined,
        lon: values.is_outdoor && typeof values.lon === 'number' ? values.lon : undefined,
        photos: photos.map((photo) => photo.file),
      },
      {
        onSuccess: (ad) => {
          resetAll();
          onCreated(ad.id);
          onClose();
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('manual.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <TextArea
            label={t('manual.text')}
            placeholder={t('manual.textPlaceholder')}
            minRows={4}
            maxRows={10}
            required
            autoFocus
            error={errors.text?.message}
            {...register('text')}
          />
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
            <Controller
              control={control}
              name="platform"
              render={({ field }) => (
                <SelectInput
                  label={t('manual.platform')}
                  data={options('platform', PLATFORMS)}
                  value={field.value}
                  onChange={(value) => field.onChange(parsePlatform(value) ?? 'other')}
                />
              )}
            />
            <Controller
              control={control}
              name="published_at"
              render={({ field }) => (
                <DateTimeInput
                  label={t('manual.publishedAt')}
                  placeholder={t('manual.publishedAtPlaceholder')}
                  clearable
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          <TextInput
            label={t('manual.url')}
            placeholder="https://"
            inputMode="url"
            error={errors.url?.message}
            {...register('url')}
          />
          <Controller
            control={control}
            name="object_id"
            render={({ field }) => (
              <ObjectSelect
                label={t('manual.object')}
                placeholder={t('capture.objectPlaceholder')}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <SwitchInput
            label={t('manual.outdoor')}
            description={t('manual.outdoorHint')}
            checked={isOutdoor}
            onCheckedChange={setOutdoor}
          />
          {isOutdoor && (
            <PointPicker
              lat={lat}
              lon={lon}
              onChange={(nextLat, nextLon) => {
                setValue('lat', nextLat, { shouldValidate: !!errors.lat });
                setValue('lon', nextLon, { shouldValidate: !!errors.lon });
              }}
              error={errors.lat?.message ?? errors.lon?.message}
            />
          )}
          <FileInput
            label={t('manual.photos')}
            description={limitsReady && limits ? t('manual.photosHint', {
              maxPhotos: limits.max_photos,
              maxFile: limits.max_file_bytes / BYTES_PER_MIB,
              maxTotal: limits.max_total_bytes / BYTES_PER_MIB,
            }) : undefined}
            placeholder={t('manual.photosPlaceholder')}
            leftSection={<IconPhoto />}
            error={photosError ?? undefined}
            disabled={!limitsReady}
            multiple
            accept="image/*"
            value={[]}
            onChange={addPhotos}
          />
          {limitsLoading && <p role="status" className="m-0 text-sm text-text-3">{t('manual.photosLimitsLoading')}</p>}
          {uploadLimits.isError && !limitsLoading && (
            <div role="alert" className="flex items-center justify-between gap-3 text-sm text-danger">
              <span>{t('manual.photosLimitsUnavailable')}</span>
              <Button type="button" variant="secondary" disabled={limitsLoading} onClick={() => void uploadLimits.refetch()}>
                {tc('retry')}
              </Button>
            </div>
          )}
          {photos.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {photos.map((photo) => (
                <li key={photo.previewUrl} className="relative size-18">
                  <img
                    src={photo.previewUrl}
                    alt={photo.file.name}
                    className="block size-full rounded border border-border object-cover"
                  />
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="secondary"
                    className="absolute top-0.5 right-0.5"
                    aria-label={t('manual.removePhoto', { name: photo.file.name })}
                    onClick={() => removePhoto(photo)}
                  >
                    <IconX />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={close}>
              {tc('cancel')}
            </Button>
            <Button type="submit" className="max-sm:min-h-11" disabled={!limitsReady} loading={createAd.isPending}>
              {t('manual.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
