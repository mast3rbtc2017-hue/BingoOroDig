import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import logoUrl from "@assets/image_1779437502396.png";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Home, Users, Trophy, User, Shield, LogOut, Wallet, Gamepad2, CircleDot } from "lucide-react";

export function Navbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close on route change
  useEffect(() => { setMenuOpen(false); }, [location]);
  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-navbar]")) setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const navLinks = user ? [
    { href: "/lobby", label: "Lobby", icon: Gamepad2 },
    { href: "/roulette", label: "Ruleta", icon: CircleDot },
    { href: "/profile", label: "Perfil", icon: User },
    { href: "/leaderboard", label: "Ranking", icon: Trophy },
    ...(user.role === "admin" ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ] : [
    { href: "/login", label: "Iniciar Sesión", icon: Home },
    { href: "/register", label: "Jugar Ahora", icon: Gamepad2 },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/90 backdrop-blur-lg" data-navbar>
      <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img src={logoUrl} alt="Bingo OroDig" className="h-9 md:h-10 object-contain" />
          <span className="text-lg md:text-xl font-serif font-bold text-primary tracking-wider uppercase hidden xs:block">
            OroDig
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              {navLinks.map(l => (
                <Link key={l.href} href={l.href}>
                  <Button variant="ghost" className={`text-sm ${location === l.href ? "text-primary bg-primary/10" : "text-white/70 hover:text-white hover:bg-white/5"} ${l.href === "/admin" ? "border border-primary/30 text-primary" : ""}`}>
                    {l.label}
                  </Button>
                </Link>
              ))}
              <div className="flex items-center gap-1 bg-black/40 border border-white/10 px-3 py-1.5 rounded-xl ml-2">
                <Wallet className="w-3.5 h-3.5 text-accent" />
                <span className="text-accent font-bold text-sm">${user.balance?.toLocaleString() ?? 0}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => logout()} className="text-white/40 hover:text-white ml-1">
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="text-white/70 hover:text-white">Iniciar Sesión</Button>
              </Link>
              <Link href="/register">
                <Button className="bg-gradient-to-r from-primary to-accent text-black font-bold">Jugar Ahora</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile: balance + hamburger */}
        <div className="flex md:hidden items-center gap-2" data-navbar>
          {user && (
            <div className="flex items-center gap-1 bg-black/40 border border-white/10 px-2.5 py-1 rounded-lg">
              <Wallet className="w-3 h-3 text-accent" />
              <span className="text-accent font-bold text-xs">${user.balance?.toLocaleString() ?? 0}</span>
            </div>
          )}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="md:hidden border-t border-white/10 bg-background/95 backdrop-blur-xl px-4 py-4 space-y-1"
            data-navbar
          >
            {navLinks.map(l => (
              <Link key={l.href} href={l.href}>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors
                  ${location === l.href ? "bg-primary/15 text-primary" : "text-white/70 hover:text-white hover:bg-white/5"}`}>
                  <l.icon className="w-5 h-5" />
                  <span className="font-medium">{l.label}</span>
                </div>
              </Link>
            ))}
            {user && (
              <button onClick={() => { setMenuOpen(false); logout(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Cerrar Sesión</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
