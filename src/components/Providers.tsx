"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AlertProvider } from "@/components/Alert";
import { Sidebar } from "@/components/Sidebar";
import { ShopProvider } from "@/lib/store";

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot" ||
    pathname === "/reset"
  )
    return <>{children}</>;
  return (
    <AlertProvider>
      <ShopProvider>
        <div className="flex min-h-full min-w-0 flex-1 flex-col md:flex-row">
          <Sidebar />
          <main className="min-h-0 min-w-0 flex-1 overflow-auto px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </ShopProvider>
    </AlertProvider>
  );
}
