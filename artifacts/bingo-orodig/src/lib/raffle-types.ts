export type RaffleStatus = "draft" | "open" | "closed" | "drawn" | "cancelled";

export type Raffle = {
  id: number;
  title: string;
  description: string | null;
  prizeTitle: string;
  prizeDescription: string | null;
  imageUrl: string | null;
  rules: string | null;
  status: RaffleStatus;
  ticketPrice: number;
  totalNumbers: number;
  soldCount: number;
  scheduledDrawAt: string | null;
  scheduledDrawAtLabel: string | null;
  timezone: string;
  drawnAt: string | null;
  winningNumber: number | null;
  winnerUserId: number | null;
  winnerUsername: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RaffleDetail = Raffle & {
  soldNumbers: number[];
  availableCount: number;
};
