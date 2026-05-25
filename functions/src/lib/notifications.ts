import { db, FieldValue, Timestamp } from "./firestore";
import { nextId } from "./firestore";

export type NotificationType = "bingo_approved" | "bingo_rejected" | "game_finished";

export async function notifyUser(
  userUid: string,
  payload: {
    type: NotificationType;
    title: string;
    message: string;
    gameId?: number;
    roomId?: number;
    amount?: number;
  },
): Promise<void> {
  const id = await nextId("notifications");
  await db
    .collection("users")
    .doc(userUid)
    .collection("notifications")
    .doc(String(id))
    .set({
      id,
      ...payload,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
}

export function serializeNotification(d: Record<string, unknown>) {
  return {
    id: d.id,
    type: d.type,
    title: d.title,
    message: d.message,
    gameId: d.gameId ?? null,
    roomId: d.roomId ?? null,
    amount: d.amount ?? null,
    read: d.read === true,
    createdAt:
      d.createdAt instanceof Timestamp
        ? d.createdAt.toDate().toISOString()
        : d.createdAt,
  };
}
