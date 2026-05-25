import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "./api-fetch";
import { useAuth } from "./auth";

/** Dispara sorteos programados de rifas en el servidor */
export function useRaffleTicker(enabled: boolean) {
  const { user, firebaseSignedIn } = useAuth();

  useQuery({
    queryKey: ["/api/raffles/tick-schedule"],
    queryFn: () => apiJson<{ processed: number }>("/api/raffles/tick-schedule", "POST"),
    enabled: enabled && !!user && firebaseSignedIn,
    refetchInterval: 8000,
    retry: false,
  });
}
