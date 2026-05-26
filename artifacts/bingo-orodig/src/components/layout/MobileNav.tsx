import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Gamepad2, Trophy, User, Shield, CircleDot, Ticket } from "lucide-react";

export function MobileNav() {
  const { user } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  // Don't show on admin live panel or room page (too distracting)
  if (location.startsWith("/sorteo/") || location.startsWith("/room/") || (location.startsWith("/admin/sorteos/") && location.endsWith("/live"))) return null;

  const tabs = [
    { href: "/lobby", label: "Lobby", icon: Gamepad2 },
    { href: "/roulette", label: "Ruleta", icon: CircleDot },
    { href: "/rifas", label: "Jugando y Ganando", icon: Ticket },
    { href: "/leaderboard", label: "Ranking", icon: Trophy },
    { href: "/profile", label: "Perfil", icon: User },
    ...(user.role === "admin" ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-white/10 bg-background/95 backdrop-blur-xl safe-bottom">
      <div className="grid min-h-[4.25rem] px-1 py-1.5" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map(tab => {
          const active = location === tab.href || (tab.href !== "/" && location.startsWith(tab.href));
          const longLabel = tab.label.length > 12;
          return (
            <Link key={tab.href} href={tab.href}>
              <div className={`flex flex-col items-center justify-center h-full gap-0.5 transition-colors ${active ? "text-primary" : "text-white/40"}`}>
                <tab.icon className={`w-5 h-5 shrink-0 ${active ? "drop-shadow-[0_0_6px_rgba(212,175,55,0.8)]" : ""}`} />
                <span
                  className={`font-medium text-center leading-tight px-0.5 ${
                    longLabel ? "text-[7px] max-w-[3.4rem]" : "text-[10px]"
                  }`}
                >
                  {tab.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
