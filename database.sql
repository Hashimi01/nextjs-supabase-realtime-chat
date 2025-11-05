-- ============================================
-- Real-Time Chat Application Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: user
-- Stores user profile information
-- ============================================
CREATE TABLE IF NOT EXISTS public.user (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- ============================================
-- Table: message
-- Stores chat messages
-- ============================================
CREATE TABLE IF NOT EXISTS public.message (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- ============================================
-- Indexes for better performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_message_user_id ON public.message(user_id);
CREATE INDEX IF NOT EXISTS idx_message_created_at ON public.message(created_at DESC);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on tables
ALTER TABLE public.user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message ENABLE ROW LEVEL SECURITY;

-- ============================================
-- User Table Policies
-- ============================================

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user;

-- Policy: Anyone can read user profiles
CREATE POLICY "Users can view all profiles"
    ON public.user
    FOR SELECT
    USING (true);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
    ON public.user
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON public.user
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================
-- Message Table Policies
-- ============================================

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can view all messages" ON public.message;
DROP POLICY IF EXISTS "Authenticated users can insert their own messages" ON public.message;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.message;

-- Policy: Anyone authenticated can read all messages
CREATE POLICY "Authenticated users can view all messages"
    ON public.message
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can insert their own messages
CREATE POLICY "Authenticated users can insert their own messages"
    ON public.message
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own messages (optional)
CREATE POLICY "Users can delete their own messages"
    ON public.message
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- Functions and Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on user table
DROP TRIGGER IF EXISTS set_updated_at ON public.user;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.user
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- Real-time Replication - تفعيل التحديث الفوري
-- ============================================
-- This enables real-time updates for instant message delivery
-- تأكد من تفعيل Realtime في Supabase Dashboard أولاً
-- 
-- IMPORTANT: If you get an error saying table already exists, 
-- you can safely ignore it or run this from Supabase Dashboard:
-- Database → Replication → Enable for message and user tables

-- Enable replication for message table (CRITICAL for instant messages)
-- Note: This will add tables to realtime publication if not already added
-- If you get an error "relation already exists", the tables are already added
-- You can safely ignore that error or use Supabase Dashboard instead

-- Add tables to realtime publication
-- If tables are already in publication, you'll get an error but can safely ignore it
-- Better approach: Use Supabase Dashboard → Database → Replication to enable manually

-- Try to add message table to realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'message'
        AND schemaname = 'public'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.message;
    END IF;
END $$;

-- Try to add user table to realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'user'
        AND schemaname = 'public'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user;
    END IF;
END $$;

-- ============================================
-- Function to notify clients immediately
-- ============================================
-- This function ensures messages are broadcast immediately
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
    -- Use pg_notify to send immediate notification
    PERFORM pg_notify(
        'new_message',
        json_build_object(
            'id', NEW.id,
            'content', NEW.content,
            'user_id', NEW.user_id,
            'created_at', NEW.created_at
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to notify immediately when message is inserted
DROP TRIGGER IF EXISTS notify_message_insert ON public.message;
CREATE TRIGGER notify_message_insert
    AFTER INSERT ON public.message
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_new_message();

-- ============================================
-- Ensure tables are properly configured for realtime
-- ============================================
-- Make sure the tables have the right permissions
ALTER TABLE public.message ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user ENABLE ROW LEVEL SECURITY;

-- Grant realtime permissions
GRANT SELECT ON public.message TO anon, authenticated;
GRANT SELECT ON public.user TO anon, authenticated;

-- ============================================
-- Function to automatically create user profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user (id, username)
    VALUES (NEW.id, NULL);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile when auth user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Grant permissions
-- ============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.user TO anon, authenticated;
GRANT ALL ON public.message TO anon, authenticated;

