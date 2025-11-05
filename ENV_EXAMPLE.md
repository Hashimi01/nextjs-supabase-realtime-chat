# مثال على ملف .env.local

## متغيرات Cloudinary (للـ Frontend)

```env
# Cloudinary Configuration
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=die1pk3gb
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=ml_default
```

## ⚠️ ملاحظات مهمة:

1. **لا تضع API Secret في Frontend**:
   - ❌ `CLOUDINARY_API_SECRET=Mq84bQKMJ0kFe4uhrka_iXdy7ds` - لا تضع هذا في Frontend!
   - ❌ `NEXT_PUBLIC_CLOUDINARY_API_KEY=352153168323658` - لا نحتاجه للـ unsigned uploads

2. **ما نحتاجه فقط**:
   - ✅ `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=die1pk3gb` - Cloud Name
   - ✅ `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=ml_default` - اسم الـ preset

3. **API Secret يستخدم فقط في Backend** (للملفات الحساسة أو Signed uploads)

## إعداد Upload Preset في Cloudinary

بعد الحصول على هذه القيم، يجب:

1. الذهاب إلى Cloudinary Dashboard
2. إنشاء أو تعديل preset `ml_default`
3. تفعيل "Allow unsigned uploads"

