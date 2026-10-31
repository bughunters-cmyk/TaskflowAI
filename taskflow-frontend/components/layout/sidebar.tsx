"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Mic,
  ListTodo,
  Settings,
  Building2,
  LogOut,
  ChevronDown,
  Plus,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/meetings", label: "Meetings", icon: Mic },
  { href: "/tasks", label: "Action Items", icon: ListTodo },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, firms, currentFirm, setCurrentFirm, signOut } = useAuth();
  const [firmOpen, setFirmOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFirmOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-white/[0.06] bg-[#0a0e17]">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 px-5 border-b border-white/[0.06]">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500">
          <Mic className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
        </div>
        <div className="leading-none">
          <div className="text-[13px] font-semibold tracking-tight text-white">
            TaskFlow AI
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Meeting Intelligence</div>
        </div>
      </div>

      {/* Firm switcher */}
      <div className="px-3 py-3 border-b border-white/[0.06]" ref={dropdownRef}>
        <button
          onClick={() => setFirmOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-left transition hover:bg-white/[0.05]"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-200">
            {currentFirm?.name || "Select firm"}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
              firmOpen && "rotate-180"
            )}
          />
        </button>

        {firmOpen && (
          <div className="mt-1.5 overflow-hidden rounded-md border border-white/[0.08] bg-[#111827] shadow-xl">
            {firms.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setCurrentFirm(f);
                  setFirmOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-2 text-left text-[13px] transition hover:bg-white/[0.04]",
                  currentFirm?.id === f.id
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-slate-300"
                )}
              >
                <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  {f.role}
                </span>
              </button>
            ))}
            <Link
              href="/firms"
              onClick={() => setFirmOpen(false)}
              className="flex items-center gap-2 border-t border-white/[0.06] px-2.5 py-2 text-[13px] text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Create or join firm
            </Link>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition",
                active
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-slate-300">
            {(user?.email?.[0] || "U").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-slate-200">
              {user?.email?.split("@")[0]}
            </div>
            <div className="truncate text-[11px] text-slate-500">{user?.email}</div>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
