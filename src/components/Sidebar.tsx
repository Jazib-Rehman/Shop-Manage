"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

function Icon({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

const I = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  inventory: (
    <>
      <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
      <path d="M12 12 4 7" />
      <path d="m12 12 8-5" />
      <path d="M12 12v9" />
    </>
  ),
  stock: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="M3.3 7 12 12l8.7-5" />
      <path d="M12 22V12" />
    </>
  ),
  catalog: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  operations: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </>
  ),
  purchases: (
    <>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57L22 7H6" />
    </>
  ),
  trips: (
    <>
      <path d="M10 17h4V5H2v12h3" />
      <path d="M20 17h2v-4l-3-4h-5v8h2" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </>
  ),
  sales: (
    <>
      <path d="M12 2v20" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  contacts: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  partners: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  customers: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
};

const groups = [
  {
    id: "stock",
    label: "Inventory",
    icon: I.inventory,
    links: [
      { href: "/inventory", label: "Stock & costs", icon: I.stock },
      { href: "/catalog", label: "Marble catalog", icon: I.catalog },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: I.operations,
    links: [
      { href: "/purchases", label: "Purchases", icon: I.purchases },
      { href: "/trips", label: "Trips & freight", icon: I.trips },
      { href: "/sales", label: "Sales", icon: I.sales },
    ],
  },
  {
    id: "contacts",
    label: "Contacts",
    icon: I.contacts,
    links: [
      { href: "/partners", label: "Partners", icon: I.partners },
      { href: "/customers", label: "Customers", icon: I.customers },
    ],
  },
];

export function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(() => new Set(groups.map((g) => g.id)));
  const [menu, setMenu] = useState(false);

  const isActive = (href: string) =>
    path === href || (href !== "/" && path.startsWith(`${href}/`));

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const closeMenu = () => setMenu(false);

  useEffect(() => {
    if (!menu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menu]);

  const nav = (
    <>
      <div className="border-b border-white/10 px-4 py-5">
        <Link href="/" onClick={closeMenu} className="flex items-center gap-3 rounded-xl px-1 py-0.5 transition hover:bg-white/5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-sm font-bold text-white shadow-lg shadow-teal-950/40">
            SM
          </span>
          <span>
            <span className="block text-base font-bold tracking-tight text-white">Shop Manager</span>
            <span className="block text-sm text-zinc-400">Marble inventory</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) closeMenu();
      }}>
        <Link
          href="/"
          className={`mb-5 flex items-center gap-3 rounded-xl px-3 py-3 text-base transition ${
            path === "/"
              ? "bg-teal-500/15 font-semibold text-teal-100 ring-1 ring-teal-500/25"
              : "font-medium text-zinc-300 hover:bg-white/5 hover:text-white"
          }`}
        >
          <Icon className="h-5 w-5 shrink-0">{I.dashboard}</Icon>
          Dashboard
        </Link>

        <div className="space-y-4">
          {groups.map((group) => {
            const expanded = open.has(group.id);
            const groupActive = group.links.some((link) => isActive(link.href));
            return (
              <section key={group.id}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-bold uppercase tracking-wide transition ${
                    groupActive
                      ? "text-teal-300"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                  onClick={() => toggle(group.id)}
                  aria-expanded={expanded}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80">{group.icon}</Icon>
                  <span className="flex-1">{group.label}</span>
                  <Icon className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}>
                    <path d="m9 18 6-6-6-6" />
                  </Icon>
                </button>

                {expanded && (
                  <div className="mt-1.5 ml-4 space-y-1 border-l border-white/10 pl-2">
                    {group.links.map((link) => {
                      const active = isActive(link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-base transition ${
                            active
                              ? "bg-teal-500/15 font-semibold text-teal-100"
                              : "font-medium text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                          }`}
                        >
                          {active && (
                            <span className="absolute -left-[9px] top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-teal-400" />
                          )}
                          <Icon className="h-[18px] w-[18px] shrink-0 opacity-90">{link.icon}</Icon>
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-sm font-semibold text-zinc-400 transition hover:text-red-300"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
        >
          <Icon className="h-4 w-4 shrink-0">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
          </Icon>
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-[#0f1419] px-4 py-3 text-zinc-100 md:hidden">
        <button
          type="button"
          className="rounded-lg p-2 hover:bg-white/10"
          aria-label="Open menu"
          onClick={() => setMenu(true)}
        >
          <Icon className="h-6 w-6">
            <path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" />
          </Icon>
        </button>
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500 text-sm font-bold text-white">
            SM
          </span>
          <span className="truncate text-base font-bold">Shop Manager</span>
        </Link>
      </header>

      {menu && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Close menu"
          onClick={closeMenu}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-white/5 bg-[#0f1419] text-zinc-100 transition-transform duration-200 md:sticky md:top-0 md:h-screen md:w-64 md:max-w-none md:shrink-0 md:translate-x-0 ${
          menu ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-end border-b border-white/10 px-3 py-2 md:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
            onClick={closeMenu}
          >
            <Icon className="h-5 w-5">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </Icon>
          </button>
        </div>
        {nav}
      </aside>
    </>
  );
}
