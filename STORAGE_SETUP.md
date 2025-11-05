# إعداد Storage للملفات والصور

## خطوات الإعداد في Supabase Dashboard

### 1. إنشاء Storage Bucket

1. اذهب إلى **Storage** في Supabase Dashboard
2. اضغط على **New bucket**
3. أدخل:
   - **Name**: `chat-files`
   - **Public bucket**: ✅ مفعل (لتمكين الوصول العام للملفات)
   - **File size limit**: `10485760` (10 MB)
   - **Allowed MIME types**: اتركه فارغاً أو أضف جميع الأنواع (للسماح بجميع أنواع الملفات)
     - أو يمكنك تحديد أنواع معينة:
     - `image/*` (جميع الصور)
     - `audio/*` (جميع الصوتيات)
     - `application/pdf`
     - `application/msword`
     - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
     - أو اتركه فارغاً للسماح بجميع الأنواع

### 2. إعداد Storage Policies

اذهب إلى **Storage** → **Policies** → **chat-files**

#### Policy 1: Users can upload files
```sql
CREATE POLICY "Users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-files' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
```

#### Policy 2: Anyone can view files
```sql
CREATE POLICY "Anyone can view files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-files');
```

#### Policy 3: Users can delete their own files
```sql
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-files' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
```

## ملاحظات

- الملفات تُحفظ في مجلدات باسم `{user_id}/filename`
- الحد الأقصى لحجم الملف: 10 MB
- الصور المدعومة: JPEG, PNG, GIF, WebP
- الملفات المدعومة: PDF, DOC, DOCX

