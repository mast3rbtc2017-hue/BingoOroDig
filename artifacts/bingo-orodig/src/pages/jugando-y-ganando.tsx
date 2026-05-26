import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function JugandoGanandoSplash() {
  const [, setLocation] = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const playPromise = v.play();
    if (playPromise) {
      playPromise.catch(() => {
        // Some browsers block autoplay unless muted/gesture.
      });
    }
  }, []);

  const goToRifas = () => setLocation("/rifas");

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl overflow-hidden border border-white/10 bg-black/70">
        <video
          ref={videoRef}
          className="w-full aspect-[9/16] bg-black"
          src="/Juega.mp4"
          autoPlay
          muted
          playsInline
          controls
          onEnded={goToRifas}
          onError={() => setVideoError(true)}
        />
        <div className="p-4 space-y-3">
          <p className="text-white/80 text-sm text-center">
            {videoError
              ? "No se encontró el video Juega.mp4."
              : "Al terminar el video entrarás automáticamente."}
          </p>
          {videoError && (
            <p className="text-white/50 text-xs text-center">
              Coloca el archivo en `artifacts/bingo-orodig/public/Juega.mp4`
            </p>
          )}
          <Button
            type="button"
            className="w-full bg-gradient-to-r from-primary to-accent text-black font-bold"
            onClick={goToRifas}
          >
            Entrar ahora
          </Button>
        </div>
      </div>
    </div>
  );
}
