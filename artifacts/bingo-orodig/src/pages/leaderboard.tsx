import { useGetLeaderboard } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { motion } from "framer-motion";
import { Trophy, Medal, Star } from "lucide-react";

export default function Leaderboard() {
  const { data: entries, isLoading } = useGetLeaderboard({
    query: { queryKey: ["/api/stats/leaderboard"] }
  });

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground relative overflow-hidden">
      <Navbar />
      
      {/* Background Decor */}
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-primary/10 blur-[150px] rounded-full pointer-events-none" />

      <main className="flex-1 container mx-auto px-4 py-12 relative z-10">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent mb-4">Hall of Fame</h1>
          <p className="text-white/60 max-w-lg mx-auto">The most successful players in OroDig history.</p>
        </div>

        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-20 bg-card/50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {entries?.map((entry, i) => (
                <motion.div
                  key={entry.userId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className={`
                    relative flex items-center gap-6 p-4 md:p-6 rounded-2xl backdrop-blur
                    ${i === 0 ? 'bg-gradient-to-r from-primary/20 to-accent/5 border border-primary/50 shadow-[0_0_30px_rgba(212,175,55,0.2)]' : 
                      i === 1 ? 'bg-white/[0.03] border border-white/20' : 
                      i === 2 ? 'bg-white/[0.02] border border-white/10' : 
                      'bg-black/40 border border-white/5'}
                  `}
                >
                  <div className={`
                    w-12 h-12 flex items-center justify-center font-black text-xl rounded-full shrink-0
                    ${i === 0 ? 'bg-gradient-to-br from-primary to-accent text-black shadow-lg shadow-primary/50' : 
                      i === 1 ? 'bg-slate-300 text-black shadow-lg' : 
                      i === 2 ? 'bg-orange-400/80 text-black shadow-lg' : 
                      'bg-black text-white/40 border border-white/10'}
                  `}>
                    {i === 0 ? <Trophy className="w-6 h-6" /> : 
                     i === 1 ? <Medal className="w-6 h-6" /> : 
                     i === 2 ? <Star className="w-6 h-6" /> : 
                     entry.rank}
                  </div>
                  
                  <div className="flex-1 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-black/60 border-2 border-white/10 overflow-hidden hidden sm:flex shrink-0">
                      {entry.avatarUrl ? (
                        <img src={entry.avatarUrl} alt={entry.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-primary uppercase font-bold text-lg">
                          {entry.username.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{entry.displayName || entry.username}</h3>
                      <p className="text-white/50 text-sm">{entry.totalWins} Wins</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm text-white/50 uppercase tracking-wider mb-1">Total Prize</p>
                    <p className={`text-2xl font-black ${i === 0 ? 'text-accent' : 'text-white'}`}>
                      ${entry.totalPrize.toLocaleString()}
                    </p>
                  </div>
                </motion.div>
              ))}
              
              {entries?.length === 0 && (
                <div className="text-center py-20 text-white/40">
                  No winners yet. Be the first!
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
