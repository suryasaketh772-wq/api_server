"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Terminal, 
  Database, 
  LogOut, 
  TrendingUp,
  Cpu
} from "lucide-react";
import { useAdminStore } from "@/store/adminStore";

export default function Sidebar() {
  const pathname = usePathname();
  const logout = useAdminStore((state) => state.logout);
  const username = useAdminStore((state) => state.username);

  const menuItems = [
    { name: "Live Dashboard", path: "/admin", icon: LayoutDashboard },
    { name: "Connected Clients", path: "/admin/clients", icon: Users },
    { name: "Streaming Logs", path: "/admin/logs", icon: Terminal },
    { name: "Bullion Cache", path: "/admin/cache", icon: Database },
  ];

  return (
    <aside className="w-64 border-r border-border bg-card/45 backdrop-blur-glass min-h-screen flex flex-col justify-between p-6">
      <div className="flex flex-col gap-8">
        
        {/* Brand Block */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Cpu className="text-gold-primary w-6 h-6 animate-pulse" />
            <h2 className="text-lg font-extrabold uppercase tracking-tight text-gold-light">
              api_server
            </h2>
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
              <Link key={item.path} href={item.path}>
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
}
