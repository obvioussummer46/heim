'use client';

import dynamic from 'next/dynamic';

// The whole app is client-side (WebSocket relays, geolocation, localStorage),
// so skip SSR for the shell entirely.
const AppShell = dynamic(() => import('@/components/AppShell'), {
  ssr: false,
  loading: () => (
    <main className="flex h-dvh items-center justify-center">
      <p className="text-gray-500">localstr…</p>
    </main>
  ),
});

export default function Home() {
  return <AppShell />;
}
