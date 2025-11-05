# إصلاح خطأ "Upload preset must be whitelisted for unsigned uploads"

## المشكلة

```
Error: Upload preset must be whitelisted for unsigned uploads
```

هذا يعني أن الـ preset `ml_default` غير مفعّل للـ Unsigned uploads.

## الحل السريع

### الخطوة 1: فتح Cloudinary Dashboard

1. اذهب إلى [cloudinary.com/console](https://console.cloudinary.com)
2. سجّل الدخول
3. اختر الحساب الصحيح (الذي يحتوي على Cloud Name: `die1pk3gb`)

### الخطوة 2: تفعيل Unsigned Uploads للـ Preset

1. اذهب إلى **Settings** (الإعدادات) من القائمة الجانبية
2. اضغط على **Upload** من القائمة
3. ابحث عن قسم **Upload presets**
4. ابحث عن preset اسمه `ml_default`
5. اضغط على preset للتعديل

### الخطوة 3: المشكلة الحقيقية

**من الصورة**: الـ preset `ml_default` موجود لكنه **Signed** وليس **Unsigned**!

**المشكلة**: الكود الحالي يستخدم **Unsigned uploads** (لا يحتاج API Secret)، لكن presetك هو **Signed** (يحتاج API Secret).

**الحل**: يجب تغيير preset من **Signed** إلى **Unsigned**:

### الخطوة 4: تغيير Preset من Signed إلى Unsigned

**الخيار الأفضل: إنشاء Preset جديد Unsigned** (موصى به):

1. في Cloudinary Dashboard → Settings → Upload
2. اضغط **Add upload preset** (لا تحذف القديم)
3. **Preset name**: `chat-uploads` (أو أي اسم جديد)
4. **Signing mode**: **Unsigned** ⚠️ **هذا مهم جداً**
5. ✅ **Allow unsigned uploads**: مفعّل
6. احفظ
7. غير في `.env.local`:
   ```env
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=chat-uploads
   ```

**أو تعديل Preset الموجود** (إذا كان مسموحاً):

1. اضغط على preset `ml_default` للتعديل
2. غيّر **Signing mode** من **Signed** إلى **Unsigned**
3. احفظ

### الخطوة 5: إذا لم تستطع التعديل

إذا لم تجد خيار "Allow unsigned uploads":

1. **حذف الـ preset القديم** وإنشاء واحد جديد:
   - اضغط على preset → **Delete**
   - اضغط **Add upload preset**
   - **Preset name**: `ml_default`
   - **Signing mode**: **Unsigned**
   - احفظ

2. **أو استخدام Signed upload** (يتطلب Backend):
   - غير `utils/fileUpload.js` لاستخدام Signed upload
   - يحتاج API Secret (لا تضعه في Frontend!)

### الخطوة 6: تنظيف متغيرات البيئة

في ملف `.env.local`، احذف كل شيء واكتب فقط:

```env
# Cloudinary Configuration
# من القيم التي أرسلتها:
# Cloud Name: die1pk3gb
# API Key: 352153168323658 (لا نحتاجه في Frontend)
# API Secret: Mq84bQKMJ0kFe4uhrka_iXdy7ds (لا تضعه في Frontend!)

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=die1pk3gb
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=ml_default
```

**القيم المطلوبة فقط**:
- `die1pk3gb` → `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `ml_default` → `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` (اسم preset يجب إنشاؤه في Cloudinary)

**احذف**:
- ❌ `CLOUDINARY_CLOUD_NAME=gradtrack` (مختلف)
- ❌ `NEXT_PUBLIC_CLOUDINARY_API_KEY=...` (لا نحتاجه)
- ❌ `CLOUDINARY_API_SECRET=...` (لا نحتاجه في Frontend)
- ❌ `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=cloudinary://...` (connection string خطأ)

### الخطوة 7: إعادة تشغيل السيرفر

```bash
# أوقف السيرفر (Ctrl+C)
npm run dev
```

## التحقق من الإعداد

بعد التعديل:
1. أعد تشغيل السيرفر
2. جرّب رفع ملف
3. يجب أن يعمل بدون أخطاء

## إذا استمرت المشكلة

### خيار 1: إنشاء Preset جديد باسم مختلف

1. في Cloudinary Dashboard → Settings → Upload
2. **Add upload preset**
3. **Preset name**: `chat-uploads` (أو أي اسم)
4. **Signing mode**: **Unsigned**
5. احفظ
6. غير في `.env.local`:
   ```env
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=chat-uploads
   ```

### خيار 2: استخدام Supabase Storage

إذا لم تريد استخدام Cloudinary:
1. احذف متغيرات Cloudinary من `.env.local`
2. أنشئ bucket `chat-files` في Supabase
3. النظام سيستخدم Supabase Storage تلقائياً

## ملاحظات

- ⚠️ **API Secret** يجب أن يكون في Backend فقط (للملفات الحساسة)
- ✅ **Unsigned uploads** آمنة للملفات العامة (صور، ملفات)
- ✅ **Preset name** يجب أن يطابق تماماً ما في Cloudinary

