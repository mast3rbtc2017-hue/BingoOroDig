import { Link } from "wouter";
import logoUrl from "@assets/image_1779437502396.png";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <img src={logoUrl} alt="Bingo OroDig" className="h-10 object-contain" />
          <span className="text-xl font-serif font-bold text-primary tracking-wider uppercase hidden sm:block">
            OroDig
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/lobby">
                <Button variant="ghost" className="text-primary hover:text-accent hover:bg-primary/10">
                  Lobby
                </Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost" className="text-white hover:bg-white/10">
                  Profile
                </Button>
              </Link>
              {user.role === 'admin' && (
                <Link href="/admin">
                  <Button variant="outline" className="border-primary/50 text-primary">
                    Admin
                  </Button>
                </Link>
              )}
              <Button variant="secondary" onClick={() => logout()}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="text-white hover:bg-white/10">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-primary text-primary-foreground hover:bg-accent font-bold">
                  Play Now
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
