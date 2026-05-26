import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

/** Archivo en `public/Juega.mp4` (se sirve como /Juega.mp4 en hosting) */
const VIDEO_SRC = "/Juega.mp4";

export default function JugandoGanandoSplash() {
  const [, setLocation] = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);

  const goToRifas = useCallback(() => setLocation("/rifas"), [setLocation]);

  const tryPlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.muted = true;
      await v.play();
      setNeedsTap(false);
    } catch {
      setNeedsTap(true);
    }
  }, []);

  useEffect(() => {
    void tryPlay();
  }, [tryPlay]);

  const handleLoaded = () => {
    void tryPlay();
  };

  const handleTapToPlay = () => {
    void tryPlay();
  };

  if (videoError) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black p-6 text-center">
        <p className="text-white/90 text-base max-w-md">
          No se pudo cargar el video. Asegúrate de tener el archivo{" "}
          <span className="text-primary font-mono text-sm">Juega.mp4</span> en la carpeta{" "}
          <span className="text-white/60 text-xs">artifacts/bingo-orodig/public/</span>
        </p>
        <Button
          type="button"
          className="bg-gradient-to-r from-primary to-accent text-black font-bold"
          onClick={goToRifas}
        >
          Ir a Jugando y Ganando
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Oculta cualquier control nativo residual en WebKit */}
      <style>{`
        .jugando-splash-root video::-webkit-media-controls { display: none !important; }
        .jugando-splash-root video::-webkit-media-controls-enclosure { display: none !important; }
      `}</style>

      <div className="jugando-splash-root fixed inset-0 z-[100] bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover bg-black"
          src={VIDEO_SRC}
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          onLoadedData={handleLoaded}
          onCanPlay={handleLoaded}
          onEnded={goToRifas}
          onError={() => setVideoError(true)}
        />

        {needsTap && (
          <button
            type="button"
            className="absolute inset-0 z-[1] flex items-center justify-center bg-black/40 text-white/90 text-lg font-medium"
            onClick={handleTapToPlay}
          >
            Toca la pantalla para reproducir
          </button>
        )}
      </div>
    </>
  );
}
