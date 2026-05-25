import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiJson } from "@/lib/api-fetch";
import { useAuth } from "@/lib/auth";

export type AppNotification = {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  amount?: number | null;
  createdAt?: string;
};

export function useNotifications() {
  const { user } = useAuth();
  const seenRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);

  const query = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: () => apiJson<AppNotification[]>("/api/notifications", "GET"),
    enabled: !!user,
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (!query.data?.length) return;

    if (!initializedRef.current) {
      query.data.forEach((n) => seenRef.current.add(n.id));
      initializedRef.current = true;
      return;
    }

    for (const n of query.data) {
      if (seenRef.current.has(n.id) || n.read) continue;
      seenRef.current.add(n.id);
      if (n.type === "bingo_approved") {
        toast.success(n.title, { description: n.message, duration: 10000 });
      }
    }
  }, [query.data]);

  const unreadCount = query.data?.filter((n) => !n.read).length ?? 0;

  return { ...query, unreadCount };
}
