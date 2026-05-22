import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./lib/auth";
import NotFound from "@/pages/not-found";
import Home from "./pages/home";
import Login from "./pages/login";
import Register from "./pages/register";
import Lobby from "./pages/lobby";
import Room from "./pages/room";
import Profile from "./pages/profile";
import Leaderboard from "./pages/leaderboard";
import AdminDashboard from "./pages/admin/dashboard";
import AdminRooms from "./pages/admin/rooms";
import AdminGames from "./pages/admin/games";
import AdminUsers from "./pages/admin/users";
import AdminSorteos from "./pages/admin/sorteos";
import AdminSorteosLive from "./pages/admin/sorteos-live";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, adminOnly = false }: { component: any, adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
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
      <Route path="/room/:id"><ProtectedRoute component={Room} /></Route>
      <Route path="/profile"><ProtectedRoute component={Profile} /></Route>
      
      <Route path="/admin"><ProtectedRoute component={AdminDashboard} adminOnly /></Route>
      <Route path="/admin/rooms"><ProtectedRoute component={AdminRooms} adminOnly /></Route>
      <Route path="/admin/games"><ProtectedRoute component={AdminGames} adminOnly /></Route>
      <Route path="/admin/users"><ProtectedRoute component={AdminUsers} adminOnly /></Route>
      <Route path="/admin/sorteos/nuevo"><ProtectedRoute component={() => <AdminSorteos autoCreate />} adminOnly /></Route>
      <Route path="/admin/sorteos/:id/live"><ProtectedRoute component={AdminSorteosLive} adminOnly /></Route>
      <Route path="/admin/sorteos"><ProtectedRoute component={AdminSorteos} adminOnly /></Route>
      
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
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
