import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { useListMyTransactions, useListMyCards } from "@workspace/api-client-react";
import { format } from "date-fns";
import { User, Wallet, History, CreditCard } from "lucide-react";
import { motion } from "framer-motion";

export default function Profile() {
  const { user } = useAuth();
  
  const { data: transactions } = useListMyTransactions({
    query: { enabled: !!user, queryKey: ["/api/transactions"] }
  });

  const { data: cards } = useListMyCards({
    query: { enabled: !!user, queryKey: ["/api/cards"] }
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          
          <div className="bg-card/40 backdrop-blur rounded-3xl border border-white/10 p-8 mb-8 flex flex-col md:flex-row items-center gap-8 shadow-2xl">
            <div className="w-32 h-32 rounded-full bg-black/60 border-4 border-primary overflow-hidden flex items-center justify-center">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <User className="w-16 h-16 text-primary" />
              )}
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-4xl font-bold text-white mb-2">{user.displayName || user.username}</h1>
              <p className="text-primary font-medium tracking-widest uppercase mb-4">{user.role}</p>
              
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <div className="bg-black/40 px-4 py-2 rounded-xl border border-white/5 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-accent" />
                  <span className="text-white/60">Balance:</span>
                  <span className="font-bold text-white">${user.balance}</span>
                </div>
                <div className="bg-black/40 px-4 py-2 rounded-xl border border-white/5 flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  <span className="text-white/60">Total Wins:</span>
                  <span className="font-bold text-white">{user.totalWins || 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card/40 backdrop-blur rounded-3xl border border-white/10 p-6"
            >
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <History className="w-5 h-5 text-primary" /> Recent Transactions
              </h3>
              
              <div className="space-y-4">
                {transactions?.slice(0, 5).map(t => (
                  <div key={t.id} className="flex justify-between items-center p-3 bg-black/40 rounded-xl border border-white/5">
                    <div>
                      <p className="text-white font-medium capitalize">{t.type}</p>
                      <p className="text-xs text-white/50">{format(new Date(t.createdAt), "MMM d, yyyy HH:mm")}</p>
                    </div>
                    <div className={`font-bold ${t.type === 'deposit' || t.type === 'prize' ? 'text-green-400' : 'text-red-400'}`}>
                      {t.type === 'deposit' || t.type === 'prize' ? '+' : '-'}${t.amount}
                    </div>
                  </div>
                ))}
                {(!transactions || transactions.length === 0) && (
                  <p className="text-white/40 text-center py-4">No transactions found</p>
                )}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card/40 backdrop-blur rounded-3xl border border-white/10 p-6"
            >
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" /> Recent Cards
              </h3>
              
              <div className="space-y-4">
                {cards?.slice(0, 5).map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-black/40 rounded-xl border border-white/5">
                    <div>
                      <p className="text-white font-medium">Card #{c.id}</p>
                      <p className="text-xs text-white/50">Game #{c.gameId}</p>
                    </div>
                    {c.isWinner && (
                      <div className="text-xs font-bold text-black bg-accent px-2 py-1 rounded-full uppercase">Winner</div>
                    )}
                  </div>
                ))}
                {(!cards || cards.length === 0) && (
                  <p className="text-white/40 text-center py-4">No cards purchased</p>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
