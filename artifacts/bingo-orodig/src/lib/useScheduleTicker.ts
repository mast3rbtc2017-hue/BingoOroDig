import { useEffect } from "react";
import { apiJson } from "./api-fetch";

/** Pide al servidor que inicie sorteos programados cuya hora ya pasó. */
export function useScheduleTicker(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      void apiJson<{ started: number }>("/api/games/tick-schedule", "POST").catch(() => {});
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => clearInterval(iv);
  }, [enabled]);
}
