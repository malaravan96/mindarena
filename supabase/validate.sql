-- ============================================
-- VALIDATION SCRIPT FOR MINDARENA DATABASE
-- ============================================
-- Run this in Supabase SQL Editor to verify your setup

-- 1. Check all tables exist
SELECT 
  'Tables Check' as check_type,
  COUNT(*) as found,
  3 as expected,
  CASE WHEN COUNT(*) = 3 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('profiles', 'puzzles', 'attempts');

-- 2. Check RLS is enabled on all tables
SELECT 
  'RLS Enabled' as check_type,
  COUNT(*) as found,
  3 as expected,
  CASE WHEN COUNT(*) = 3 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = true
  AND tablename IN ('profiles', 'puzzles', 'attempts');

-- 3. Check trigger exists
SELECT 
  'Trigger Exists' as check_type,
  COUNT(*) as found,
  1 as expected,
  CASE WHEN COUNT(*) >= 1 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 4. Check function exists
SELECT 
  'Function Exists' as check_type,
  COUNT(*) as found,
  1 as expected,
  CASE WHEN COUNT(*) >= 1 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user'
  AND routine_schema = 'public';

-- 5. Check indexes exist
SELECT 
  'Indexes Created' as check_type,
  COUNT(*) as found,
  4 as expected,
  CASE WHEN COUNT(*) >= 4 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM pg_indexes 
WHERE schemaname = 'public'
  AND indexname IN (
    'attempts_puzzle_correct_time_idx',
    'attempts_user_id_idx',
    'attempts_created_at_idx',
    'attempts_user_id_puzzle_id_key'
  );

-- 6. Check if puzzles exist
SELECT 
  'Puzzles Seeded' as check_type,
  COUNT(*) as found,
  'N/A' as expected,
  CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '⚠️ WARNING: No puzzles found' END as status
FROM public.puzzles;

-- 7. List all RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  '✅' as status
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 8. Show all puzzles with dates
SELECT 
  date_key,
  title,
  type,
  CASE 
    WHEN date_key = to_char(CURRENT_DATE, 'YYYY-MM-DD') THEN '📅 TODAY'
    WHEN date_key > to_char(CURRENT_DATE, 'YYYY-MM-DD') THEN '⏭️ FUTURE'
    ELSE '⏮️ PAST'
  END as timing
FROM public.puzzles
ORDER BY date_key;

-- 9. Check unique constraint on attempts
SELECT 
  'Unique Constraint' as check_type,
  COUNT(*) as found,
  1 as expected,
  CASE WHEN COUNT(*) >= 1 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.table_constraints
WHERE table_name = 'attempts'
  AND constraint_type = 'UNIQUE';

-- ============================================
-- SUMMARY
-- ============================================
-- All checks should show ✅ PASS
-- If any show ❌ FAIL, review the SETUP.md file
-- ⚠️ WARNING for no puzzles means you need to run seed.sql
