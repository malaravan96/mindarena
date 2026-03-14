export type JigsawGridSize = 4 | 5;

export type JigsawArtworkShape = {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity?: number;
};

export type JigsawArtwork = {
  gradient: [string, string];
  accent: string;
  highlight: string;
  shapes: JigsawArtworkShape[];
};

export type BuiltInJigsawPuzzle = {
  puzzleKey: string;
  title: string;
  subtitle: string;
  artwork: JigsawArtwork;
};

export type JigsawReward = {
  points: number;
  xp: number;
};

export const JIGSAW_GRID_SIZES: JigsawGridSize[] = [4, 5];

export const builtInJigsawPuzzles: BuiltInJigsawPuzzle[] = [
  {
    puzzleKey: 'aurora-bloom',
    title: 'Aurora Bloom',
    subtitle: 'Soft petals and layered light',
    artwork: {
      gradient: ['#0ea5e9', '#8b5cf6'],
      accent: '#fef3c7',
      highlight: '#38bdf8',
      shapes: [
        { x: 0.12, y: 0.18, size: 0.2, color: '#fef08a', opacity: 0.85 },
        { x: 0.72, y: 0.16, size: 0.18, color: '#bfdbfe', opacity: 0.8 },
        { x: 0.58, y: 0.44, size: 0.26, color: '#f9a8d4', opacity: 0.7 },
        { x: 0.18, y: 0.62, size: 0.22, color: '#99f6e4', opacity: 0.72 },
        { x: 0.74, y: 0.72, size: 0.16, color: '#ffffff', opacity: 0.55 },
      ],
    },
  },
  {
    puzzleKey: 'sunset-hills',
    title: 'Sunset Hills',
    subtitle: 'Warm sky with bold contrast',
    artwork: {
      gradient: ['#f97316', '#ef4444'],
      accent: '#fde68a',
      highlight: '#fb7185',
      shapes: [
        { x: 0.16, y: 0.2, size: 0.18, color: '#fde68a', opacity: 0.95 },
        { x: 0.66, y: 0.3, size: 0.24, color: '#fdba74', opacity: 0.78 },
        { x: 0.28, y: 0.56, size: 0.28, color: '#7c2d12', opacity: 0.45 },
        { x: 0.7, y: 0.68, size: 0.2, color: '#431407', opacity: 0.38 },
      ],
    },
  },
  {
    puzzleKey: 'mint-garden',
    title: 'Mint Garden',
    subtitle: 'Fresh layers and playful circles',
    artwork: {
      gradient: ['#10b981', '#14b8a6'],
      accent: '#dcfce7',
      highlight: '#6ee7b7',
      shapes: [
        { x: 0.08, y: 0.24, size: 0.16, color: '#dcfce7', opacity: 0.9 },
        { x: 0.42, y: 0.14, size: 0.22, color: '#bbf7d0', opacity: 0.8 },
        { x: 0.68, y: 0.24, size: 0.18, color: '#99f6e4', opacity: 0.72 },
        { x: 0.18, y: 0.62, size: 0.24, color: '#14532d', opacity: 0.28 },
        { x: 0.6, y: 0.62, size: 0.3, color: '#064e3b', opacity: 0.28 },
      ],
    },
  },
  {
    puzzleKey: 'midnight-city',
    title: 'Midnight City',
    subtitle: 'Deep tones with neon pockets',
    artwork: {
      gradient: ['#1e293b', '#3b82f6'],
      accent: '#93c5fd',
      highlight: '#c084fc',
      shapes: [
        { x: 0.12, y: 0.16, size: 0.14, color: '#e0f2fe', opacity: 0.82 },
        { x: 0.58, y: 0.18, size: 0.2, color: '#c084fc', opacity: 0.56 },
        { x: 0.26, y: 0.44, size: 0.18, color: '#60a5fa', opacity: 0.62 },
        { x: 0.68, y: 0.54, size: 0.24, color: '#172554', opacity: 0.42 },
        { x: 0.14, y: 0.72, size: 0.22, color: '#0f172a', opacity: 0.48 },
      ],
    },
  },
  {
    puzzleKey: 'candy-burst',
    title: 'Candy Burst',
    subtitle: 'Bright contrast for fast scanning',
    artwork: {
      gradient: ['#ec4899', '#f59e0b'],
      accent: '#fce7f3',
      highlight: '#fcd34d',
      shapes: [
        { x: 0.1, y: 0.18, size: 0.18, color: '#ffffff', opacity: 0.84 },
        { x: 0.34, y: 0.38, size: 0.26, color: '#fb7185', opacity: 0.66 },
        { x: 0.68, y: 0.16, size: 0.18, color: '#fef3c7', opacity: 0.84 },
        { x: 0.62, y: 0.62, size: 0.28, color: '#be185d', opacity: 0.28 },
        { x: 0.18, y: 0.72, size: 0.22, color: '#f59e0b', opacity: 0.48 },
      ],
    },
  },
  {
    puzzleKey: 'polar-dawn',
    title: 'Polar Dawn',
    subtitle: 'Cool tones with crisp highlights',
    artwork: {
      gradient: ['#06b6d4', '#e0f2fe'],
      accent: '#ffffff',
      highlight: '#67e8f9',
      shapes: [
        { x: 0.14, y: 0.14, size: 0.16, color: '#ffffff', opacity: 0.94 },
        { x: 0.64, y: 0.12, size: 0.2, color: '#a5f3fc', opacity: 0.84 },
        { x: 0.34, y: 0.44, size: 0.24, color: '#cffafe', opacity: 0.82 },
        { x: 0.7, y: 0.56, size: 0.18, color: '#155e75', opacity: 0.28 },
        { x: 0.12, y: 0.68, size: 0.2, color: '#164e63', opacity: 0.26 },
      ],
    },
  },
];

export function getBuiltInJigsaw(puzzleKey: string) {
  return builtInJigsawPuzzles.find((puzzle) => puzzle.puzzleKey === puzzleKey) ?? null;
}

export function getJigsawReward(gridSize: JigsawGridSize): JigsawReward {
  if (gridSize === 5) {
    return { points: 220, xp: 90 };
  }
  return { points: 120, xp: 45 };
}

export function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
