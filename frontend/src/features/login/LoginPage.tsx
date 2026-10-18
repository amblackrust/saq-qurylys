import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { errorMessage } from '@/api/queryClient';
import { useAuth } from '@/auth/useAuth';
import { PasswordInput } from '@/components/form/PasswordInput';
import { TextInput } from '@/components/form/TextInput';
import { Button } from '@/components/ui/button';
import { LanguageSwitch } from '@/layout/LanguageSwitch';

export function LoginPage() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The schema is built with `t`, so its messages are translated; zod reports them as the field errors.
  const schema = useMemo(
    () => z.object({ username: z.string().trim().min(1, t('required')), password: z.string().min(1, t('required')) }),
    [t],
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } });

  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  const submit = handleSubmit(async (values) => {
    setError(null);
    setSubmitting(true);
    try {
      await login(values.username, values.password);
      void navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? t('auth.invalidCredentials') : errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="relative grid min-h-dvh place-items-center bg-bg px-(--gutter) py-24 max-sm:pt-36">
      <div className="absolute top-4 right-(--gutter) flex flex-col items-end gap-2 sm:flex-row sm:items-center">
        <div className="shrink-0"><LanguageSwitch /></div>
      </div>
      <div className="flex w-full max-w-[480px] flex-col items-center gap-6">
        <div className="flex items-center gap-3 text-text">
          <img src="/saq-qurylys-mark.svg" alt="" aria-hidden="true" className="size-12 shrink-0" />
          <span className="text-xl font-semibold tracking-tight">SAQ QURYLYS</span>
        </div>
        <form
          className="w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-2"
          onSubmit={submit}
          noValidate
        >
          <div className="border-b border-border px-7 pt-7 pb-5">
            <h1 className="text-2xl font-semibold tracking-tight text-text">{t('auth.title')}</h1>
            <p className="mt-2 text-[15px] text-text-2">{t('auth.description')}</p>
          </div>
          <div className="p-7 max-sm:p-5">
            <div className="flex flex-col gap-5">
              <TextInput label={t('auth.username')} autoComplete="username" autoFocus error={errors.username?.message} {...register('username')} />
              <PasswordInput
                label={t('auth.password')}
                autoComplete="current-password"
                error={errors.password?.message}
                {...register('password')}
              />
            </div>
            {error && (
              <p className="mt-4 text-sm text-zone-red-ink" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="mt-6 w-full" loading={submitting}>
              {t('auth.login')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
