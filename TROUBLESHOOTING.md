# استكشاف أخطاء رفع الملفات

## المشاكل الشائعة وحلولها

### 1. خطأ: "Bucket not found"
**السبب**: لم يتم إنشاء bucket `chat-files` في Supabase.

**الحل**:
1. اذهب إلى Supabase Dashboard → Storage
2. اضغط على "New bucket"
3. اسم الـ bucket: `chat-files`
4. فعّل "Public bucket"
5. حدد حجم الملف: 10 MB
6. اترك "Allowed MIME types" فارغاً للسماح بجميع الأنواع

### 2. خطأ: "new row violates row-level security"
**السبب**: Storage Policies غير موجودة أو غير صحيحة.

**الحل**: نفّذ هذه الـ policies في Supabase SQL Editor:

```sql
-- Policy 1: Users can upload files
DROP POLICY IF EXISTS "Users can upload files" ON storage.objects;
CREATE POLICY "Users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-files' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Anyone can view files
DROP POLICY IF EXISTS "Anyone can view files" ON storage.objects;
CREATE POLICY "Anyone can view files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-files');

-- Policy 3: Users can delete their own files
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-files' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### 3. خطأ: "File size too large"
**السبب**: الملف أكبر من 10 MB.

**الحل**: 
- قلل حجم الملف أو زد الحد في Supabase Storage Settings

### 4. خطأ: "MIME type not allowed"
**السبب**: Bucket محدود بأنواع معينة من الملفات.

**الحل**:
- اذهب إلى Storage → chat-files → Settings
- اترك "Allowed MIME types" فارغاً أو أضف `*/*` للسماح بجميع الأنواع

### 5. الملفات لا تظهر في الرسائل
**السبب**: قد تكون المشكلة في:
- الـ URL غير صحيح
- Storage bucket غير public
- RLS policies تمنع القراءة

**الحل**:
- تأكد أن bucket هو public
- تأكد من policy "Anyone can view files" موجودة ومفعّلة
- تحقق من Console في المتصفح للأخطاء

## التحقق من الإعداد

1. **تحقق من Bucket**:
   - Storage → يجب أن ترى `chat-files`

2. **تحقق من Policies**:
   - Storage → Policies → chat-files
   - يجب أن ترى 3 policies على الأقل

3. **تحقق من Settings**:
   - Storage → chat-files → Settings
   - Public bucket: ✅ مفعل
   - File size limit: 10485760 (10 MB)
   - Allowed MIME types: فارغ أو `*/*`

## نصائح إضافية

- افتح Console في المتصفح (F12) لرؤية الأخطاء التفصيلية
- تأكد من أن المستخدم مسجل دخول (authenticated)
- تأكد من أن Session نشط

