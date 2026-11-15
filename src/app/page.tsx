import Link from 'next/link';
import { AppNav } from '@/components/AppNav';
import { HeroDemo } from '@/components/landing/HeroDemo';
import { LiveStats } from '@/components/landing/LiveStats';
import { Reveal } from '@/components/Reveal';
import { Spotlight } from '@/components/Spotlight';

const STEPS = [
  { n: '01', tool: 'Gemini', title: 'Reads the invoice', text: 'Pulls the vendor, amount, bank account and phone number out of any PDF or photo.' },
  { n: '02', tool: 'Neon', title: 'Checks the history', text: 'Compares it with every invoice this vendor has sent before: bank, amount, timing.' },
  { n: '03', tool: 'Bright Data', title: 'Fact-checks the web', text: "Finds the vendor's real website and phone number live, and spots look-alike domains." },
  { n: '04', tool: 'Risk engine', title: 'Decides', text: 'Our own rules score the invoice. Anything suspicious is frozen before money moves.' },
  { n: '05', tool: 'ElevenLabs', title: 'Calls the vendor', text: 'A voice agent calls the real number and asks a question only the real vendor can answer.' },
];

const TOOLS = [
  { name: 'Google Gemini', role: 'Reads invoices', color: 'bg-blue-500' },
  { name: 'Bright Data', role: 'Web fact-check', color: 'bg-sky-500' },
  { name: 'ElevenLabs', role: 'Voice agent', color: 'bg-gray-900' },
  { name: 'Neon Postgres', role: 'Memory', color: 'bg-emerald-500' },
  { name: 'Next.js', role: 'Web app', color: 'bg-gray-900' },
  { name: 'Vercel', role: 'Hosting', color: 'bg-gray-900' },
  { name: 'TypeScript', role: 'Risk engine', color: 'bg-blue-600' },
];

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[110rem] space-y-16 px-4 py-6 text-gray-900 sm:px-6 lg:px-8">
      <AppNav current="home" />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-black px-6 py-12 text-white sm:px-12 sm:py-16">
        <div className="animate-drift pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-600/30 blur-3xl" />
        <div className="animate-drift pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-red-600/25 blur-3xl" style={{ animationDelay: '-7s' }} />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:22px_22px]" />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gray-200 ring-1 ring-white/15">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              AI finance agent for small businesses
            </p>
            <h1
              className="animate-shimmer mt-4 bg-gradient-to-r from-white via-gray-400 to-white bg-[length:200%_100%] bg-clip-text text-8xl font-semibold leading-none tracking-[-0.06em] text-transparent sm:text-9xl"
              style={{ animationDelay: '60ms' }}
            >
              Vouch
            </h1>
            <p className="animate-fade-up mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl" style={{ animationDelay: '140ms' }}>
              Every bank change gets a phone call.
            </p>
            <p className="animate-fade-up mt-4 max-w-lg text-lg text-gray-300" style={{ animationDelay: '220ms' }}>
              Vouch reads every invoice, fact-checks the vendor on the open web, freezes anything suspicious, and calls the
              real vendor before a cent moves.
            </p>
            <div className="animate-fade-up mt-8 flex flex-wrap gap-3" style={{ animationDelay: '300ms' }}>
              <a href="#sign-in" className="btn group !bg-white !px-6 !py-3 !text-black hover:!bg-gray-100">
                Get started <Arrow />
              </a>
              <a href="#how" className="inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/10">
                How it works
              </a>
            </div>
          </div>
          <div className="animate-fade-up flex justify-center lg:justify-end" style={{ animationDelay: '320ms' }}>
            <HeroDemo />
          </div>
        </div>
        <a href="#how" className="relative mx-auto mt-12 flex w-fit flex-col items-center gap-1 text-xs text-gray-400 transition-colors hover:text-white">
          Scroll
          <span className="animate-bounce" aria-hidden>↓</span>
        </a>
      </section>

      {/* Live numbers */}
      <Reveal>
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Live from the ledger</h2>
          <span className="flex items-center gap-2 text-sm text-gray-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> Updating live
          </span>
        </div>
        <LiveStats />
      </section>
      </Reveal>

      {/* How it works */}
      <Reveal>
      <section id="how" className="scroll-mt-24 space-y-6">
        <div>
          <p className="eyebrow">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Five checks. About thirty seconds.</h2>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, index) => (
            <li key={step.n} className="animate-fade-up" style={{ animationDelay: `${index * 90}ms` }}>
              <Spotlight className="card card-hover group relative h-full overflow-hidden p-5">
              <span className="absolute right-4 top-3 text-4xl font-semibold text-gray-100 transition-colors duration-300 group-hover:text-gray-200">
                {step.n}
              </span>
              <span className="relative inline-block rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-white">
                {step.tool}
              </span>
              <h3 className="relative mt-4 text-base font-semibold">{step.title}</h3>
              <p className="relative mt-1.5 text-sm leading-relaxed text-gray-500">{step.text}</p>
              </Spotlight>
            </li>
          ))}
        </ol>
      </section>
      </Reveal>

      {/* Two sides of every call */}
      <Reveal>
      <section className="space-y-6">
        <div>
          <p className="eyebrow">Two sides of every call</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">The business asks. The vendor answers.</h2>
        </div>
        <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
          <Spotlight className="card card-hover spotlight-dark !bg-black p-6 text-white">
            <p className="relative eyebrow !text-gray-400">Business</p>
            <p className="relative mt-2 text-xl font-semibold">Harbor Coffee Roasters</p>
            <ul className="relative mt-4 space-y-2 text-sm text-gray-300">
              <li>Uploads an invoice</li>
              <li>Sees why it was frozen</li>
              <li>Has Vouch call the vendor, then gets the result</li>
            </ul>
          </Spotlight>
          <div className="flex items-center justify-center py-2">
            <span className="relative grid h-14 w-14 place-items-center rounded-full bg-white shadow-lg ring-1 ring-black/5">
              <span className="animate-ripple absolute inset-0 rounded-full bg-green-500/30" />
              <svg viewBox="0 0 24 24" className="relative h-6 w-6 text-green-600" fill="currentColor" aria-hidden>
                <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
              </svg>
            </span>
          </div>
          <Spotlight className="card card-hover p-6">
            <p className="relative eyebrow">Vendor</p>
            <p className="relative mt-2 text-xl font-semibold">Uline, Grainger, Sysco</p>
            <ul className="relative mt-4 space-y-2 text-sm text-gray-500">
              <li>Their phone rings with Vouch&apos;s agent</li>
              <li>Confirms or denies the bank change</li>
              <li>Answers a question only the real vendor knows</li>
            </ul>
          </Spotlight>
        </div>
      </section>
      </Reveal>

      {/* Sign in */}
      <Reveal>
      <section id="sign-in" className="scroll-mt-24 flex justify-center">
        <Link
          href="/login"
          className="group card card-hover inline-flex items-center gap-4 rounded-full py-3 pl-3 pr-6"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-black text-white transition-transform duration-300 group-hover:scale-110" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-gray-900">Sign in to continue</span>
            <span className="block text-xs text-gray-500">As a business or as a vendor</span>
          </span>
          <Arrow />
        </Link>
      </section>
      </Reveal>

      {/* Built with */}
      <section className="space-y-4 pb-6">
        <p className="eyebrow text-center">Built with</p>
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
          <div className="animate-marquee flex w-max gap-4 py-3 hover:[animation-play-state:paused]">
            {[...TOOLS, ...TOOLS].map((tool, index) => (
              <span
                key={index}
                className="flex items-center gap-3 whitespace-nowrap rounded-full border border-gray-300 bg-white py-2 pl-2 pr-5 shadow-[0_2px_10px_-4px_rgb(0_0_0/0.15)] transition-all duration-300 hover:-translate-y-0.5 hover:border-gray-900 hover:shadow-[0_8px_20px_-8px_rgb(0_0_0/0.3)]"
              >
                <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white ${tool.color}`}>
                  {tool.name.slice(0, 1)}
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-semibold text-gray-900">{tool.name}</span>
                  <span className="block text-xs text-gray-500">{tool.role}</span>
                </span>
              </span>
            ))}
          </div>
        </div>
        <p className="pt-6 text-center text-xs text-gray-400">Vouch · SD Hacks 2026</p>
      </section>
    </main>
  );
}
