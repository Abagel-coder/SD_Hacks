import { RequireAccount } from '@/components/RequireAccount';

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return <RequireAccount kind="vendor">{children}</RequireAccount>;
}
