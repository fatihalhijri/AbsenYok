import { BottomNav } from '@/components/layout/bottom-nav';
import { EmployeeTopbar } from '@/components/layout/employee-topbar';

/**
 * Layout karyawan (mobile-first). Di layar ≥ 768 px tampil terpusat selebar maks 480 px agar
 * terasa seperti aplikasi HP.
 */
export default function EmployeeLayout({ children }: LayoutProps<'/app'>) {
  return (
    <div className="flex min-h-dvh flex-1 justify-center bg-muted/50">
      <div className="flex min-h-dvh w-full max-w-[480px] flex-col bg-background md:border-x md:shadow-lg">
        <EmployeeTopbar />
        <main className="flex flex-1 flex-col px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
