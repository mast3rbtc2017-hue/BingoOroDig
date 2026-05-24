import { useEffect, useState } from "react";

export type CountdownState = {
  label: string;
  isPast: boolean;
  totalSeconds: number;
};

function formatCountdown(ms: number): CountdownState {
  if (ms <= 0) {
    return { label: "¡Iniciando sorteo!", isPast: true, totalSeconds: 0 };
  }
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) {
    return { label: `${h}:${pad(m)}:${pad(s)}`, isPast: false, totalSeconds };
  }
  return { label: `${pad(m)}:${pad(s)}`, isPast: false, totalSeconds };
}

export function useCountdown(targetIso: string | null | undefined): CountdownState | null {
  const [state, setState] = useState<CountdownState | null>(null);

  useEffect(() => {
    if (!targetIso) {
      setState(null);
      return;
    }
    const targetMs = new Date(targetIso).getTime();
    if (Number.isNaN(targetMs)) {
      setState(null);
      return;
    }
    const tick = () => setState(formatCountdown(targetMs - Date.now()));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [targetIso]);

  return state;
}

export function formatScheduledLocal(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
