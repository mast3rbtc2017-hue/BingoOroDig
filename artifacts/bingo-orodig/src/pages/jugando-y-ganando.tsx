import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

/** Archivo en `public/Juega.mp4` (se sirve como /Juega.mp4 en hosting) */
const VIDEO_SRC = "/Juega.mp4";

function prepareVideoForAutoplay(v: HTMLVideoElement) {
  v.muted = true;
  v.defaultMuted = true;
  v.volume = 0;
  v.playsInline = true;
  v.setAttribute("playsinline", "");
  v.setAttribute("webkit-playsinline", "");
}

export default function JugandoGanandoSplash() {
  const [, setLocation] = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playingRef = useRef(false);
  const [videoError, setVideoError] = useState(false);

  const goToRifas = useCallback(() => setLocation("/rifas"), [setLocation]);

  const tryPlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v || playingRef.current) return;
    prepareVideoForAutoplay(v);
    try {
      await v.play();
      playingRef.current = true;
    } catch {
      // Reintentos silenciosos; el navegador suele permitir muted autoplay tras cargar datos.
    }
  }, []);

  const bindVideo = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (!node) return;
      prepareVideoForAutoplay(node);
      void node.play().catch(() => undefined);
    },
    [],
  );

  useLayoutEffect(() => {
    void tryPlay();
  }, [tryPlay]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const events = ["loadedmetadata", "loadeddata", "canplay", "canplaythrough"] as const;
    const onReady = () => void tryPlay();

    events.forEach((e) => v.addEventListener(e, onReady));
    const retry = window.setInterval(() => void tryPlay(), 400);
    const stopRetry = window.setTimeout(() => window.clearInterval(retry), 4000);

    const onVisible = () => {
      if (document.visibilityState === "visible") void tryPlay();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      events.forEach((e) => v.removeEventListener(e, onReady));
      window.clearInterval(retry);
      window.clearTimeout(stopRetry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tryPlay]);

  if (videoError) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black p-6 text-center">
        <p className="text-white/90 text-base max-w-md">
          No se pudo reproducir el video de introducción. Puedes continuar a la sección.
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
          ref={bindVideo}
          className="absolute inset-0 h-full w-full object-cover bg-black"
          src={VIDEO_SRC}
          autoPlay
          muted
          defaultMuted
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          onPlaying={() => {
            playingRef.current = true;
          }}
          onEnded={goToRifas}
          onError={() => setVideoError(true)}
        />
      </div>
    </>
  );
}
