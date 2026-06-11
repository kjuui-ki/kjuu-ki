/**
 * بعد الدفع — تسجيل المستخدم في الدورات ومسح السلة
 */
(function () {
    "use strict";

    function t(key) {
        var lang = localStorage.getItem("maherLang") || "ar";
        var dict = (window.maherTranslations || {})[lang] || (window.maherTranslations || {}).ar || {};
        return dict[key] !== undefined ? dict[key] : key;
    }

    function esc(v) {
        return String(v || "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function waitForSupabase(ms) {
        if (window.supabaseClient) return Promise.resolve(window.supabaseClient);
        return new Promise(function (resolve) {
            var done = false;
            function finish() {
                if (done) return;
                done = true;
                resolve(window.supabaseClient || null);
            }
            document.addEventListener("maherSupabaseReady", finish, { once: true });
            setTimeout(finish, ms || 5000);
        });
    }

    function readPendingOrder() {
        try {
            var raw = sessionStorage.getItem("maherPendingOrder");
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    async function enrollCourses(sb, userId, courseIds) {
        var enrolled = [];
        var errors = [];
        for (var i = 0; i < courseIds.length; i++) {
            var cid = courseIds[i];
            var res = await sb.from("course_enrollments").insert({
                course_id: cid,
                user_id: userId,
                enrolled_by: userId
            });
            if (!res.error || res.error.code === "23505") {
                enrolled.push(cid);
            } else {
                errors.push(res.error.message || cid);
            }
        }
        return { enrolled: enrolled, errors: errors };
    }

    async function saveOrder(sb, userId, order, paymentId) {
        if (!sb || !order) return;
        var courseIds = (order.items || []).map(function (x) { return x.id; });
        await sb.from("course_orders").insert({
            user_id: userId,
            total_amount: order.total || 0,
            currency: "SAR",
            payment_provider: "moyasar",
            payment_id: paymentId || null,
            payment_status: "paid",
            course_ids: courseIds,
            metadata: { source: "checkout-success" }
        });
    }

    document.addEventListener("DOMContentLoaded", async function () {
        var params = new URLSearchParams(window.location.search);
        var paymentId = params.get("id") || params.get("payment_id") || "";
        var order = readPendingOrder();
        var bodyEl = document.getElementById("checkoutSuccessBody");
        var listEl = document.getElementById("checkoutSuccessCourses");
        var titleEl = document.getElementById("checkoutSuccessTitle");

        if (!order || !order.items || !order.items.length) {
            if (titleEl) titleEl.textContent = t("checkout.successNoOrder");
            if (bodyEl) bodyEl.textContent = t("checkout.successNoOrderBody");
            return;
        }

        var sb = await waitForSupabase();
        var user = null;
        if (sb) {
            var userRes = await sb.auth.getUser();
            user = userRes.data && userRes.data.user ? userRes.data.user : null;
        }

        if (!user) {
            if (bodyEl) {
                bodyEl.innerHTML = t("checkout.loginToFinish") +
                    ' <a href="login.html?next=' + encodeURIComponent(window.location.pathname + window.location.search) + '">' +
                    esc(t("nav.login")) + "</a>";
            }
            return;
        }

        var courseIds = order.items.map(function (x) { return x.id; });
        var result = { enrolled: courseIds, errors: [] };
        if (sb) {
            result = await enrollCourses(sb, user.id, courseIds);
            try {
                await saveOrder(sb, user.id, order, paymentId);
            } catch (e) { /* جدول الطلبات اختياري */ }
        }

        window.maherCart.clearCart();
        sessionStorage.removeItem("maherPendingOrder");
        sessionStorage.removeItem("maherPaymentCompleted");

        if (listEl) {
            listEl.innerHTML = "<ul>" + order.items.map(function (item) {
                var ok = result.enrolled.indexOf(item.id) !== -1;
                return "<li>" + esc(item.title) + (ok ? " ✓" : "") + "</li>";
            }).join("") + "</ul>";
        }

        if (bodyEl) {
            bodyEl.textContent = result.errors.length
                ? t("checkout.successPartial")
                : t("checkout.successEnrolled");
        }
    });
})();
