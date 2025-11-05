# إعداد Cloudinary للملفات

## لماذا Cloudinary؟

Cloudinary أفضل من Supabase Storage في:
- ✅ **أسهل في الإعداد** - لا يحتاج policies معقدة
- ✅ **معالجة صور تلقائية** - تحسين، resize، filters
- ✅ **CDN سريع عالمي** - تحميل أسرع
- ✅ **دعم أفضل للفيديو** - تحويل تلقائي
- ✅ **مجاني** - 25 GB storage + 25 GB bandwidth شهرياً

## خطوات الإعداد

### 1. إنشاء حساب Cloudinary

1. اذهب إلى [cloudinary.com](https://cloudinary.com)
2. سجّل حساب مجاني
3. بعد التسجيل، ستحصل على:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

### 2. إعداد Upload Preset (مهم جداً!)

#### إذا كان Preset موجوداً بالفعل:

1. اذهب إلى **Settings** → **Upload** في Cloudinary Dashboard
2. في قسم **Upload presets**، ابحث عن preset `ml_default`
3. اضغط على preset للتعديل
4. **تحقق من هذه الإعدادات**:
   - ✅ **Signing mode**: يجب أن يكون **Unsigned**
   - ✅ **Allowed unsigned uploads**: يجب أن تكون **مفعّلة**
5. إذا لم تكن مفعّلة:
   - فعّل **"Allow unsigned uploads"** أو **"Enable unsigned uploads"**
   - احفظ التغييرات

#### إذا لم يكن Preset موجوداً:

1. في Dashboard، اذهب إلى **Settings** → **Upload**
2. اضغط **Add upload preset**
3. اختر:
   - **Preset name**: `ml_default`
   - **Signing mode**: **Unsigned** ⚠️ **هذا ضروري**
   - ✅ **Enable unsigned uploads**: يجب أن تكون مفعّلة
   - **Folder**: `chat-files` (اختياري)
   - **Use filename**: ✅ مفعل
4. احفظ الـ preset

#### ⚠️ خطأ شائع: "Upload preset must be whitelisted for unsigned uploads"

**الحل**:
1. اذهب إلى Cloudinary Dashboard → Settings → Upload
2. ابحث عن preset `ml_default`
3. تأكد من تفعيل **"Allow unsigned uploads"** أو **"Enable unsigned uploads"**
4. احفظ التغييرات
5. أعد المحاولة

### 3. إضافة متغيرات البيئة

أضف هذه المتغيرات إلى ملف `.env.local`:

```env
# Cloudinary Configuration (للـ Frontend فقط)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=die1pk3gb
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=ml_default
```

**⚠️ ملاحظات مهمة**:

1. **استخدم فقط Cloud Name و Preset Name**:
   - ❌ **لا تضع** API Secret في متغيرات `NEXT_PUBLIC_*`
   - ❌ **لا تضع** connection string مثل `cloudinary://...`
   - ✅ **استخدم فقط**: Cloud Name و Preset Name

2. **إذا كان لديك عدة حسابات**:
   - استخدم Cloud Name الصحيح: `die1pk3gb` (من البيانات التي أرسلتها)
   - تأكد من أن preset `ml_default` موجود في نفس الحساب

3. **تنظيف المتغيرات**:
   - احذف المتغيرات المكررة أو القديمة
   - استخدم فقط المتغيرين المذكورين أعلاه

### 4. التحقق من الإعداد

بعد إضافة المتغيرات:
1. أعد تشغيل السيرفر (`npm run dev`)
2. جرّب رفع ملف
3. يجب أن يعمل تلقائياً مع Cloudinary

## كيفية عمل النظام

- إذا كان `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` موجود → يستخدم **Cloudinary**
- إذا لم يكن موجود → يستخدم **Supabase Storage**

## مقارنة سريعة

| الميزة | Supabase Storage | Cloudinary |
|--------|------------------|------------|
| الإعداد | يحتاج Policies | سهل جداً |
| الصور | عرض فقط | معالجة تلقائية |
| CDN | محدود | عالمي |
| الفيديو | محدود | دعم كامل |
| المجاني | 1 GB | 25 GB |

## ملاحظات أمنية

- ⚠️ **لا تضع API Secret** في متغيرات `NEXT_PUBLIC_*` - هذه متغيرات عامة
- ✅ استخدم **Unsigned Upload Preset** للملفات من Frontend
- ✅ يمكنك إضافة قيود على حجم الملف في Cloudinary Settings

## حل المشاكل

### الملفات لا ترفع
- تحقق من Console (F12) للأخطاء
- تأكد من أن Upload Preset هو **Unsigned**
- تأكد من صحة Cloud Name

### خطأ في الصلاحيات
- تأكد من أن Upload Preset مفعّل للـ Unsigned uploads
- تحقق من Cloudinary Dashboard → Settings → Security

