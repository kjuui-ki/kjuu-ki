// Register page Supabase setup and signup logic

// استخدم نفس بيانات مشروع Supabase المستخدمة في supabaseClient.js
const SUPABASE_URL = "https://jgvfcievyfkyldryatlk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ieBSqzdn_nZJk4t-n8cNlw_ZjMwsgjY";

// إنشاء عميل Supabase خاص بصفحة التسجيل
const registerSupabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// دالة عامة لتسجيل مستخدم جديد
async function registerUser(email, password, fullName, role) {
    const { data, error } = await registerSupabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                role: role
            }
        }
    });

    if (error) {
        console.error("Sign up error:", error);
        alert("حدث خطأ أثناء إنشاء الحساب: " + (error.message || ""));
        return { error };
    }

    alert("تم إنشاء الحساب بنجاح!");
    return { data };
}

// ربط الفورمات في صفحة register.html مع دالة التسجيل
document.addEventListener("DOMContentLoaded", function () {
    // فورم الباحث عن عمل
    const seekerForm = document.getElementById("registerSeekerForm");
    if (seekerForm) {
        seekerForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const fullName = document.getElementById("seekerFullName").value.trim();
            const email = document.getElementById("seekerEmail").value.trim();
            const password = document.getElementById("seekerPassword").value;
            const confirm = document.getElementById("seekerPasswordConfirm").value;

            if (!fullName || !email || !password) {
                alert("يرجى إدخال الاسم الكامل والبريد الإلكتروني وكلمة المرور");
                return;
            }
            if (password.length < 6) {
                alert("يجب أن تكون كلمة المرور 6 أحرف على الأقل");
                return;
            }
            if (password !== confirm) {
                alert("تأكيد كلمة المرور غير متطابق");
                return;
            }

            const res = await registerUser(email, password, fullName, "job_seeker");
            if (!res.error) {
                if (window.authApi && typeof window.authApi.navigate === "function") {
                    window.authApi.navigate("jobs.html");
                }
            }
        });
    }

    // فورم الشركة / صاحب العمل
    const employerForm = document.getElementById("registerEmployerForm");
    if (employerForm) {
        employerForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const companyName = document.getElementById("employerCompanyName").value.trim();
            const email = document.getElementById("employerEmail").value.trim();
            const password = document.getElementById("employerPassword").value;
            const confirm = document.getElementById("employerPasswordConfirm").value;

            if (!companyName || !email || !password) {
                alert("يرجى إدخال اسم الشركة والبريد الإلكتروني وكلمة المرور");
                return;
            }
            if (password.length < 6) {
                alert("يجب أن تكون كلمة المرور 6 أحرف على الأقل");
                return;
            }
            if (password !== confirm) {
                alert("تأكيد كلمة المرور غير متطابق");
                return;
            }

            const res = await registerUser(email, password, companyName, "company");
            if (!res.error) {
                if (window.authApi && typeof window.authApi.navigate === "function") {
                    window.authApi.navigate("dashboard.html");
                }
            }
        });
    }
});
