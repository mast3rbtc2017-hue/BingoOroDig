import { useGetDashboardStats } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Users, Presentation, Gamepad2, Coins } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetDashboardStats({
    query: { queryKey: ["/api/stats/dashboard"] }
  });

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-serif font-bold text-white mb-2">Panel de Administración</h1>
            <p className="text-white/60">Resumen general de la plataforma</p>
          </div>
          <div className="flex gap-4">
            <Link href="/admin/rooms">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-black">Gestionar Salas</Button>
            </Link>
            <Link href="/admin/users">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-black">Gestionar Usuarios</Button>
            </Link>
            <Link href="/admin/games">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-black">Control de Partidas</Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-card/50 border border-white/5 rounded-2xl h-32 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { label: "Total Usuarios", value: stats?.totalUsers || 0, icon: Users },
              { label: "Partidas Activas", value: stats?.activeGames || 0, icon: Gamepad2 },
              { label: "Total Salas", value: stats?.totalRooms || 0, icon: Presentation },
              { label: "Ingresos", value: `$${stats?.totalRevenue || 0}`, icon: Coins },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="bg-card/40 backdrop-blur border border-white/10 p-6 rounded-2xl"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-primary/20 rounded-xl">
                    <stat.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">{stat.label}</h3>
                </div>
                <p className="text-4xl font-bold text-white">{stat.value}</p>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
