export type ShapeCell = {
  x: number;
  y: number;
};

export type ShapePiece = {
  id: string;
  color: string;
  cells: ShapeCell[];
};

export type PiecesShapeLevel = {
  levelKey: string;
  title: string;
  boardSize: number;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  points: number;
  xp: number;
  pieces: ShapePiece[];
};

export const piecesShapeLevels: PiecesShapeLevel[] = [
  {
    levelKey: 'starter-square',
    title: 'Starter Square',
    boardSize: 4,
    difficulty: 'easy',
    description: 'Four chunky pieces introduce the drag-and-fill rhythm.',
    points: 90,
    xp: 30,
    pieces: [
      { id: 'a', color: '#f97316', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
      { id: 'b', color: '#10b981', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] },
      { id: 'c', color: '#3b82f6', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }] },
      { id: 'd', color: '#ec4899', cells: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
    ],
  },
  {
    levelKey: 'split-corners',
    title: 'Split Corners',
    boardSize: 4,
    difficulty: 'easy',
    description: 'A tighter mix of long and angled pieces.',
    points: 110,
    xp: 36,
    pieces: [
      { id: 'a', color: '#8b5cf6', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }] },
      { id: 'b', color: '#f59e0b', cells: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
      { id: 'c', color: '#22c55e', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
      { id: 'd', color: '#0ea5e9', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] },
      { id: 'e', color: '#ef4444', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    ],
  },
  {
    levelKey: 'five-star',
    title: 'Five Star Fit',
    boardSize: 5,
    difficulty: 'medium',
    description: 'Large pentomino pieces fill the whole board in broad strokes.',
    points: 135,
    xp: 46,
    pieces: [
      { id: 'a', color: '#06b6d4', cells: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }] },
      { id: 'b', color: '#f97316', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 3 }] },
      { id: 'c', color: '#84cc16', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 2 }] },
      { id: 'd', color: '#a855f7', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }] },
      { id: 'e', color: '#ef4444', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }] },
    ],
  },
  {
    levelKey: 'mosaic-pack',
    title: 'Mosaic Pack',
    boardSize: 5,
    difficulty: 'medium',
    description: 'More pieces means more edge matching and fewer obvious gaps.',
    points: 155,
    xp: 54,
    pieces: [
      { id: 'a', color: '#3b82f6', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }] },
      { id: 'b', color: '#f43f5e', cells: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
      { id: 'c', color: '#14b8a6', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
      { id: 'd', color: '#eab308', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
      { id: 'e', color: '#22c55e', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
      { id: 'f', color: '#8b5cf6', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
      { id: 'g', color: '#f97316', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
      { id: 'h', color: '#64748b', cells: [{ x: 0, y: 0 }] },
    ],
  },
  {
    levelKey: 'dense-grid',
    title: 'Dense Grid',
    boardSize: 6,
    difficulty: 'hard',
    description: 'Nine tetromino-style pieces create a fuller board with less breathing room.',
    points: 180,
    xp: 64,
    pieces: [
      { id: 'a', color: '#ef4444', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] },
      { id: 'b', color: '#f59e0b', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }] },
      { id: 'c', color: '#84cc16', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }] },
      { id: 'd', color: '#14b8a6', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
      { id: 'e', color: '#3b82f6', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
      { id: 'f', color: '#8b5cf6', cells: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
      { id: 'g', color: '#ec4899', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
      { id: 'h', color: '#0ea5e9', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }] },
      { id: 'i', color: '#f97316', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }] },
    ],
  },
  {
    levelKey: 'expert-mix',
    title: 'Expert Mix',
    boardSize: 6,
    difficulty: 'hard',
    description: 'A mixed set rewards careful gap-reading and efficient placement.',
    points: 210,
    xp: 76,
    pieces: [
      { id: 'a', color: '#2563eb', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }] },
      { id: 'b', color: '#dc2626', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 3 }] },
      { id: 'c', color: '#16a34a', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
      { id: 'd', color: '#9333ea', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
      { id: 'e', color: '#f97316', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
      { id: 'f', color: '#06b6d4', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
      { id: 'g', color: '#f59e0b', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] },
      { id: 'h', color: '#14b8a6', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
      { id: 'i', color: '#64748b', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
      { id: 'j', color: '#e11d48', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    ],
  },
];

export function getPiecesShapeLevel(levelKey: string) {
  return piecesShapeLevels.find((level) => level.levelKey === levelKey) ?? null;
}

export function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
