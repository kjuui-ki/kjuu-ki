/**
 * إعدادات بوابة الدفع — Moyasar (مدى، فيزا، Apple Pay)
 *
 * 1. أنشئ حساباً على https://moyasar.com
 * 2. انسخ المفتاح العام (Publishable Key) من لوحة Moyasar
 * 3. ضعه في moyasarPublishableKey أدناه
 * 4. غيّر enabled إلى true
 */
window.maherPaymentConfig = {
    enabled: false,
    provider: "moyasar",
    moyasarPublishableKey: "",
    currency: "SAR",
    storeName: "أكاديمية ماهر للتدريب",
    callbackPath: "checkout-success.html"
};
