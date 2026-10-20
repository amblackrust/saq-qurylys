import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAssignees, useCreateAssignment } from '@/api/hooks/assignments';
import { DateInput } from '@/components/form/DateInput';
import { SelectInput } from '@/components/form/SelectInput';
import { TextArea } from '@/components/form/TextArea';
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
  const { territories, isPending: territoriesPending } = useTerritoryList();
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

  const submit = () => {
    setTouched(true);
    const todayAtSubmission = territoryTimeZone === null ? null : todayInTimeZone(territoryTimeZone);
    if (
      assigneeId === null ||
      dueDate === null ||
      todayAtSubmission === null ||
      dueDate < todayAtSubmission ||
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
        onChange={setDueDate}
        description={territoriesPending && territoryToday === null ? t('form.territoryDateLoading') : undefined}
        disabled={territoryToday === null}
        minDate={territoryToday ?? undefined}
        placeholder="ДД.ММ.ГГГГ"
        error={
          !territoriesPending && territoryToday === null
            ? t('form.territoryDateUnavailable')
            : touched && dueDate === null
              ? tc('required')
              : pastDate
                ? t('form.pastDate')
                : undefined
        }
      />
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
        submitDisabled={territoryToday === null}
      />
    </form>
  );
}

function todayInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    calendar: 'iso8601',
    numberingSystem: 'latn',
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = valueFor('year');
  const month = valueFor('month');
  const day = valueFor('day');
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error('Unable to determine the current date in the object territory time zone');
  }
  return year + '-' + month + '-' + day;
}
