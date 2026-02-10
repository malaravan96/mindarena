export type PuzzleType = 'pattern' | 'logic' | 'math';

export type Puzzle = {
  id: string;
  date_key: string; // YYYY-MM-DD
  title: string;
  prompt: string;
  type: PuzzleType;
  options: string[];
  answer_index: number;
};

export const offlinePuzzles: Puzzle[] = [
  {
    id: 'offline-1',
    date_key: 'offline',
    title: 'Pattern',
    prompt: 'What comes next? 2, 4, 8, 16, ?',
    type: 'pattern',
    options: ['18', '24', '32', '36'],
    answer_index: 2,
  },
  {
    id: 'offline-2',
    date_key: 'offline',
    title: 'Logic',
    prompt: 'If ALL bloops are razzies and ALL razzies are lazzies, are ALL bloops definitely lazzies?',
    type: 'logic',
    options: ['Yes', 'No', 'Cannot be determined', 'Only sometimes'],
    answer_index: 0,
  },
  {
    id: 'offline-3',
    date_key: 'offline',
    title: 'Math',
    prompt: 'Solve: (12 × 3) − (8 ÷ 2) = ?',
    type: 'math',
    options: ['32', '34', '36', '40'],
    answer_index: 1,
  },
];
