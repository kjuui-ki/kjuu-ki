/**
 * صفحة السلة والدفع — checkout.html
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
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function waitForSupabase(ms) {
        var limit = ms || 4000;
        if (window.supabaseClient) return Promise.resolve(window.supabaseClient);
        return new Promise(function (resolve) {
            var done = false;
            function finish() {
                if (done) return;
                done = true;
                resolve(window.supabaseClient || null);
            }
            document.addEventListener("maherSupabaseReady", finish, { once: true });
            setTimeout(finish, limit);
        });
    }

    function renderCartList(items) {
        var list = document.getElementById("checkoutCartList");
        var totalEl = document.getElementById("checkoutTotal");
        if (!list || !totalEl) return 0;

        var total = items.reduce(function (s, x) { return s + (Number(x.price_amount) || 0); }, 0);
        list.innerHTML = items.map(function (item) {
            return '<li class="checkout-cart-item" data-id="' + esc(item.id) + '">' +
                '<div class="checkout-cart-item-main">' +
                    '<strong>' + esc(item.title) + "</strong>" +
                    (item.category ? '<span class="checkout-cart-cat">' + esc(item.category) + "</span>" : "") +
                "</div>" +
                '<div class="checkout-cart-item-side">' +
                    '<span class="checkout-cart-price">' + esc(window.maherCart.formatPrice(item.price_amount)) + "</span>" +
                    '<button type="button" class="checkout-remove-btn" data-remove="' + esc(item.id) + '" aria-label="' + esc(t("checkout.remove")) + '">×</button>' +
                "</div>" +
            "</li>";
        }).join("");
        totalEl.textContent = window.maherCart.formatPrice(total);
        return total;
    }

    function buildCallbackUrl() {
        var cfg = window.maherPaymentConfig || {};
        var path = cfg.callbackPath || "checkout-success.html";
        if (path.indexOf("http") === 0) return path;
        var base = window.location.href.split("/").slice(0, -1).join("/");
        return base + "/" + path.replace(/^\//, "");
    }

    function initMoyasar(total) {
        var cfg = window.maherPaymentConfig || {};
        var formEl = document.getElementById("moyasarForm");
        var cfgMsg = document.getElementById("checkoutConfigMsg");
        if (!formEl) return;

        if (!cfg.enabled || !cfg.moyasarPublishableKey) {
            if (cfgMsg) {
                cfgMsg.style.display = "block";
                cfgMsg.textContent = t("checkout.configMissing");
            }
            formEl.innerHTML = '<p class="checkout-pay-placeholder">' + esc(t("checkout.configHint")) + "</p>";
            return;
        }

        if (typeof window.Moyasar === "undefined") {
            formEl.innerHTML = '<p class="checkout-pay-placeholder">' + esc(t("checkout.gatewayLoading")) + "</p>";
            return;
        }

        var amountHalalas = Math.max(100, Math.round(total * 100));
        var cart = window.maherCart.getCart();
        sessionStorage.setItem("maherPendingOrder", JSON.stringify({
            items: cart,
            total: total,
            ts: Date.now()
        }));

        try {
            window.Moyasar.init({
                element: formEl,
                amount: amountHalalas,
                currency: cfg.currency || "SAR",
                description: (cfg.storeName || "Maher Academy") + " — " + cart.length + " course(s)",
                publishable_api_key: cfg.moyasarPublishableKey,
                callback_url: buildCallbackUrl(),
                supported_networks: ["visa", "mastercard", "mada"],
                methods: ["creditcard", "applepay"],
                apple_pay: {
                    country: "SA",
                    label: cfg.storeName || "Maher Academy",
                    validate_merchant_url: "https://api.moyasar.com/v1/applepay/initiate"
                },
                on_completed: function () {
                    sessionStorage.setItem("maherPaymentCompleted", "1");
                }
            });
        } catch (e) {
            formEl.innerHTML = '<p class="checkout-pay-placeholder">' + esc(t("checkout.gatewayError")) + "</p>";
        }
    }

    async function ensureSeeker(sb) {
        var authMsg = document.getElementById("checkoutAuthMsg");
        var userRes = await sb.auth.getUser();
        var user = userRes.data && userRes.data.user ? userRes.data.user : null;
        if (!user) {
            if (authMsg) {
                authMsg.style.display = "block";
                authMsg.innerHTML = t("checkout.loginRequired") +
                    ' <a href="login.html?next=' + encodeURIComponent("checkout.html") + '">' + esc(t("nav.login")) + "</a>";
            }
            return null;
        }
        var prof = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
        var role = prof.data ? prof.data.role : "";
        if (role !== "job_seeker") {
            if (authMsg) {
                authMsg.style.display = "block";
                authMsg.textContent = t("paths.enrollSeekerOnly");
            }
            return null;
        }
        if (authMsg) authMsg.style.display = "none";
        return user;
    }

    function showCheckoutUi(items) {
        var empty = document.getElementById("checkoutEmptyMsg");
        var main = document.getElementById("checkoutMain");
        if (!items.length) {
            if (empty) empty.style.display = "block";
            if (main) main.style.display = "none";
            return;
        }
        if (empty) empty.style.display = "none";
        if (main) main.style.display = "grid";
        var total = renderCartList(items);
        initMoyasar(total);
    }

    document.addEventListener("DOMContentLoaded", async function () {
        var year = document.getElementById("year");
        if (year) year.textContent = String(new Date().getFullYear());

        var items = window.maherCart.getCart();
        showCheckoutUi(items);

        var cartListEl = document.getElementById("checkoutCartList");
        if (cartListEl) {
            cartListEl.addEventListener("click", function (e) {
                var btn = e.target.closest("[data-remove]");
                if (!btn) return;
                window.maherCart.removeFromCart(btn.getAttribute("data-remove"));
                items = window.maherCart.getCart();
                showCheckoutUi(items);
            });
        }

        var sb = await waitForSupabase();
        if (sb) await ensureSeeker(sb);

        document.addEventListener("maherCartChanged", function () {
            items = window.maherCart.getCart();
            showCheckoutUi(items);
        });

        document.addEventListener("maherLangChanged", function () {
            items = window.maherCart.getCart();
            showCheckoutUi(items);
        });
    });
})();
