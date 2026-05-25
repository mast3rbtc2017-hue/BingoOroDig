import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { useListMyTransactions, useListMyCards } from "@workspace/api-client-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { User, Wallet, History, CreditCard, Plus, Bell } from "lucide-react";
import { useNotifications } from "@/lib/useNotifications";
import { apiJson } from "@/lib/api-fetch";
import { formatCOP, formatCOPSigned } from "@/lib/currency";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const DEPOSIT_AMOUNTS = [10_000, 25_000, 50_000, 100_000, 200_000];

const TX_TYPE_LABELS: Record<string, string> = {
  deposit: "Recarga",
  purchase: "Compra de cartón",
  prize: "Premio ganado",
  withdrawal: "Retiro",
};

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [depositing, setDepositing] = useState<number | null>(null);

  const { data: transactions, refetch: refetchTx } = useListMyTransactions({
    query: { enabled: !!user, queryKey: ["/api/transactions"] }
  });

  const { data: cards } = useListMyCards({
    query: { enabled: !!user, queryKey: ["/api/cards"] }
  });

  const { data: notifications, refetch: refetchNotifs } = useNotifications();

  if (!user) return null;

  const roleLabel = user.role === "admin" ? "Administrador" : "Jugador";
  const wonCards = cards?.filter(c => c.isWinner) || [];

  const handleDeposit = async (amount: number) => {
    setDepositing(amount);
    try {
      await apiJson<{ newBalance: number }>("/api/transactions/deposit", "POST", { amount });
      await refreshUser();
      toast.success(`✅ ${formatCOPSigned(amount)} agregados a tu saldo`);
      refetchTx();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al recargar");
    } finally {
      setDepositing(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Profile header */}
          <div className="bg-card/40 backdrop-blur rounded-3xl border border-white/10 p-8 flex flex-col md:flex-row items-center gap-8 shadow-2xl">
            <div className="w-28 h-28 rounded-full bg-black/60 border-4 border-primary overflow-hidden flex items-center justify-center">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <User className="w-14 h-14 text-primary" />
              )}
            </div>

            <div className="flex-1 text-center md:text-left">
              <h1 className="text-4xl font-bold text-white mb-1">{user.displayName || user.username}</h1>
              <p className="text-primary font-medium tracking-widest uppercase text-sm mb-4">{roleLabel}</p>

              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <div className="bg-black/40 px-4 py-2 rounded-xl border border-white/5 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-accent" />
                  <span className="text-white/60 text-sm">Saldo</span>
                  <span className="font-bold text-white text-lg">{formatCOP(user.balance)}</span>
                </div>
                <div className="bg-black/40 px-4 py-2 rounded-xl border border-white/5 flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  <span className="text-white/60 text-sm">Victorias</span>
                  <span className="font-bold text-white text-lg">{user.totalWins || 0}</span>
                </div>
                <div className="bg-black/40 px-4 py-2 rounded-xl border border-white/5 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-green-400" />
                  <span className="text-white/60 text-sm">Cartones ganadores</span>
                  <span className="font-bold text-green-400 text-lg">{wonCards.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recargar saldo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card/40 backdrop-blur rounded-3xl border border-white/10 p-6"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-accent" /> Recargar Saldo
            </h3>
            <p className="text-white/50 text-sm mb-5">Recargas en pesos colombianos (COP). Elige un monto para seguir jugando.</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {DEPOSIT_AMOUNTS.map(amount => (
                <button
                  key={amount}
                  onClick={() => handleDeposit(amount)}
                  disabled={depositing !== null}
                  className={`
                    py-3 px-4 rounded-xl font-bold text-sm border transition-all
                    ${depositing === amount
                      ? "bg-primary text-black border-primary"
                      : "bg-black/40 text-white border-white/10 hover:border-primary/60 hover:bg-primary/10 hover:text-primary"}
                    disabled:opacity-50
                  `}
                >
                  {depositing === amount ? "..." : formatCOPSigned(amount)}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Notificaciones */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card/40 backdrop-blur rounded-3xl border border-white/10 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" /> Notificaciones
              </h3>
              {(notifications?.filter((n) => !n.read).length ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    await apiJson("/api/notifications/read-all", "POST");
                    refetchNotifs();
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Marcar todas leídas
                </button>
              )}
            </div>
            <div className="space-y-2">
              {notifications?.slice(0, 8).map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl border ${
                    n.read ? "bg-black/30 border-white/5" : "bg-primary/10 border-primary/30"
                  }`}
                >
                  <p className="font-medium text-white text-sm">{n.title}</p>
                  <p className="text-white/50 text-xs mt-0.5">{n.message}</p>
                </div>
              ))}
              {(!notifications || notifications.length === 0) && (
                <p className="text-white/30 text-sm text-center py-4">Sin notificaciones aún</p>
              )}
            </div>
            <p className="text-white/30 text-xs mt-3">
              Cuando el admin confirma tu BINGO, recibes aviso aquí y un mensaje en pantalla.
            </p>
          </motion.div>

          {/* Transactions + Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card/40 backdrop-blur rounded-3xl border border-white/10 p-6"
            >
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <History className="w-5 h-5 text-primary" /> Últimas Transacciones
              </h3>

              <div className="space-y-3">
                {transactions?.slice(-8).reverse().map(t => (
                  <div key={t.id} className="flex justify-between items-center p-3 bg-black/40 rounded-xl border border-white/5">
                    <div>
                      <p className="text-white font-medium text-sm">{TX_TYPE_LABELS[t.type] || t.type}</p>
                      <p className="text-xs text-white/40">{format(new Date(t.createdAt), "d MMM yyyy, HH:mm", { locale: es })}</p>
                    </div>
                    <div className={`font-bold text-sm ${t.type === "deposit" || t.type === "prize" ? "text-green-400" : "text-red-400"}`}>
                      {formatCOPSigned(t.type === "deposit" || t.type === "prize" ? t.amount : -t.amount)}
                    </div>
                  </div>
                ))}
                {(!transactions || transactions.length === 0) && (
                  <p className="text-white/40 text-center py-6">Sin transacciones aún</p>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card/40 backdrop-blur rounded-3xl border border-white/10 p-6"
            >
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" /> Mis Cartones
              </h3>

              <div className="space-y-3">
                {cards?.slice(-8).reverse().map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-black/40 rounded-xl border border-white/5">
                    <div>
                      <p className="text-white font-medium text-sm">Cartón #{c.id}</p>
                      <p className="text-xs text-white/40">Partida #{c.gameId} • Sala #{c.roomId}</p>
                    </div>
                    {c.isWinner && (
                      <span className="text-xs font-bold text-black bg-accent px-2 py-1 rounded-full">¡GANADOR!</span>
                    )}
                  </div>
                ))}
                {(!cards || cards.length === 0) && (
                  <p className="text-white/40 text-center py-6">Sin cartones comprados</p>
                )}
              </div>
            </motion.div>
          </div>

        </div>
      </main>
      <MobileNav />
    </div>
  );
}
