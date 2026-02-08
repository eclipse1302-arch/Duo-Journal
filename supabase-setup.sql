-- ============================================
-- Duo Journal - Supabase Setup
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '🌸',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Journal entries table
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 3. Partner requests table
CREATE TABLE IF NOT EXISTS partner_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'break_pending')),
  break_requester_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_requests ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, users manage own
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Journal entries: users manage own, partners can read
CREATE POLICY "Users can insert own entries" ON journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own entries" ON journal_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own entries" ON journal_entries FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can read own entries" ON journal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Partners can read entries" ON journal_entries FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM partner_requests
    WHERE status IN ('accepted', 'break_pending')
    AND (
      (from_user_id = auth.uid() AND to_user_id = journal_entries.user_id)
      OR (to_user_id = auth.uid() AND from_user_id = journal_entries.user_id)
    )
  )
);

-- Partner requests: users see/manage their own
CREATE POLICY "Users can view own requests" ON partner_requests FOR SELECT USING (
  auth.uid() = from_user_id OR auth.uid() = to_user_id
);
CREATE POLICY "Users can create requests" ON partner_requests FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Users can update own requests" ON partner_requests FOR UPDATE USING (
  auth.uid() = from_user_id OR auth.uid() = to_user_id
);
CREATE POLICY "Users can delete own requests" ON partner_requests FOR DELETE USING (
  auth.uid() = from_user_id OR auth.uid() = to_user_id
);

-- ============================================
-- Enable Realtime for partner_requests
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE partner_requests;

-- ============================================
-- IMPORTANT: Go to Supabase Dashboard -> Auth -> Settings
-- Under "Email Auth", enable "Confirm email" = OFF
-- (or set "Auto Confirm" = ON)
-- This is required because we use username-based auth
-- with generated email addresses.
-- ============================================
