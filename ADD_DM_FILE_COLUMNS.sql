-- ============================================
-- إضافة أعمدة الملفات لجدول direct_message
-- Add File Columns to direct_message table
-- ============================================
-- هذا السكريبت يضيف الأعمدة إذا لم تكن موجودة
-- Run this script in Supabase SQL Editor if files don't appear in private messages

-- Add file_url column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'direct_message' 
        AND column_name = 'file_url'
    ) THEN
        ALTER TABLE public.direct_message ADD COLUMN file_url TEXT;
        RAISE NOTICE 'Added file_url column to direct_message';
    ELSE
        RAISE NOTICE 'file_url column already exists in direct_message';
    END IF;
END $$;

-- Add file_type column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'direct_message' 
        AND column_name = 'file_type'
    ) THEN
        ALTER TABLE public.direct_message ADD COLUMN file_type TEXT;
        RAISE NOTICE 'Added file_type column to direct_message';
    ELSE
        RAISE NOTICE 'file_type column already exists in direct_message';
    END IF;
END $$;

-- Add file_name column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'direct_message' 
        AND column_name = 'file_name'
    ) THEN
        ALTER TABLE public.direct_message ADD COLUMN file_name TEXT;
        RAISE NOTICE 'Added file_name column to direct_message';
    ELSE
        RAISE NOTICE 'file_name column already exists in direct_message';
    END IF;
END $$;

-- Refresh PostgREST schema cache (this is important!)
NOTIFY pgrst, 'reload schema';

-- ============================================
-- التحقق من الأعمدة
-- Verify columns
-- ============================================
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'direct_message'
ORDER BY ordinal_position;

