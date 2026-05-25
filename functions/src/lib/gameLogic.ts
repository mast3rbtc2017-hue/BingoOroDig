import { db, FieldValue, Timestamp } from "./firestore";
import { getBingoLetter } from "./bingo";
import { stopAutoTimer } from "./autoDraw";

export function serializeDrawn(d: Record<string, unknown>) {
  return {
    id: d.id,
    gameId: d.gameId,
    number: d.number,
    letter: d.letter,
    drawnAt:
      d.drawnAt instanceof Timestamp
        ? d.drawnAt.toDate().toISOString()
        : d.drawnAt,
  };
}

export async function drawBallForGame(gameId: number) {
  const gameRef = db.collection("games").doc(String(gameId));
  const gameSnap = await gameRef.get();
  if (!gameSnap.exists) {
    stopAutoTimer(gameId);
    return null;
  }
  const game = gameSnap.data()!;
  if (game.status !== "playing") {
    stopAutoTimer(gameId);
    return null;
  }

  const drawnSnap = await gameRef.collection("drawnNumbers").get();
  const drawnSet = new Set(drawnSnap.docs.map((d) => d.data().number as number));
  const allNums = Array.from({ length: 75 }, (_, i) => i + 1).filter((n) => !drawnSet.has(n));
  if (allNums.length === 0) {
    stopAutoTimer(gameId);
    await gameRef.update({
      status: "paused",
      allBallsDrawn: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return null;
  }

  const number = allNums[Math.floor(Math.random() * allNums.length)];
  const letter = getBingoLetter(number);
  const drawnRef = gameRef.collection("drawnNumbers").doc();
  const drawnAt = Timestamp.now();

  await drawnRef.set({
    id: Number(drawnRef.id.slice(0, 8).replace(/\D/g, "") || Date.now() % 1000000),
    gameId,
    number,
    letter,
    drawnAt,
  });

  const cardsSnap = await db.collection("cards").where("gameId", "==", gameId).get();
  const batch = db.batch();
  for (const cardDoc of cardsSnap.docs) {
    const card = cardDoc.data();
    const grid: number[][] = JSON.parse(card.numbers);
    if (grid.flat().includes(number)) {
      const marked: number[] = JSON.parse(card.markedNumbers || "[]");
      if (!marked.includes(number)) {
        marked.push(number);
        batch.update(cardDoc.ref, { markedNumbers: JSON.stringify(marked) });
      }
    }
  }
  await batch.commit();

  await gameRef.update({
    lastBallNumber: number,
    lastBallLetter: letter,
    lastBallAt: drawnAt,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return serializeDrawn({
    id: drawnRef.id,
    gameId,
    number,
    letter,
    drawnAt,
  });
}
