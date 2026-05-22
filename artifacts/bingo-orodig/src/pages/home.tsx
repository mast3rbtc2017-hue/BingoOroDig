import { Link } from "wouter";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import logo from "@assets/image_1779437502396.png";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground overflow-x-hidden">
      <Navbar />

      <main className="flex-1">
        <section className="relative pt-24 pb-24 lg:pt-36 lg:pb-32 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background z-0" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center">

              {/* Logo saltarín */}
              <motion.div
                animate={{ y: [0, -22, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                className="flex justify-center mb-6"
              >
                <img
                  src={logo}
                  alt="Bingo OroDig"
                  className="w-40 h-40 object-contain drop-shadow-[0_0_40px_rgba(212,175,55,0.6)]"
                />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="text-5xl md:text-7xl font-serif font-bold text-white mb-6 tracking-tight leading-tight"
              >
                Vive el Bingo <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Virtual Premium</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-lg md:text-2xl text-white/70 mb-10 font-light"
              >
                Entra a las salas de bingo más exclusivas. Premios masivos, acción en vivo y una espectacular atmósfera dorada de casino.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <Link href="/register">
                  <Button size="lg" className="h-14 px-10 text-lg bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold hover:scale-105 transition-transform shadow-[0_0_30px_rgba(212,175,55,0.3)]">
                    Únete a la Acción
                  </Button>
                </Link>
                <Link href="/lobby">
                  <Button size="lg" variant="outline" className="h-14 px-10 text-lg border-primary/50 text-primary hover:bg-primary/10">
                    Ver Lobby
                  </Button>
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-20 border-y border-white/5 bg-black/40">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { label: "Jugadores Activos", value: "2.400+", delay: 0 },
                { label: "Premios Diarios", value: "$45.000", delay: 0.2 },
                { label: "Salas en Vivo", value: "12", delay: 0.4 }
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: stat.delay }}
                  className="text-center p-8 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-sm"
                >
                  <div className="text-4xl md:text-5xl font-bold text-accent mb-2">{stat.value}</div>
                  <div className="text-white/60 font-medium uppercase tracking-wider text-sm">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
