# حل سريع: Preset Signed بدلاً من Unsigned

## المشكلة

الـ preset `ml_default` موجود لكنه **Signed** (كما في الصورة)، بينما الكود يحتاج **Unsigned**.

## الحل السريع (دقيقتين) ⚡

### 1. إنشاء Preset جديد Unsigned

1. اذهب إلى [Cloudinary Dashboard](https://console.cloudinary.com) → **Settings** → **Upload**
2. اضغط **Add upload preset** (أو **Create preset**)
3. املأ:
   - **Preset name**: `chat-uploads` (أو أي اسم)
   - **Signing mode**: **Unsigned** ⚠️ **هذا مهم جداً!**
   - ✅ **Allow unsigned uploads**: مفعّل (إذا كان موجود)
4. احفظ

### 2. تحديث `.env.local`

افتح `.env.local` واكتب:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=die1pk3gb
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=chat-uploads
```

(استخدم الاسم الجديد الذي اخترته في الخطوة 1)

### 3. أعد تشغيل السيرفر

```bash
# أوقف السيرفر (Ctrl+C) ثم:
npm run dev
```

**انتهى!** ✅

## الفرق بين Signed و Unsigned

- **Signed**: يحتاج API Secret لحساب signature (أكثر أماناً لكن معقد، يحتاج Backend)
- **Unsigned**: لا يحتاج API Secret (أسهل للـ Frontend) ← **هذا ما نحتاجه**

## ملاحظة

إذا كان preset `ml_default` يستخدم في أماكن أخرى، لا تحذفه! فقط أنشئ preset جديد Unsigned واستخدمه.

