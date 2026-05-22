import { useListRooms } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Coins, Timer } from "lucide-react";

export default function Lobby() {
  const { data: rooms, isLoading } = useListRooms({
    query: {
      queryKey: ["/api/rooms"]
    }
  });

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground relative">
      <Navbar />
      
      {/* Background Decor */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background z-0 pointer-events-none" />

      <main className="flex-1 container mx-auto px-4 py-12 relative z-10">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-serif font-bold text-white mb-2">Bingo Lobby</h1>
            <p className="text-white/60">Choose your room and start playing</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-card/50 border border-white/5 rounded-2xl h-64 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms?.map((room, i) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="group relative bg-card/40 backdrop-blur-md border border-white/10 p-6 rounded-3xl hover:border-primary/50 transition-colors"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
                
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">{room.name}</h3>
                      <Badge variant="outline" className="text-primary border-primary/30 uppercase tracking-wider text-xs">
                        {room.type}
                      </Badge>
                    </div>
                    {room.status === 'playing' ? (
                      <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">In Progress</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">Open</Badge>
                    )}
                  </div>
                  
                  <p className="text-white/60 text-sm mb-6 flex-1">
                    {room.description || "A premium bingo experience."}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex flex-col bg-black/40 rounded-xl p-3 border border-white/5">
                      <span className="text-white/40 text-xs uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Coins className="w-3 h-3 text-primary" /> Prize
                      </span>
                      <span className="text-xl font-bold text-accent">${room.prize}</span>
                    </div>
                    <div className="flex flex-col bg-black/40 rounded-xl p-3 border border-white/5">
                      <span className="text-white/40 text-xs uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Users className="w-3 h-3 text-primary" /> Players
                      </span>
                      <span className="text-xl font-bold text-white">{room.playerCount || 0}/{room.maxPlayers}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <Timer className="w-4 h-4" />
                      <span>{room.ballInterval}s draws</span>
                    </div>
                    <Link href={`/room/${room.id}`}>
                      <Button className="bg-primary text-primary-foreground hover:bg-accent font-bold px-6">
                        Join Room
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        
        {rooms?.length === 0 && !isLoading && (
          <div className="text-center py-20">
            <h3 className="text-2xl text-white/60">No active rooms found</h3>
          </div>
        )}
      </main>
    </div>
  );
}
