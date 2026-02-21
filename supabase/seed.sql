-- Seed puzzles for testing/current production dates.
-- Run this in Supabase SQL Editor.

-- Ensure database accepts all app puzzle categories.
alter table public.puzzles
  drop constraint if exists puzzles_type_check;

alter table public.puzzles
  add constraint puzzles_type_check
  check (
    type in (
      'logic',
      'pattern',
      'math',
      'reasoning',
      'word',
      'memory',
      'visual',
      'spatial',
      'trivia'
    )
  );

insert into public.puzzles (date_key, title, prompt, type, options, answer_index, difficulty, points)
values
  (
    '2026-02-21',
    'Growing Gaps',
    'What comes next in the sequence? 2, 6, 12, 20, ?',
    'pattern',
    array['28', '30', '32', '34'],
    1,
    'easy',
    100
  ),
  (
    '2026-02-22',
    'Set Logic',
    'All Zorps are Kems. Some Kems are Dars. Can we conclude that some Zorps are Dars?',
    'logic',
    array['Yes', 'No', 'Cannot be determined', 'Only if all Kems are Zorps'],
    2,
    'medium',
    120
  ),
  (
    '2026-02-23',
    'Mental Arithmetic',
    'Solve: (18 / 3) + (7 * 4) = ?',
    'math',
    array['30', '32', '34', '36'],
    2,
    'easy',
    100
  ),
  (
    '2026-02-24',
    'Word Sense',
    'Choose the closest synonym for "scarce".',
    'word',
    array['Plentiful', 'Rare', 'Simple', 'Obvious'],
    1,
    'easy',
    100
  ),
  (
    '2026-02-25',
    'Sequence Recall',
    'You see this sequence once: 9, 1, 4, 7, 2. What was the 4th number?',
    'memory',
    array['1', '4', '7', '2'],
    2,
    'medium',
    120
  ),
  (
    '2026-02-26',
    'Odd Shape',
    'Which option is not a polygon?',
    'visual',
    array['Triangle', 'Square', 'Pentagon', 'Circle'],
    3,
    'easy',
    100
  ),
  (
    '2026-02-27',
    'Direction Turn',
    'An arrow points north. Rotate it 90 degrees clockwise. Where does it point?',
    'spatial',
    array['North', 'East', 'South', 'West'],
    1,
    'easy',
    100
  ),
  (
    '2026-02-28',
    'Brain Fact',
    'Which brain structure is most associated with forming new memories?',
    'trivia',
    array['Cerebellum', 'Hippocampus', 'Medulla', 'Occipital lobe'],
    1,
    'medium',
    120
  ),
  (
    '2026-03-01',
    'Conditional Reasoning',
    'Every pilot is trained. No untrained person can fly. Can an untrained person be a pilot?',
    'reasoning',
    array['Yes', 'No', 'Only in emergencies', 'Cannot be determined'],
    1,
    'medium',
    130
  ),
  (
    '2026-03-02',
    'Square Pattern',
    'Find the next number: 1, 4, 9, 16, ?',
    'pattern',
    array['20', '24', '25', '27'],
    2,
    'easy',
    100
  ),
  (
    '2026-03-03',
    'Order Logic',
    'If A is taller than B, B is taller than C, and C is taller than D, who is tallest?',
    'logic',
    array['A', 'B', 'C', 'D'],
    0,
    'easy',
    100
  ),
  (
    '2026-03-04',
    'Percent Quickie',
    'What is 40% of 90?',
    'math',
    array['32', '34', '36', '38'],
    2,
    'easy',
    100
  ),
  (
    '2026-03-05',
    'Analogy',
    'Book is to reading as fork is to ____.',
    'word',
    array['writing', 'eating', 'drawing', 'sleeping'],
    1,
    'easy',
    100
  ),
  (
    '2026-03-06',
    'Color Recall',
    'Remember this order: Blue, Red, Green, Blue, Yellow. Which color came right after Green?',
    'memory',
    array['Red', 'Blue', 'Yellow', 'Green'],
    1,
    'medium',
    120
  )
on conflict (date_key) do update
set
  title = excluded.title,
  prompt = excluded.prompt,
  type = excluded.type,
  options = excluded.options,
  answer_index = excluded.answer_index,
  difficulty = excluded.difficulty,
  points = excluded.points;
