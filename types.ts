
export type GameStatus = 'waiting' | 'starting' | 'playing' | 'finished';

export interface Player {
  uid: string;
  name: string;
  photoURL: string;
  progress: number;
  isReady: boolean;
  score: number;
  horseColor: string;
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  status: GameStatus;
  players: Record<string, Player>;
  winnerId?: string;
  createdAt: number;
}
