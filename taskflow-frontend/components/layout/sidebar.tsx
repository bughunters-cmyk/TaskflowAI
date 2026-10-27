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
import { useState } from "react";

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

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 border-r border-slate-800 bg-surface-950 flex flex-col z-40">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <Mic className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-semibold text-sm tracking-tight">TaskFlow AI</div>
            <div className="text-[11px] text-slate-500">Meeting Intelligence</div>
          </div>
        </div>
      </div>

      {/* Firm switcher */}
      <div className="px-3 py-3 border-b border-slate-800">
        <button
          onClick={() => setFirmOpen(!firmOpen)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm font-medium truncate">
              {currentFirm?.name || "Select firm"}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-slate-500 transition-transform",
              firmOpen && "rotate-180"
            )}
          />
        </button>

        {firmOpen && (
          <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
            {firms.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setCurrentFirm(f);
                  setFirmOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-800 transition-colors",
                  currentFirm?.id === f.id && "bg-slate-800 text-brand-400"
                )}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{f.name}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">
                  {f.role}
                </span>
              </button>
            ))}
            <Link
              href="/firms"
              onClick={() => setFirmOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-t border-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
              Create or join firm
            </Link>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
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
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-brand-500/10 text-brand-400"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-900"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-medium text-slate-300">
            {user?.email?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {user?.email?.split("@")[0]}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {user?.email}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
