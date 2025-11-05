# إصلاح خطأ Schema Cache - Fix Schema Cache Error

## المشكلة

```
Could not find the 'file_name' column of 'message' in the schema cache
```

هذا يعني أن Supabase PostgREST لم يتعرف على الأعمدة الجديدة `file_url`, `file_type`, `file_name`.

## الحل السريع (3 خطوات)

### الخطوة 1: إضافة الأعمدة (إذا لم تكن موجودة)

1. اذهب إلى [Supabase Dashboard](https://app.supabase.com)
2. افتح **SQL Editor**
3. انسخ والصق محتوى ملف `ADD_FILE_COLUMNS.sql`
4. اضغط **Run**

أو نفّذ هذا السكريبت مباشرة:

```sql
-- Add file_url column
ALTER TABLE public.message ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Add file_type column
ALTER TABLE public.message ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Add file_name column
ALTER TABLE public.message ADD COLUMN IF NOT EXISTS file_name TEXT;
```

### الخطوة 2: تحديث Schema Cache

بعد إضافة الأعمدة، يجب تحديث PostgREST schema cache:

**الطريقة 1: من SQL Editor (موصى به)**
```sql
NOTIFY pgrst, 'reload schema';
```

**الطريقة 2: من Dashboard**
1. اذهب إلى **Settings** → **API**
2. اضغط على **Reload Schema Cache** أو **Refresh Schema**

**الطريقة 3: إعادة تشغيل Project** (إذا لم تعمل الطرق السابقة)
1. اذهب إلى **Settings** → **General**
2. اضغط **Restart Project** (سيستغرق دقيقة)

### الخطوة 3: التحقق من الأعمدة

نفّذ هذا السكريبت للتأكد من وجود الأعمدة:

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'message'
ORDER BY ordinal_position;
```

يجب أن ترى:
- ✅ `file_url` (TEXT, nullable)
- ✅ `file_type` (TEXT, nullable)
- ✅ `file_name` (TEXT, nullable)

## إذا استمرت المشكلة

### 1. تحقق من الأعمدة في Database

اذهب إلى **Database** → **Tables** → **message** → **Columns**

يجب أن ترى الأعمدة الثلاثة.

### 2. أعد تحميل الصفحة

بعد تحديث Schema Cache:
- أوقف السيرفر (`Ctrl+C`)
- أعد تشغيله: `npm run dev`
- امسح cache المتصفح (Ctrl+Shift+R)

### 3. تحقق من RLS Policies

تأكد أن RLS Policies تسمح بإدخال الأعمدة الجديدة:

```sql
-- التحقق من policies
SELECT * FROM pg_policies WHERE tablename = 'message';
```

## ملاحظات

- ⚠️ **Schema Cache** يحتاج تحديث بعد أي تغيير في هيكل الجدول
- ✅ استخدم `NOTIFY pgrst, 'reload schema'` بعد كل `ALTER TABLE`
- ✅ الأعمدة `file_url`, `file_type`, `file_name` اختيارية (nullable)

