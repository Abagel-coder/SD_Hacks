import { RequireAccount } from '@/components/RequireAccount';

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return <RequireAccount kind="business">{children}</RequireAccount>;
}
