'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AccountPicker } from '@/components/AccountPicker';
import { Logo } from '@/components/Logo';

function LoginInner() {
  const next = useSearchParams().get('next');
  return (
    <main className="relative mx-auto grid min-h-screen w-full max-w-7xl content-center gap-10 px-4 py-24 text-gray-900 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="group fixed right-4 top-5 z-50 inline-flex items-center gap-2.5 rounded-full bg-black px-6 py-3 text-base font-semibold text-white shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:bg-gray-800 hover:shadow-xl sm:right-8 sm:top-6"
      >
        <span className="transition-transform duration-300 group-hover:-translate-x-1" aria-hidden>←</span>
        Back to home
      </Link>
      <div className="animate-fade-up text-center">
        <Link href="/" className="inline-flex"><Logo size="lg" /></Link>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">Who are you signing in as?</h1>
        <p className="mx-auto mt-3 max-w-lg text-gray-500">
          Demo accounts, no password. Open the business in one tab and the vendor in another to see both sides of a verification call.
        </p>
      </div>
      <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
        <AccountPicker next={next} />
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
