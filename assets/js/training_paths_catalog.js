/**
 * الكتالوج الافتراضي — نفس معرّفات seed_training_catalog.sql
 * عرض للزوار إن كان جدول training_paths فارغاً، واستيراد upsert من لوحة الأدمن.
 */
(function () {
    "use strict";
    window.maherDefaultTrainingPaths = [
        { id: "6f218ea3-2986-480f-bd9c-e363b114ebea", slug: "al-qiyada-al-ulya", name_ar: "مسار القيادة العليا", icon: "🎯", sort_order: 1, is_active: true },
        { id: "793b500b-b6c7-434d-8f22-4c6edaa99ef7", slug: "al-idara-al-wusta", name_ar: "مسار الإدارة الوسطى", icon: "📊", sort_order: 2, is_active: true },
        { id: "f75ebf5c-1149-403b-adc8-d71998a66677", slug: "al-iilam-wal-ittisal", name_ar: "مسار الإعلام والاتصال المؤسسي", icon: "📣", sort_order: 3, is_active: true },
        { id: "88b45ee8-0d68-4b6f-950f-31fafe090f2c", slug: "taknikat-al-maalumat", name_ar: "مسار تقنية المعلومات", icon: "💻", sort_order: 4, is_active: true },
        { id: "2382a403-f79e-4e3b-95c2-369c38c8b892", slug: "al-shuun-al-maliya", name_ar: "مسار الشؤون المالية", icon: "💰", sort_order: 5, is_active: true },
        { id: "d34ecdf9-1491-4994-8412-c63a604e8071", slug: "al-mawared-al-bashariya", name_ar: "مسار الموارد البشرية", icon: "👥", sort_order: 6, is_active: true },
        { id: "fc905b85-c454-4308-b18c-4e883e618a19", slug: "al-baramij-al-taheeliya", name_ar: "مسار البرامج التأهيلية", icon: "🎓", sort_order: 7, is_active: true },
        { id: "86ca55a6-f9c1-4c5e-8017-72d0277f511c", slug: "al-aghdiya", name_ar: "مسار الأغذية وسلامتها", icon: "🍽️", sort_order: 8, is_active: true },
        { id: "5f32c274-58df-4cbb-b05b-c5ec433fc995", slug: "al-riyada", name_ar: "مسار الرياضة", icon: "⚽", sort_order: 9, is_active: true },
        { id: "fc275b08-665b-43e4-a6f4-d4796c399741", slug: "al-masar-al-qanuni", name_ar: "المسار القانوني", icon: "⚖️", sort_order: 10, is_active: true },
        { id: "0284e552-2561-4d4e-95c6-9ea07a4c09f0", slug: "al-masar-al-tatawiri", name_ar: "المسار التطويري", icon: "🌱", sort_order: 11, is_active: true },
        { id: "d218da2f-8920-43f1-ad5e-325b86894fa5", slug: "al-masar-al-talimi", name_ar: "المسار التعليمي", icon: "📖", sort_order: 12, is_active: true },
        { id: "7e8f979b-9dba-4338-bbf7-7c5062d68f81", slug: "al-amn-wal-salama", name_ar: "مسار الأمن والسلامة", icon: "🛡️", sort_order: 13, is_active: true },
        { id: "13e3dad6-9f4f-4c65-b2d0-7395d68a9c83", slug: "al-idara-al-sihiya", name_ar: "مسار الإدارة الصحية", icon: "🏥", sort_order: 14, is_active: true },
        { id: "dc2f6f22-f742-42a2-af8b-d4d144497821", slug: "al-fanni-wal-handasi", name_ar: "المسار الفني والهندسي", icon: "🏗️", sort_order: 15, is_active: true },
        { id: "deef2bec-3286-45a9-a183-7f3ba56d656c", slug: "al-fundiqa-wal-siyaha", name_ar: "مسار الفندقة والسياحة", icon: "🏨", sort_order: 16, is_active: true },
        { id: "c9331f25-600f-4e8e-a51b-035b8678b2f4", slug: "al-diblumat", name_ar: "مسار الدبلومات التخصصية", icon: "🎖️", sort_order: 17, is_active: true }
    ];
})();
