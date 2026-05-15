# المسارات التدريبية — ترحيل قاعدة البيانات وتفعيل الميزات

## 1) تنفيذ SQL في Supabase

1. افتح **Supabase Dashboard** → مشروعك → **SQL Editor**.
2. انسخ محتوى الملف `database/training_paths_migration.sql` والصقه ثم نفّذ **Run**.
   - ينشئ جدول `training_paths`، أعمدة جديدة في `courses`، جدول `admin_notifications`، والـ trigger لإشعار التسجيل.
3. انسخ محتوى `database/seed_training_catalog.sql` (يُولَّد محلياً بالأمر أدناه) ثم نفّذه **Run** مرة واحدة لملء المسارات والدورات.

```bash
node database/generate_training_seed.mjs
```

يُنشئ/يحدّث `database/seed_training_catalog.sql` من `database/catalog-seed.tsv`.

> **تنبيه:** إعادة تشغيل الـ seed يكرر صفوف `courses`. للبيئة النظيفة نفّذ الترحيل ثم الـ seed مرة واحدة، أو احذف الدورات المرتبطة بالمسارات قبل إعادة الإدراج.

## 2) الواجهة الأمامية

- **`training-paths.html`**: صفحة المسارات (شبكة) وتفاصيل المسار `?path=<uuid>` مع زر **تسجيل في الدورة** وتحويل غير المسجّل إلى `login.html?next=...`.
- **`courses.html`**: زر الدخول للتسجيل يحفظ `next` للعودة بعد تسجيل الدخول؛ دعم `?enroll=<course_id>`.
- **`auth.js`**: بعد تسجيل الدخول أو إنشاء الحساب يوجّه إلى `next` إن كان رابطاً آمناً (ملف `.html` داخل الموقع فقط).

## 3) لوحة التحكم

- تبويب **المسارات التدريبية**: إضافة مسار (slug، اسم، أيقونة، ترتيب).
- تبويب **الدورات**: اختيار المسار، نوع المحتوى (دورة/دبلوم)، التسعير (مجاني/مدفوع + مبلغ)، تصدير Excel للمسجلين (موجود مسبقاً).
- **الجرس 🔔**: آخر الإشعارات من `admin_notifications` (يُعبأ تلقائياً عند إدراج `course_enrollments`).

## 4) صلاحيات Supabase (مهم)

إذا فعّلت **RLS** لاحقاً على الجداول الجديدة، أضف سياسات قراءة/كتابة مناسبة للمشرف والزوار. حالياً المشروع يستخدم `DISABLE ROW LEVEL SECURITY` على `courses` كما في المشروع الأصلي.

## 5) مشكلة Trigger على PostgreSQL

إذا ظهر خطأ بخصوص `EXECUTE PROCEDURE`، جرّب في `training_paths_migration.sql` استبدال السطر بـ:

`EXECUTE FUNCTION public.notify_admin_new_enrollment();`

(حسب إصدار PostgreSQL في Supabase).
