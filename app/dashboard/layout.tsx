import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <Header />
      <main className="pt-16 lg:pt-0 lg:ml-64 min-h-screen">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
