-- ============================================
-- إضافة أعمدة الملفات لجدول message
-- Add File Columns to message table
-- ============================================
-- هذا السكريبت يضيف الأعمدة إذا لم تكن موجودة
-- Run this script in Supabase SQL Editor if you get:
-- "Could not find the 'file_name' column of 'message' in the schema cache"

-- Add file_url column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'message' 
        AND column_name = 'file_url'
    ) THEN
        ALTER TABLE public.message ADD COLUMN file_url TEXT;
        RAISE NOTICE 'Added file_url column';
    ELSE
        RAISE NOTICE 'file_url column already exists';
    END IF;
END $$;

-- Add file_type column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'message' 
        AND column_name = 'file_type'
    ) THEN
        ALTER TABLE public.message ADD COLUMN file_type TEXT;
        RAISE NOTICE 'Added file_type column';
    ELSE
        RAISE NOTICE 'file_type column already exists';
    END IF;
END $$;

-- Add file_name column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'message' 
        AND column_name = 'file_name'
    ) THEN
        ALTER TABLE public.message ADD COLUMN file_name TEXT;
        RAISE NOTICE 'Added file_name column';
    ELSE
        RAISE NOTICE 'file_name column already exists';
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
AND table_name = 'message'
ORDER BY ordinal_position;

