import { useMemo, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router';
import 'dayjs/locale/ru';
import 'dayjs/locale/kk';
import { queryClient } from '@/api/queryClient';
import { AuthProvider } from '@/auth/AuthProvider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfirmProvider } from '@/lib/confirm';
import { ThemeProvider } from '@/theme/ThemeProvider';

export function Providers({ children }: { children: ReactNode }) {
  const router = useMemo(
    () =>
      createBrowserRouter([
        { path: '*', element: <AuthProvider>{children}</AuthProvider> },
      ]),
    [children],
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
          <ConfirmProvider />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
