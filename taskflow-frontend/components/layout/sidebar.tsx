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
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/meetings", label: "Meetings", icon: Mic },
  { href: "/tasks", label: "Action Items", icon: ListTodo },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MIN_W = 200;
const MAX_W = 360;
const DEFAULT_W = 260;

export function Sidebar() {
  const pathname = usePathname();
  const { user, firms, currentFirm, setCurrentFirm, signOut } = useAuth();
  const [firmOpen, setFirmOpen] = useState(false);
  const [width, setWidth] = useState(DEFAULT_W);
  const [resizing, setResizing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // restore width
  useEffect(() => {
    const saved = localStorage.getItem("taskflow_sidebar_w");
    if (saved) {
      const n = parseInt(saved, 10);
      if (!isNaN(n) && n >= MIN_W && n <= MAX_W) setWidth(n);
    }
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizing) return;
      const next = Math.min(MAX_W, Math.max(MIN_W, e.clientX));
      setWidth(next);
    }
    function onUp() {
      if (resizing) {
        setResizing(false);
        localStorage.setItem("taskflow_sidebar_w", String(width));
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing, width]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFirmOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // expose width to CSS variable for main content offset
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", `${width}px`);
  }, [width]);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/[0.06] bg-[#0a0d14]/95 backdrop-blur-xl"
      style={{ width }}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-white/[0.06]">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-glow">
          <Sparkles className="h-4 w-4 text-white" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-semibold tracking-tight text-white">
            TaskFlow AI
          </div>
          <div className="text-[10px] text-slate-500">Meeting Intelligence</div>
        </div>
      </div>

      {/* Firm switcher */}
      <div className="px-3 py-3 border-b border-white/[0.06]" ref={dropdownRef}>
        <button
          onClick={() => setFirmOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-left transition hover:border-white/[0.1] hover:bg-white/[0.05]"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
            <Building2 className="h-3.5 w-3.5" />
          </div>
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
          <div className="mt-1.5 overflow-hidden rounded-lg border border-white/[0.08] bg-[#111622] shadow-soft">
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
        <p className="mb-2 px-2.5 text-[10px] font-medium uppercase tracking-wider text-slate-600">
          Workspace
        </p>
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
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
                active
                  ? "bg-emerald-500/10 text-emerald-400 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.15)]"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition",
                  active ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"
                )}
                strokeWidth={1.75}
              />
              {item.label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 text-[11px] font-semibold text-slate-200 ring-1 ring-white/10">
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

      {/* Resize handle */}
      <div
        className={cn("sidebar-resize", resizing && "active")}
        onMouseDown={(e) => {
          e.preventDefault();
          setResizing(true);
        }}
      />
    </aside>
  );
}
