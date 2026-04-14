/**
 * reset-password.js  — 3-step password reset via Supabase OTP
 *
 * Step 1 → user enters email  → auth.signInWithOtp (sends 6-digit code)
 * Step 2 → user enters code   → auth.verifyOtp (type: 'email')
 * Step 3 → user types new pwd → auth.updateUser({ password })
 */

document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    /* ── Wait for supabaseClient (auth.js creates it) ── */
    var attempts = 0;
    var interval = setInterval(function () {
        attempts++;
        if (window.supabaseClient) {
            clearInterval(interval);
            init(window.supabaseClient);
        } else if (attempts >= 50) {
            clearInterval(interval);
            showStatus("fpSendStatus", "error", "تعذّر الاتصال. حاول تحديث الصفحة.");
        }
    }, 80);
});

function showStatus(id, type, msg) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent   = msg;
    el.className     = "form-status" + (msg ? " form-status-" + type : "");
    el.style.display = msg ? "block" : "none";
}

function init(sb) {
    "use strict";

    var currentEmail = "";

    var step1 = document.getElementById("fpStep1");
    var step2 = document.getElementById("fpStep2");
    var step3 = document.getElementById("fpStep3");

    function goStep(n) {
        if (step1) step1.style.display = n === 1 ? "" : "none";
        if (step2) step2.style.display = n === 2 ? "" : "none";
        if (step3) step3.style.display = n === 3 ? "" : "none";
    }

    function setBtnLoading(btnId, loading, normalText, loadingText) {
        var btn = document.getElementById(btnId);
        if (!btn) return;
        btn.disabled    = loading;
        btn.textContent = loading ? loadingText : normalText;
    }

    /* ══ STEP 1: Send OTP ══════════════════════════════════════════ */
    var sendForm = document.getElementById("fpSendForm");
    if (sendForm) {
        sendForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            showStatus("fpSendStatus", null, "");

            currentEmail = ((document.getElementById("fpEmail") || {}).value || "").trim();
            if (!currentEmail) {
                showStatus("fpSendStatus", "error", "يرجى إدخال البريد الإلكتروني.");
                return;
            }

            setBtnLoading("fpSendBtn", true, "إرسال رمز التحقق", "جاري الإرسال...");

            var res = await sb.auth.signInWithOtp({
                email: currentEmail
            });

            setBtnLoading("fpSendBtn", false, "إرسال رمز التحقق", "جاري الإرسال...");

            if (res.error) {
                var m = (res.error.message || "").toLowerCase();
                if (m.includes("rate") || m.includes("limit")) {
                    showStatus("fpSendStatus", "error", "تم إرسال رمز مؤخراً. انتظر قليلاً ثم حاول مجدداً.");
                } else {
                    showStatus("fpSendStatus", "error", res.error.message || "حدث خطأ غير معروف.");
                }
                return;
            }

            var sub = document.getElementById("fpStep2Sub");
            if (sub) sub.textContent = "تم إرسال رمز من 6 أرقام إلى: " + currentEmail;
            clearOtp();
            goStep(2);
            setTimeout(function () {
                var first = document.querySelector(".otp-digit");
                if (first) first.focus();
            }, 100);
        });
    }

    /* ══ OTP Input UX: auto-advance, backspace, paste ══════════════ */
    var otpRow = document.getElementById("otpRow");
    if (otpRow) {
        var digits = Array.from(otpRow.querySelectorAll(".otp-digit"));

        digits.forEach(function (input, idx) {
            input.addEventListener("input", function () {
                var val = input.value.replace(/\D/g, "");
                input.value = val.slice(-1);
                if (val && idx < digits.length - 1) digits[idx + 1].focus();
            });

            input.addEventListener("keydown", function (e) {
                if (e.key === "Backspace" && !input.value && idx > 0) digits[idx - 1].focus();
            });

            input.addEventListener("paste", function (e) {
                e.preventDefault();
                var pasted = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
                if (!pasted) return;
                digits.forEach(function (d, i) { d.value = pasted[i] || ""; });
                digits[Math.min(pasted.length, digits.length) - 1].focus();
            });
        });
    }

    function clearOtp() {
        document.querySelectorAll(".otp-digit").forEach(function (b) { b.value = ""; });
    }

    function getOtpValue() {
        return Array.from(document.querySelectorAll(".otp-digit")).map(function (b) { return b.value; }).join("");
    }

    /* ══ STEP 2: Verify OTP ════════════════════════════════════════ */
    var verifyBtn = document.getElementById("fpVerifyBtn");
    if (verifyBtn) {
        verifyBtn.addEventListener("click", async function () {
            showStatus("fpVerifyStatus", null, "");
            var code = getOtpValue();
            if (code.length < 8) {
                showStatus("fpVerifyStatus", "error", "يرجى إدخال جميع أرقام الرمز.");
                return;
            }

            setBtnLoading("fpVerifyBtn", true, "التحقق من الرمز", "جاري التحقق...");

            var res = await sb.auth.verifyOtp({ email: currentEmail, token: code, type: "email" });

            setBtnLoading("fpVerifyBtn", false, "التحقق من الرمز", "جاري التحقق...");

            if (res.error) {
                var m = (res.error.message || "").toLowerCase();
                if (m.includes("expired") || m.includes("invalid") || m.includes("otp")) {
                    showStatus("fpVerifyStatus", "error", "الرمز غير صحيح أو انتهت صلاحيته. يمكنك إعادة الإرسال.");
                } else {
                    showStatus("fpVerifyStatus", "error", "حدث خطأ أثناء التحقق. حاول مجدداً.");
                }
                return;
            }

            goStep(3);
        });
    }

    /* ── Resend OTP ── */
    var resendBtn = document.getElementById("fpResendBtn");
    if (resendBtn) {
        resendBtn.addEventListener("click", async function () {
            if (!currentEmail) { goStep(1); return; }
            resendBtn.disabled   = true;
            resendBtn.textContent = "جاري الإرسال...";
            await sb.auth.signInWithOtp({ email: currentEmail, options: { shouldCreateUser: false } });
            resendBtn.textContent = "تم الإرسال ✓";
            clearOtp();
            setTimeout(function () {
                resendBtn.disabled    = false;
                resendBtn.textContent = "إعادة الإرسال";
                showStatus("fpVerifyStatus", null, "");
            }, 6000);
        });
    }

    /* ══ STEP 3: Set new password ══════════════════════════════════ */
    var newPassForm = document.getElementById("fpNewPassForm");
    if (newPassForm) {
        newPassForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            showStatus("fpNewPassStatus", null, "");

            var pwd  = ((document.getElementById("fpNewPwd")     || {}).value || "");
            var conf = ((document.getElementById("fpConfirmPwd") || {}).value || "");

            if (!pwd || pwd.length < 6) {
                showStatus("fpNewPassStatus", "error", "كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
                return;
            }
            if (pwd !== conf) {
                showStatus("fpNewPassStatus", "error", "كلمتا المرور غير متطابقتين.");
                return;
            }

            setBtnLoading("fpSaveBtn", true, "حفظ كلمة المرور الجديدة", "جاري الحفظ...");

            var res = await sb.auth.updateUser({ password: pwd });

            if (res.error) {
                setBtnLoading("fpSaveBtn", false, "حفظ كلمة المرور الجديدة", "");
                showStatus("fpNewPassStatus", "error", "تعذّر الحفظ: " + (res.error.message || ""));
                return;
            }

            /* Sign out the OTP session; user will log in with new password */
            await sb.auth.signOut();

            showStatus("fpNewPassStatus", "success", "✓ تم تغيير كلمة المرور بنجاح! جاري التوجيه...");
            setBtnLoading("fpSaveBtn", false, "حفظ كلمة المرور الجديدة", "");

            setTimeout(function () {
                window.location.href = "seeker-login.html";
            }, 1800);
        });
    }
}
