import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { useListMyTransactions } from "@workspace/api-client-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  Plus,
  Minus,
  ChevronLeft,
} from "lucide-react";
import { apiJson } from "@/lib/api-fetch";
import { formatCOP, formatCOPSigned } from "@/lib/currency";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const DEPOSIT_AMOUNTS = [10_000, 25_000, 50_000, 100_000, 200_000];
const WITHDRAW_AMOUNTS = [10_000, 25_000, 50_000, 100_000];

const TX_TYPE_LABELS: Record<string, string> = {
  deposit: "Depósito",
  withdrawal: "Retiro",
  purchase: "Compra",
  prize: "Premio",
};

type Tab = "deposit" | "withdraw";

function parseCOPInput(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export default function WalletPage() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>("deposit");
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: transactions, refetch: refetchTx } = useListMyTransactions({
    query: { enabled: !!user, queryKey: ["/api/transactions"] },
  });

  if (!user) return null;

  const balance = user.balance ?? 0;
  const walletTx =
    transactions?.filter((t) => t.type === "deposit" || t.type === "withdrawal") ?? [];

  const runTransaction = async (type: Tab, amount: number) => {
    if (amount < 1000) {
      toast.error("El monto mínimo es $1.000 COP");
      return;
    }
    if (amount > 5_000_000) {
      toast.error("El monto máximo es $5.000.000 COP");
      return;
    }
    if (type === "withdraw" && amount > balance) {
      toast.error("Saldo insuficiente para este retiro");
      return;
    }

    setLoading(true);
    try {
      const path =
        type === "deposit"
          ? "/api/transactions/deposit"
          : "/api/transactions/withdraw";
      await apiJson<{ newBalance: number }>(path, "POST", { amount });
      await refreshUser();
      setCustomAmount("");
      refetchTx();
      toast.success(
        type === "deposit"
          ? `Depósito de ${formatCOPSigned(amount)} realizado`
          : `Retiro de ${formatCOPSigned(amount)} solicitado`,
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar la operación");
    } finally {
      setLoading(false);
    }
  };

  const handleQuick = (amount: number) => runTransaction(tab, amount);

  const handleCustom = () => {
    const amount = parseCOPInput(customAmount);
    if (!amount) {
      toast.error("Ingresa un monto válido");
      return;
    }
    runTransaction(tab, amount);
  };

  const quickAmounts = tab === "deposit" ? DEPOSIT_AMOUNTS : WITHDRAW_AMOUNTS;

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-6 md:py-10 pb-28 md:pb-12">
        <div className="max-w-lg mx-auto space-y-6">
          <Link href="/lobby">
            <button
              type="button"
              className="flex items-center gap-1 text-white/50 hover:text-white text-sm mb-2 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Volver
            </button>
          </Link>

          {/* Balance hero */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 via-card/60 to-accent/10 p-6 shadow-[0_0_40px_rgba(212,175,55,0.12)]"
          >
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-white/50 text-xs uppercase tracking-widest">
                  Mi billetera
                </p>
                <p className="text-white/80 text-sm">{user.username}</p>
              </div>
            </div>
            <p className="text-white/50 text-sm mb-1">Saldo disponible</p>
            <p className="text-4xl md:text-5xl font-black text-white tabular-nums">
              {formatCOP(balance)}
            </p>
            <p className="text-white/40 text-xs mt-2">Pesos colombianos (COP)</p>
          </motion.div>

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => {
                setTab("deposit");
                setCustomAmount("");
              }}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                tab === "deposit"
                  ? "bg-gradient-to-r from-primary to-accent text-black shadow-lg"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <ArrowDownCircle className="w-4 h-4" />
              Depositar
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("withdraw");
                setCustomAmount("");
              }}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                tab === "withdraw"
                  ? "bg-gradient-to-r from-red-500/90 to-orange-500/90 text-white shadow-lg"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <ArrowUpCircle className="w-4 h-4" />
              Retirar
            </button>
          </div>

          {/* Action panel */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: tab === "deposit" ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="bg-card/50 backdrop-blur rounded-3xl border border-white/10 p-5 space-y-5"
            >
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  {tab === "deposit" ? (
                    <>
                      <Plus className="w-5 h-5 text-accent" /> Recargar saldo
                    </>
                  ) : (
                    <>
                      <Minus className="w-5 h-5 text-orange-400" /> Retirar fondos
                    </>
                  )}
                </h2>
                <p className="text-white/45 text-sm mt-1">
                  {tab === "deposit"
                    ? "Añade COP a tu cuenta para jugar bingo y ruleta."
                    : `Puedes retirar hasta ${formatCOP(balance)}.`}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {quickAmounts.map((amount) => {
                  const disabled =
                    loading || (tab === "withdraw" && amount > balance);
                  return (
                    <button
                      key={amount}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleQuick(amount)}
                      className={`py-3 px-2 rounded-xl font-bold text-sm border transition-all disabled:opacity-40 ${
                        tab === "deposit"
                          ? "bg-black/40 text-white border-white/10 hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                          : "bg-black/40 text-white border-white/10 hover:border-orange-500/50 hover:bg-orange-500/10"
                      }`}
                    >
                      {formatCOPSigned(amount)}
                    </button>
                  );
                })}
                {tab === "withdraw" && balance >= 1000 && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuick(balance)}
                    className="py-3 px-2 rounded-xl font-bold text-sm border bg-orange-500/10 text-orange-300 border-orange-500/30 hover:bg-orange-500/20 disabled:opacity-40 col-span-2 sm:col-span-1"
                  >
                    Todo ({formatCOP(balance)})
                  </button>
                )}
              </div>

              <div className="space-y-2 pt-1 border-t border-white/5">
                <Label className="text-white/60 text-sm">Otro monto (COP)</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: 75000"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="bg-black/40 border-white/10 text-white h-11"
                  />
                  <Button
                    type="button"
                    disabled={loading}
                    onClick={handleCustom}
                    className={`shrink-0 font-bold h-11 px-5 ${
                      tab === "deposit"
                        ? "bg-gradient-to-r from-primary to-accent text-black"
                        : "bg-orange-500 hover:bg-orange-600 text-white"
                    }`}
                  >
                    {loading ? "..." : tab === "deposit" ? "Depositar" : "Retirar"}
                  </Button>
                </div>
                {customAmount && (
                  <p className="text-white/40 text-xs">
                    = {formatCOP(parseCOPInput(customAmount))}
                  </p>
                )}
              </div>

              {tab === "withdraw" && balance < 1000 && (
                <p className="text-orange-400/80 text-xs text-center py-2">
                  Necesitas al menos $1.000 COP de saldo para retirar.
                </p>
              )}
            </motion.div>
          </AnimatePresence>

          {/* History */}
          <div className="bg-card/40 backdrop-blur rounded-3xl border border-white/10 p-5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Movimientos de billetera
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {walletTx
                .slice()
                .reverse()
                .slice(0, 12)
                .map((t) => (
                  <div
                    key={t.id}
                    className="flex justify-between items-center p-3 bg-black/40 rounded-xl border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      {t.type === "deposit" ? (
                        <ArrowDownCircle className="w-5 h-5 text-green-400 shrink-0" />
                      ) : (
                        <ArrowUpCircle className="w-5 h-5 text-orange-400 shrink-0" />
                      )}
                      <div>
                        <p className="text-white font-medium text-sm">
                          {TX_TYPE_LABELS[t.type] || t.type}
                        </p>
                        <p className="text-xs text-white/40">
                          {format(new Date(t.createdAt), "d MMM yyyy, HH:mm", {
                            locale: es,
                          })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-bold text-sm ${
                        t.type === "deposit" ? "text-green-400" : "text-orange-400"
                      }`}
                    >
                      {formatCOPSigned(
                        t.type === "deposit" ? t.amount : -t.amount,
                      )}
                    </span>
                  </div>
                ))}
              {walletTx.length === 0 && (
                <p className="text-white/30 text-sm text-center py-8">
                  Aún no hay depósitos ni retiros
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
