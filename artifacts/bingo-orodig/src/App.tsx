import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, useParams } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./lib/auth";
import { auth as firebaseAuth } from "./lib/firebase";
import NotFound from "@/pages/not-found";
import Home from "./pages/home";
import Login from "./pages/login";
import Register from "./pages/register";
import Lobby from "./pages/lobby";
import SorteoPage from "./pages/room";
import Profile from "./pages/profile";
import WalletPage from "./pages/wallet";
import RifasPage from "./pages/rifas";
import RifaDetailPage from "./pages/rifa";
import JugandoGanandoSplash from "./pages/jugando-y-ganando";
import AdminRifas from "./pages/admin/rifas";
import Leaderboard from "./pages/leaderboard";
import AdminDashboard from "./pages/admin/dashboard";
import AdminUsers from "./pages/admin/users";
import AdminSorteos from "./pages/admin/sorteos";
import AdminSorteosLive from "./pages/admin/sorteos-live";
import Roulette from "./pages/roulette";
import AdminRoulette from "./pages/admin/roulette";
import { NotificationsListener } from "@/components/NotificationsListener";

const queryClient = new QueryClient();

function RedirectTo({ href }: { href: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(href);
  }, [href, setLocation]);
  return null;
}

function RedirectRoomToSorteo() {
  const { id } = useParams();
  if (!id) return <RedirectTo href="/lobby" />;
  return <RedirectTo href={`/sorteo/${id}`} />;
}

function ProtectedRoute({ component: Component, adminOnly = false }: { component: any, adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading || (firebaseAuth.currentUser && !user)) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="text-primary text-xl">Loading...</div></div>;
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  if (adminOnly && user.role !== "admin") {
    setLocation("/");
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/leaderboard" component={Leaderboard} />
      
      <Route path="/lobby"><ProtectedRoute component={Lobby} /></Route>
      <Route path="/sorteo/:id"><ProtectedRoute component={SorteoPage} /></Route>
      <Route path="/room/:id"><RedirectRoomToSorteo /></Route>
      <Route path="/profile"><ProtectedRoute component={Profile} /></Route>
      <Route path="/wallet"><ProtectedRoute component={WalletPage} /></Route>
      <Route path="/roulette"><ProtectedRoute component={Roulette} /></Route>
      <Route path="/jugando-y-ganando"><ProtectedRoute component={JugandoGanandoSplash} /></Route>
      <Route path="/rifas"><ProtectedRoute component={RifasPage} /></Route>
      <Route path="/rifas/:id"><ProtectedRoute component={RifaDetailPage} /></Route>
      
      <Route path="/admin"><ProtectedRoute component={AdminDashboard} adminOnly /></Route>
      <Route path="/admin/rooms"><ProtectedRoute component={() => <RedirectTo href="/admin/sorteos" />} adminOnly /></Route>
      <Route path="/admin/games"><ProtectedRoute component={() => <RedirectTo href="/admin/sorteos" />} adminOnly /></Route>
      <Route path="/admin/users"><ProtectedRoute component={AdminUsers} adminOnly /></Route>
      <Route path="/admin/sorteos/nuevo"><ProtectedRoute component={() => <AdminSorteos autoCreate />} adminOnly /></Route>
      <Route path="/admin/sorteos/:id/live"><ProtectedRoute component={AdminSorteosLive} adminOnly /></Route>
      <Route path="/admin/sorteos"><ProtectedRoute component={AdminSorteos} adminOnly /></Route>
      <Route path="/admin/roulette"><ProtectedRoute component={AdminRoulette} adminOnly /></Route>
      <Route path="/admin/rifas"><ProtectedRoute component={AdminRifas} adminOnly /></Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Ensure dark mode class is applied to root element
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('dark');
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <NotificationsListener />
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
