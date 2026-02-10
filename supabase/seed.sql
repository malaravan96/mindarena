-- Seed puzzles for testing
-- Replace the date_key with the current date in YYYY-MM-DD format

-- Today's puzzle (2026-02-10)
insert into public.puzzles(date_key, title, prompt, type, options, answer_index)
values (
  '2026-02-10',
  'Pattern Recognition',
  'What comes next in the sequence? 3, 6, 12, 24, ?',
  'pattern',
  array['27', '36', '48', '60'],
  2
) on conflict (date_key) do nothing;

-- Tomorrow's puzzle (2026-02-11)
insert into public.puzzles(date_key, title, prompt, type, options, answer_index)
values (
  '2026-02-11',
  'Logic Challenge',
  'If all Bloops are Razzies and all Razzies are Lazzies, are all Bloops definitely Lazzies?',
  'logic',
  array['Yes', 'No', 'Cannot be determined', 'Only sometimes'],
  0
) on conflict (date_key) do nothing;

-- Day after tomorrow (2026-02-12)
insert into public.puzzles(date_key, title, prompt, type, options, answer_index)
values (
  '2026-02-12',
  'Quick Math',
  'Solve: (15 × 4) - (20 ÷ 5) = ?',
  'math',
  array['52', '56', '60', '64'],
  1
) on conflict (date_key) do nothing;
