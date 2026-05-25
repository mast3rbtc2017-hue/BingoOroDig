import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { firestore } from "./firebase";

export type DrawnBall = { number: number; letter: string };

export function useGameDrawnNumbers(gameId: number | null | undefined) {
  const [balls, setBalls] = useState<DrawnBall[]>([]);

  useEffect(() => {
    if (!gameId) {
      setBalls([]);
      return;
    }
    const q = query(
      collection(firestore, "games", String(gameId), "drawnNumbers"),
      orderBy("drawnAt"),
    );
    return onSnapshot(q, (snap) => {
      setBalls(
        snap.docs.map((d) => ({
          number: d.data().number as number,
          letter: d.data().letter as string,
        })),
      );
    });
  }, [gameId]);

  return balls;
}

/** Chat en vivo del sorteo (games/{gameId}/messages) */
export function useGameMessages(gameId: number | null | undefined) {
  const [messages, setMessages] = useState<unknown[]>([]);

  useEffect(() => {
    if (!gameId) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(firestore, "games", String(gameId), "messages"),
      orderBy("createdAt"),
    );
    return onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => ({
          id: d.data().id ?? d.id,
          gameId: d.data().gameId,
          userId: d.data().userId,
          username: d.data().username,
          avatarUrl: d.data().avatarUrl,
          content: d.data().content,
          type: d.data().type,
          createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() ?? d.data().createdAt,
        })),
      );
    });
  }, [gameId]);

  return messages;
}

/** @deprecated usar useGameMessages */
export const useRoomMessages = useGameMessages;

export function useGameBingoClaims(gameId: number | null | undefined) {
  const [claims, setClaims] = useState<unknown[]>([]);

  useEffect(() => {
    if (!gameId) {
      setClaims([]);
      return;
    }
    const q = query(
      collection(firestore, "games", String(gameId), "bingoClaims"),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(q, (snap) => {
      setClaims(
        snap.docs.map((d) => ({
          id: Number(d.id),
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() ?? d.data().createdAt,
        })),
      );
    });
  }, [gameId]);

  return claims;
}

export function useGameWinner(gameId: number | null | undefined) {
  const [winner, setWinner] = useState<unknown | null>(null);

  useEffect(() => {
    if (!gameId) {
      setWinner(null);
      return;
    }
    const q = collection(firestore, "games", String(gameId), "winners");
    return onSnapshot(q, (snap) => {
      if (snap.empty) {
        setWinner(null);
        return;
      }
      const latest = snap.docs[snap.docs.length - 1].data();
      setWinner({
        gameId: latest.gameId,
        userId: latest.userId,
        username: latest.username,
        cardId: latest.cardId,
        pattern: latest.pattern,
        prize: latest.prize,
      });
    });
  }, [gameId]);

  return winner;
}


export function useGameLive(gameId: number | null | undefined, onChange: () => void) {
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(firestore, "games", String(gameId)), onChange);
    return () => unsub();
  }, [gameId, onChange]);
}
