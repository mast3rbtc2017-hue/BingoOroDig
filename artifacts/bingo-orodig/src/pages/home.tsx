import { Link } from "wouter";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { formatCOP } from "@/lib/currency";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { resumeAudio } from "@/lib/sounds";
import logo from "@assets/image_1779437502396.png";
import { CreditCard, Radio, Trophy, Zap } from "lucide-react";

const HOW_TO_PLAY = [
  { icon: CreditCard, title: "1. Compra tu cartón", desc: "Elige una sala y compra uno o más cartones. Cada sala tiene su propio precio y premio.", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { icon: Radio, title: "2. Espera el sorteo", desc: "El admin inicia el sorteo. Las bolas se van sorteando y tus números se marcan automáticamente.", color: "text-green-400 bg-green-500/10 border-green-500/20" },
  { icon: Zap, title: "3. Canta ¡Bingo!", desc: "Completa el patrón requerido (línea, esquinas, X, etc.) y presiona ¡BINGO! para ganar.", color: "text-primary bg-primary/10 border-primary/20" },
  { icon: Trophy, title: "4. Cobra tu premio", desc: "El premio se acredita al instante en tu saldo virtual. ¡Retíralo o úsalo en próximas partidas!", color: "text-accent bg-accent/10 border-accent/20" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground overflow-x-hidden" onClick={resumeAudio}>
      <Navbar />

      <main className="flex-1 pb-20 md:pb-0">
        {/* Hero */}
        <section className="relative pt-16 pb-16 lg:pt-28 lg:pb-24 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background z-0" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center">

              <motion.div
                animate={{ y: [0, -18, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                className="flex justify-center mb-6"
              >
                <img src={logo} alt="Bingo OroDig" className="w-28 h-28 md:w-40 md:h-40 object-contain drop-shadow-[0_0_40px_rgba(212,175,55,0.6)]" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
                className="text-4xl sm:text-5xl md:text-7xl font-serif font-bold text-white mb-4 md:mb-6 tracking-tight leading-tight"
              >
                Vive el Bingo{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                  Virtual Premium
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
                className="text-base sm:text-lg md:text-xl text-white/60 mb-8 font-light px-2"
              >
                Salas exclusivas, premios masivos y atmósfera dorada de casino — ¡en tu bolsillo!
              </motion.p>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.4 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-3"
              >
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto h-12 md:h-14 px-8 md:px-10 text-base md:text-lg bg-gradient-to-r from-primary to-accent text-black font-bold hover:scale-105 transition-transform shadow-[0_0_30px_rgba(212,175,55,0.3)]">
                    Únete a la Acción
                  </Button>
                </Link>
                <Link href="/lobby">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 md:h-14 px-8 md:px-10 text-base md:text-lg border-primary/50 text-primary hover:bg-primary/10">
                    Ver Salas
                  </Button>
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Stats bar */}
        <section className="py-10 md:py-16 border-y border-white/5 bg-black/40">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-3 gap-3 md:gap-8">
              {[
                { label: "Jugadores", value: "2.400+", delay: 0 },
                { label: "Premios Diarios", value: formatCOP(45_000_000), delay: 0.15 },
                { label: "Salas en Vivo", value: "12", delay: 0.3 }
              ].map((s, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ duration: 0.6, delay: s.delay }}
                  className="text-center p-4 md:p-8 rounded-xl md:rounded-2xl bg-white/[0.02] border border-white/10">
                  <div className="text-2xl sm:text-3xl md:text-5xl font-bold text-accent mb-1 md:mb-2">{s.value}</div>
                  <div className="text-white/50 font-medium uppercase tracking-wider text-[10px] sm:text-xs md:text-sm">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How to play */}
        <section className="py-14 md:py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10 md:mb-14">
              <h2 className="text-2xl md:text-4xl font-serif font-bold text-white mb-3">¿Cómo se juega?</h2>
              <p className="text-white/50 text-sm md:text-base">En 4 simples pasos estás ganando</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto">
              {HOW_TO_PLAY.map((step, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
                  className={`${step.color} border rounded-2xl p-5 md:p-6 flex flex-col gap-3`}>
                  <step.icon className="w-8 h-8" />
                  <h3 className="font-bold text-white text-base md:text-lg leading-tight">{step.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 md:py-16 bg-gradient-to-r from-primary/10 via-black/60 to-accent/10 border-t border-white/5">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">¿Listo para ganar?</h2>
            <p className="text-white/50 mb-6 text-sm md:text-base">Regístrate gratis y recibe saldo inicial para comenzar</p>
            <Link href="/register">
              <Button className="bg-gradient-to-r from-primary to-accent text-black font-bold h-12 px-10 text-base hover:scale-105 transition-transform">
                Crear Cuenta Gratis
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <MobileNav />
    </div>
  );
}
