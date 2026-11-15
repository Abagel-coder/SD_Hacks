import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md content-center gap-6 px-4 py-24 text-center text-gray-900">
      <Link href="/" className="mx-auto inline-flex"><Logo size="lg" /></Link>
      <div className="card space-y-3 p-8">
        <p className="text-sm font-semibold text-gray-400">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-sm text-gray-500">This page doesn&apos;t exist, or the invoice was removed.</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link href="/invoices" className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800">
            Invoices
          </Link>
          <Link href="/" className="rounded-full px-5 py-2.5 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 transition-colors hover:bg-gray-100">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
