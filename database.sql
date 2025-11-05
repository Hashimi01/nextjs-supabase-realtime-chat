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

-- Add file columns if they don't exist (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'message' AND column_name = 'file_url') THEN
        ALTER TABLE public.message ADD COLUMN file_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'message' AND column_name = 'file_type') THEN
        ALTER TABLE public.message ADD COLUMN file_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'message' AND column_name = 'file_name') THEN
        ALTER TABLE public.message ADD COLUMN file_name TEXT;
    END IF;
END $$;

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
-- Direct Messages (Private Chats)
-- ============================================

-- Threads table (each pair of users has a single thread)
CREATE TABLE IF NOT EXISTS public.direct_message_thread (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Ensure uniqueness for pair regardless of order
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_dm_thread_unique_pair'
    ) THEN
        EXECUTE 'CREATE UNIQUE INDEX idx_dm_thread_unique_pair ON public.direct_message_thread ((LEAST(user_a, user_b)), (GREATEST(user_a, user_b)))';
    END IF;
END $$;

-- Messages table for threads
CREATE TABLE IF NOT EXISTS public.direct_message (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES public.direct_message_thread(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Add file columns if they don't exist (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'direct_message' AND column_name = 'file_url') THEN
        ALTER TABLE public.direct_message ADD COLUMN file_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'direct_message' AND column_name = 'file_type') THEN
        ALTER TABLE public.direct_message ADD COLUMN file_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'direct_message' AND column_name = 'file_name') THEN
        ALTER TABLE public.direct_message ADD COLUMN file_name TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_direct_message_thread ON public.direct_message(thread_id);
CREATE INDEX IF NOT EXISTS idx_direct_message_created_at ON public.direct_message(created_at);

-- RLS for threads/messages
ALTER TABLE public.direct_message_thread ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_message ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "dm_thread_select" ON public.direct_message_thread;
DROP POLICY IF EXISTS "dm_thread_insert" ON public.direct_message_thread;
DROP POLICY IF EXISTS "dm_select" ON public.direct_message;
DROP POLICY IF EXISTS "dm_insert" ON public.direct_message;

-- A user can see threads where they are participant
CREATE POLICY "dm_thread_select"
    ON public.direct_message_thread
    FOR SELECT
    USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Allow creating thread by any authenticated user (will be normalized by function)
CREATE POLICY "dm_thread_insert"
    ON public.direct_message_thread
    FOR INSERT
    WITH CHECK (true);

-- A user can read messages of threads they belong to
CREATE POLICY "dm_select"
    ON public.direct_message
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.direct_message_thread t
        WHERE t.id = thread_id AND (auth.uid() = t.user_a OR auth.uid() = t.user_b)
    ));

-- A user can insert messages only in their threads and only as themselves
CREATE POLICY "dm_insert"
    ON public.direct_message
    FOR INSERT
    WITH CHECK (
        sender_id = auth.uid() AND EXISTS (
            SELECT 1 FROM public.direct_message_thread t
            WHERE t.id = thread_id AND (auth.uid() = t.user_a OR auth.uid() = t.user_b)
        )
    );

-- Helper function to ensure a thread exists between current user and partner
CREATE OR REPLACE FUNCTION public.ensure_dm_thread(partner_id UUID)
RETURNS UUID AS $$
DECLARE
    me UUID := auth.uid();
    a UUID;
    b UUID;
    existing UUID;
BEGIN
    IF me IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Normalize order (least/greatest)
    a := LEAST(me, partner_id);
    b := GREATEST(me, partner_id);

    SELECT id INTO existing
    FROM public.direct_message_thread
    WHERE LEAST(user_a, user_b) = a AND GREATEST(user_a, user_b) = b
    LIMIT 1;

    IF existing IS NULL THEN
        INSERT INTO public.direct_message_thread(user_a, user_b)
        VALUES (a, b)
        RETURNING id INTO existing;
    END IF;
    RETURN existing;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.ensure_dm_thread(UUID) TO authenticated;

-- Function to get threads with last message info for ordering (simplified version)
-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS public.get_threads_with_last_message(UUID);

CREATE FUNCTION public.get_threads_with_last_message(user_id UUID)
RETURNS TABLE (
    thread_id UUID,
    other_user_id UUID,
    last_message_content TEXT,
    last_message_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id as thread_id,
        CASE WHEN t.user_a = user_id THEN t.user_b ELSE t.user_a END as other_user_id,
        dm.content as last_message_content,
        COALESCE(dm.created_at, t.created_at) as last_message_time
    FROM public.direct_message_thread t
    LEFT JOIN LATERAL (
        SELECT content, created_at
        FROM public.direct_message
        WHERE thread_id = t.id
        ORDER BY created_at DESC
        LIMIT 1
    ) dm ON true
    WHERE t.user_a = user_id OR t.user_b = user_id
    ORDER BY COALESCE(dm.created_at, t.created_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_threads_with_last_message(UUID) TO authenticated;

-- Realtime replication for DM tables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'direct_message'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_message;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'direct_message_thread'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_message_thread;
    END IF;
END $$;

-- ============================================
-- Storage Bucket for Chat Files
-- ============================================
-- Note: This must be run in Supabase Dashboard SQL Editor
-- or via Supabase CLI/Migrations

-- Create storage bucket for chat files
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--     'chat-files',
--     'chat-files',
--     true,
--     10485760, -- 10MB limit
--     ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
-- )
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat-files bucket
-- Policy: Users can upload files
-- CREATE POLICY "Users can upload files"
--     ON storage.objects FOR INSERT
--     TO authenticated
--     WITH CHECK (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can view all files
-- CREATE POLICY "Anyone can view files"
--     ON storage.objects FOR SELECT
--     TO public
--     USING (bucket_id = 'chat-files');

-- Policy: Users can delete their own files
-- CREATE POLICY "Users can delete their own files"
--     ON storage.objects FOR DELETE
--     TO authenticated
--     USING (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1]);

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

