"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Terminal, 
  Database, 
  LogOut, 
  Cpu,
  X
} from "lucide-react";
import { useAdminStore } from "@/store/adminStore";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const logout = useAdminStore((state) => state.logout);
  const username = useAdminStore((state) => state.username);

  const menuItems = [
    { name: "Live Dashboard", path: "/admin", icon: LayoutDashboard },
    { name: "Connected Clients", path: "/admin/clients", icon: Users },
    { name: "Streaming Logs", path: "/admin/logs", icon: Terminal },
    { name: "Bullion Cache", path: "/admin/cache", icon: Database },
  ];

  const sidebarContent = (
    <aside className="w-64 border-r border-border bg-card/45 backdrop-blur-glass h-full flex flex-col justify-between p-6">
      <div className="flex flex-col gap-8">
        
        {/* Brand Block */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="text-gold-primary w-6 h-6 animate-pulse" />
              <h2 className="text-lg font-extrabold uppercase tracking-tight text-gold-light">
                api_server
              </h2>
            </div>
            {/* Close button — only visible on mobile */}
            {onClose && (
              <button
                onClick={onClose}
                className="md:hidden text-muted hover:text-foreground transition-colors p-1"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <span className="text-[10px] text-muted font-bold tracking-widest uppercase mt-1">
            Administration Console
          </span>
        </div>

        {/* Navigation list */}
        <nav className="flex flex-col gap-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            
            return (
              <Link key={item.path} href={item.path} onClick={onClose}>
                <span className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  isActive 
                    ? "bg-gold-primary/10 border-l-4 border-gold-primary text-gold-primary" 
                    : "text-muted hover:bg-white/5 hover:text-foreground"
                }`}>
                  <Icon className={`w-4 h-4 ${isActive ? "text-gold-primary" : "text-muted"}`} />
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile Block */}
      <div className="flex flex-col gap-4 border-t border-border pt-4">
        <div className="flex flex-col px-4">
          <span className="text-xs text-muted font-semibold uppercase">Active User</span>
          <span className="text-sm font-bold text-foreground truncate">{username || "Administrator"}</span>
        </div>
        
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-accent hover:bg-red-accent/10 transition-all duration-300 w-full text-left"
        >
          <LogOut className="w-4 h-4 text-red-accent" />
          Disconnect
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* ── Desktop: always-visible static sidebar ── */}
      <div className="hidden md:flex h-screen sticky top-0 shrink-0">
        {sidebarContent}
      </div>

      {/* ── Mobile: slide-in drawer with backdrop ── */}
      {/* Backdrop overlay */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 h-full transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
}
