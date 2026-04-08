document.addEventListener("DOMContentLoaded", async function () {
    const form = document.getElementById("resetPasswordForm");
    const statusBox = document.getElementById("resetPasswordStatus");
    const submitBtn = document.getElementById("resetPasswordBtn");

    if (!form || !statusBox || !submitBtn) return;

    function setStatus(type, message) {
        statusBox.classList.remove("form-status-error", "form-status-success");
        if (!message) {
            statusBox.style.display = "none";
            statusBox.textContent = "";
            return;
        }
        statusBox.textContent = message;
        statusBox.style.display = "block";
        if (type === "error") {
            statusBox.classList.add("form-status-error");
        } else if (type === "success") {
            statusBox.classList.add("form-status-success");
        }
    }

    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        submitBtn.textContent = isLoading ? "جاري التحديث..." : "تغيير كلمة المرور";
    }

    if (typeof supabaseClient === "undefined" || !supabaseClient) {
        setStatus("error", "تعذر الاتصال بالخدمة.");
        return;
    }

    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const session = sessionData && sessionData.session;
        if (!session) {
            setStatus("error", "رابط إعادة التعيين غير صالح أو منتهي. أعد طلب رابط جديد.");
            setLoading(true);
            return;
        }
    } catch (error) {
        setStatus("error", "تعذر التحقق من الجلسة. حاول مرة أخرى.");
        return;
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        setStatus(null, "");

        const newPasswordInput = document.getElementById("newPassword");
        const confirmPasswordInput = document.getElementById("confirmPassword");

        const newPassword = newPasswordInput ? newPasswordInput.value : "";
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : "";

        if (!newPassword || !confirmPassword) {
            setStatus("error", "يرجى تعبئة الحقول المطلوبة.");
            return;
        }

        if (newPassword.length < 6) {
            setStatus("error", "كلمة المرور قصيرة، يجب أن تكون 6 أحرف على الأقل.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setStatus("error", "تأكيد كلمة المرور غير متطابق.");
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabaseClient.auth.updateUser({
                password: newPassword
            });

            if (error) {
                setStatus("error", error.message || "تعذر تغيير كلمة المرور.");
                setLoading(false);
                return;
            }

            setStatus("success", "تم تغيير كلمة المرور");
            setTimeout(function () {
                window.location.href = "login.html";
            }, 1200);
        } catch (error) {
            setStatus("error", "حدث خطأ أثناء تغيير كلمة المرور.");
            setLoading(false);
        }
    });
});
