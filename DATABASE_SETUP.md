# إعداد قاعدة البيانات - Database Setup

## خطوات إعداد قاعدة البيانات

### 1. فتح SQL Editor في Supabase

1. اذهب إلى [Supabase Dashboard](https://app.supabase.io)
2. اختر مشروعك
3. اذهب إلى **SQL Editor** من القائمة الجانبية

### 2. تنفيذ السكريبت

1. انسخ محتوى ملف `database.sql`
2. الصقه في SQL Editor
3. اضغط على **Run** أو **Execute**

### 3. تفعيل Real-time Replication

#### الطريقة الأولى (من Dashboard - موصى بها):
1. اذهب إلى **Database** → **Replication**
2. فعّل Replication لكل من:
   - جدول `user`
   - جدول `message`

#### الطريقة الثانية (من SQL Editor):
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.user;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message;
```

### 4. إعداد OAuth Providers (اختياري)

إذا كنت تريد استخدام GitHub أو Google للدخول:

1. اذهب إلى **Authentication** → **Providers**
2. فعّل **GitHub** و/أو **Google**
3. أضف **Client ID** و **Client Secret** من مزود OAuth

### 5. التحقق من الإعداد

بعد تنفيذ السكريبت، تأكد من:

- ✅ جدول `user` موجود
- ✅ جدول `message` موجود
- ✅ Row Level Security (RLS) مفعّل على الجداول
- ✅ Real-time Replication مفعّل

## ملاحظات مهمة

### الأمان (Security)
- تم تفعيل Row Level Security (RLS) على جميع الجداول
- المستخدمون يمكنهم فقط تعديل بياناتهم الخاصة
- جميع الرسائل قابلة للقراءة من قبل المستخدمين المسجلين

### Real-time
- تأكد من تفعيل Real-time Replication للجداول
- بدون هذا، لن تعمل المحادثة الفورية

### User Profiles
- عند تسجيل مستخدم جديد، يتم إنشاء ملفه تلقائياً في جدول `user`
- يمكن للمستخدم تعديل `username` لاحقاً

## هيكل الجداول

### جدول `user`
- `id` (UUID) - Primary Key، مرتبط بـ `auth.users.id`
- `username` (TEXT) - اسم المستخدم (اختياري)
- `created_at` (TIMESTAMP) - وقت الإنشاء
- `updated_at` (TIMESTAMP) - وقت آخر تحديث

### جدول `message`
- `id` (UUID) - Primary Key
- `content` (TEXT) - محتوى الرسالة
- `user_id` (UUID) - معرف المستخدم المرسل
- `created_at` (TIMESTAMP) - وقت إرسال الرسالة

## استكشاف الأخطاء

### خطأ: "relation already exists"
- الجداول موجودة بالفعل، يمكنك تخطي هذا الخطأ أو حذف الجداول أولاً

### خطأ: "permission denied"
- تأكد من أنك تستخدم Service Role Key أو أن لديك صلاحيات كافية

### Real-time لا يعمل
- تحقق من تفعيل Replication في Dashboard
- تأكد من أن RLS policies صحيحة

