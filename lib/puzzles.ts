export type PuzzleType = 'pattern' | 'logic' | 'math' | 'word' | 'memory' | 'visual' | 'spatial' | 'trivia';

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
  {
    id: 'offline-4',
    date_key: 'offline',
    title: 'Word Scramble',
    prompt: 'Unscramble the letters to form a word: "NEBRAI"',
    type: 'word',
    options: ['BRAIN', 'BRINE', 'REIGN', 'LINER'],
    answer_index: 0,
  },
  {
    id: 'offline-5',
    date_key: 'offline',
    title: 'Memory Sequence',
    prompt: 'A sequence was shown: Red, Blue, Green, Yellow, Red. What was the 3rd color?',
    type: 'memory',
    options: ['Red', 'Blue', 'Green', 'Yellow'],
    answer_index: 2,
  },
  {
    id: 'offline-6',
    date_key: 'offline',
    title: 'Odd One Out',
    prompt: 'Four shapes are shown: Circle, Circle, Circle, Square. Which one does not belong?',
    type: 'visual',
    options: ['Shape 1', 'Shape 2', 'Shape 3', 'Shape 4'],
    answer_index: 3,
  },
  {
    id: 'offline-7',
    date_key: 'offline',
    title: 'Mental Rotation',
    prompt: 'If you rotate the letter "b" 180° clockwise, which letter do you get?',
    type: 'spatial',
    options: ['d', 'p', 'q', 'b'],
    answer_index: 0,
  },
  {
    id: 'offline-8',
    date_key: 'offline',
    title: 'Brain Trivia',
    prompt: 'Which part of the brain is primarily responsible for memory?',
    type: 'trivia',
    options: ['Cerebellum', 'Hippocampus', 'Brain Stem', 'Frontal Lobe'],
    answer_index: 1,
  },
];
