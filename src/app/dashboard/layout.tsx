"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { supabase } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Tableau de bord", icon: "🏠" },
  { href: "/dashboard/transactions", label: "Transactions", icon: "💰" },
  { href: "/dashboard/documents", label: "Documents", icon: "📄" },
  { href: "/dashboard/budgets", label: "Budgets", icon: "🎯" },
  { href: "/dashboard/receivables", label: "À percevoir", icon: "📬" },
  { href: "/dashboard/forecast", label: "Prévisionnel", icon: "🔮" },
  { href: "/dashboard/reports", label: "Rapports", icon: "📊" },
  { href: "/dashboard/settings", label: "Paramètres", icon: "⚙️" },
];

function NavItem({
  href, label, icon, active, onClick,
}: {
  href: string; label: string; icon: string; active: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
      style={active
        ? { backgroundColor: "var(--accent-light)", color: "var(--accent)" }
        : { color: "var(--text-secondary)" }}
    >
      <span className="text-base shrink-0">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function SidebarContent({ onNavClick, showClose, onClose }: {
  onNavClick?: () => void; showClose?: boolean; onClose?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onNavClick}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: "var(--accent)" }}>F</div>
          <span className="font-bold text-base" style={{ color: "var(--text-primary)" }}>FinPilot</span>
        </Link>
        {showClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg transition-opacity hover:opacity-70" style={{ color: "var(--text-muted)" }} aria-label="Fermer">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            active={item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href)}
            onClick={onNavClick}
          />
        ))}
      </nav>
      <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
        <ThemeSwitcher />
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/auth/login");
      } else {
        setAuthChecked(true);
      }
    });
  }, [router]);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--bg-primary)" }}>
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold mx-auto" style={{ backgroundColor: "var(--accent)" }}>F</div>
          <p className="text-sm animate-pulse" style={{ color: "var(--text-muted)" }}>Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0" style={{ backgroundColor: "var(--bg-sidebar)", borderRight: "1px solid var(--border)", height: "100vh", position: "sticky", top: 0 }}>
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 lg:hidden" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col lg:hidden" style={{ backgroundColor: "var(--bg-sidebar)", borderRight: "1px solid var(--border)" }}>
            <SidebarContent onNavClick={() => setMobileOpen(false)} showClose onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30" style={{ backgroundColor: "var(--bg-sidebar)", borderBottom: "1px solid var(--border)" }}>
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-lg" style={{ color: "var(--text-primary)" }} aria-label="Menu">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: "var(--accent)" }}>F</div>
            <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>FinPilot</span>
          </Link>
          <div className="w-9" />
        </header>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-2 py-2" style={{ backgroundColor: "var(--bg-sidebar)", borderTop: "1px solid var(--border)" }}>
          {navItems.slice(0, 5).map((item) => {
            const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg" style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-[10px] font-medium">{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-6">{children}</main>
      </div>
    </div>
  );
}
