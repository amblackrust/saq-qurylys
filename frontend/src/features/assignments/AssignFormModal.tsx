import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAssignees, useCreateAssignment } from '@/api/hooks/assignments';
import { ApiError } from '@/api/client';
import { DateInput } from '@/components/form/DateInput';
import { SelectInput } from '@/components/form/SelectInput';
import { TextArea } from '@/components/form/TextArea';
import { Button } from '@/components/ui/button';
import { FormDialog, FormFooter } from '@/features/objects/forms/fields';
import { useTerritoryList } from '@/lib/territories';

interface Props {
  opened: boolean;
  onClose: () => void;
  objectId: number;
  territoryId: number;
}

export function AssignFormModal({ opened, onClose, objectId, territoryId }: Props) {
  const { t } = useTranslation('assignments');
  return (
    <FormDialog opened={opened} onClose={onClose} title={t('form.title')}>
      <AssignForm objectId={objectId} territoryId={territoryId} onClose={onClose} />
    </FormDialog>
  );
}

function AssignForm({ objectId, territoryId, onClose }: Omit<Props, 'opened'>) {
  const { t } = useTranslation('assignments');
  const { t: tc } = useTranslation('common');
  const {
    territories,
    isPending: territoriesPending,
    isError: territoriesError,
    isFetching: territoriesFetching,
    refetch: refetchTerritories,
  } = useTerritoryList();
  const assignees = useAssignees(objectId, true);
  const create = useCreateAssignment(objectId);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [task, setTask] = useState(t('form.defaultTask'));
  const [touched, setTouched] = useState(false);

  const territoryTimeZone = territories.find((territory) => territory.id === territoryId)?.timezone ?? null;
  const territoryToday = territoryTimeZone === null ? null : todayInTimeZone(territoryTimeZone);
  const options = (assignees.data ?? []).map((user) => ({ value: String(user.id), label: user.full_name }));
  const taskEmpty = task.trim() === '';
  const pastDate = dueDate !== null && territoryToday !== null && dueDate < territoryToday;
  const serverPastDate = create.error instanceof ApiError && create.error.code === 'due_date_in_past';

  const submit = () => {
    setTouched(true);
    const todayAtSubmission = territoryTimeZone === null ? null : todayInTimeZone(territoryTimeZone);
    if (
      assigneeId === null ||
      dueDate === null ||
      (todayAtSubmission !== null && dueDate < todayAtSubmission) ||
      taskEmpty
    ) return;
    create.mutate({ assignee_id: Number(assigneeId), due_date: dueDate, task: task.trim() }, { onSuccess: onClose });
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="grid gap-3"
    >
      <SelectInput
        label={t('form.assignee')}
        required
        searchable
        data={options}
        value={assigneeId}
        onChange={setAssigneeId}
        placeholder={t('form.assigneePlaceholder')}
        nothingFound={t('form.noAssignees')}
        error={touched && assigneeId === null ? tc('required') : undefined}
      />
      <DateInput
        label={t('form.due')}
        required
        value={dueDate}
        onChange={(value) => {
          setDueDate(value);
          if (serverPastDate) create.reset();
        }}
        description={territoriesPending && territoryToday === null ? t('form.territoryDateLoading') : undefined}
        minDate={territoryToday ?? undefined}
        placeholder="ДД.ММ.ГГГГ"
        error={
          touched && dueDate === null
            ? tc('required')
            : pastDate || serverPastDate
              ? t('form.pastDate')
              : undefined
        }
      />
      {!territoriesPending && territoryToday === null && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-3" role="status">
          <span>{t('form.territoryDateUnavailable')}</span>
          {territoriesError && (
            <Button
              type="button"
              size="xs"
              variant="secondary"
              loading={territoriesFetching}
              onClick={() => void refetchTerritories()}
            >
              {tc('retry')}
            </Button>
          )}
        </div>
      )}
      <TextArea
        label={t('form.task')}
        required
        maxLength={2000}
        value={task}
        onChange={(event) => setTask(event.target.value)}
        error={touched && taskEmpty ? tc('required') : undefined}
      />
      <FormFooter
        loading={create.isPending}
        onCancel={onClose}
        submitLabel={t('form.submit')}
      />
    </form>
  );
}

function todayInTimeZone(timeZone: string): string | null {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      calendar: 'iso8601',
      numberingSystem: 'latn',
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
  const parts = formatter.formatToParts(new Date());
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = valueFor('year');
  const month = valueFor('month');
  const day = valueFor('day');
  if (year === undefined || month === undefined || day === undefined) return null;
  return year + '-' + month + '-' + day;
}
