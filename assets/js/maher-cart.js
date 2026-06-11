/**
 * سلة المشتريات + مزامنة أسعار الدورات من لوحة التحكم
 */
(function (global) {
    "use strict";

    var CART_KEY = "maherCart";
    var PRICES_KEY = "maherCoursePrices";

    function readJson(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function isPaidCourse(c) {
        if (!c) return false;
        return c.price_type === "paid" && Number(c.price_amount) > 0;
    }

    function getCart() {
        return readJson(CART_KEY, []);
    }

    function saveCart(items) {
        writeJson(CART_KEY, items);
        refreshCartBadge();
        document.dispatchEvent(new CustomEvent("maherCartChanged"));
    }

    function getCartCount() {
        return getCart().length;
    }

    function getCartTotal() {
        return getCart().reduce(function (sum, item) {
            return sum + (Number(item.price_amount) || 0);
        }, 0);
    }

    function isInCart(courseId) {
        return getCart().some(function (x) { return x.id === courseId; });
    }

    function addToCart(course) {
        if (!course || !course.id) return { ok: false, reason: "invalid" };
        if (!isPaidCourse(course)) return { ok: false, reason: "free" };
        var items = getCart();
        if (items.some(function (x) { return x.id === course.id; })) {
            return { ok: false, reason: "exists" };
        }
        items.push({
            id: course.id,
            title: course.title || "",
            price_type: "paid",
            price_amount: Number(course.price_amount) || 0,
            content_type: course.content_type || "course",
            category: course.category || ""
        });
        saveCart(items);
        return { ok: true };
    }

    function removeFromCart(courseId) {
        saveCart(getCart().filter(function (x) { return x.id !== courseId; }));
    }

    function clearCart() {
        saveCart([]);
    }

    function applyStoredPrices(courses) {
        var prices = readJson(PRICES_KEY, {});
        if (!Array.isArray(courses)) return courses;
        return courses.map(function (c) {
            var p = prices[c.id];
            if (!p) return c;
            return Object.assign({}, c, {
                price_type: p.price_type || c.price_type,
                price_amount: p.price_amount != null ? p.price_amount : c.price_amount
            });
        });
    }

    function saveCoursePrice(courseId, priceType, priceAmount) {
        var prices = readJson(PRICES_KEY, {});
        prices[courseId] = {
            price_type: priceType === "paid" ? "paid" : "free",
            price_amount: priceType === "paid" && !isNaN(priceAmount) ? Number(priceAmount) : 0
        };
        writeJson(PRICES_KEY, prices);
    }

    function syncAllCoursePrices(courses) {
        if (!Array.isArray(courses)) return;
        var prices = readJson(PRICES_KEY, {});
        courses.forEach(function (c) {
            if (!c || !c.id) return;
            prices[c.id] = {
                price_type: c.price_type === "paid" ? "paid" : "free",
                price_amount: c.price_type === "paid" ? Number(c.price_amount) || 0 : 0
            };
        });
        writeJson(PRICES_KEY, prices);
    }

    function formatPrice(amount, lang) {
        var n = Number(amount) || 0;
        var sar = (lang === "en") ? "SAR" : "ر.س";
        return n.toLocaleString(lang === "en" ? "en-US" : "ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " " + sar;
    }

    function refreshCartBadge() {
        var count = getCartCount();
        document.querySelectorAll(".header-cart-count").forEach(function (el) {
            el.textContent = String(count);
            el.style.display = count > 0 ? "" : "none";
        });
        document.querySelectorAll(".header-cart-link").forEach(function (el) {
            el.classList.toggle("header-cart-link--has-items", count > 0);
        });
    }

    function initCartHeader() {
        if (document.body.classList.contains("maher-no-cart")) return;
        var headerInner = document.querySelector(".main-header .header-inner");
        if (!headerInner || document.getElementById("maherCartLink")) return;

        var lang = localStorage.getItem("maherLang") || "ar";
        var label = lang === "en" ? "Cart" : "السلة";

        var link = document.createElement("a");
        link.href = "checkout.html";
        link.id = "maherCartLink";
        link.className = "header-cart-link";
        link.setAttribute("aria-label", label);
        link.innerHTML =
            '<span class="header-cart-icon" aria-hidden="true">' +
                '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">' +
                    '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>' +
                    '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' +
                "</svg>" +
            "</span>" +
            '<span class="header-cart-label">' + label + "</span>" +
            '<span class="header-cart-count" style="display:none;">0</span>';

        var langSwitch = headerInner.querySelector(".lang-switch");
        if (langSwitch) {
            headerInner.insertBefore(link, langSwitch);
        } else {
            headerInner.appendChild(link);
        }
        refreshCartBadge();
    }

    global.maherCart = {
        getCart: getCart,
        saveCart: saveCart,
        addToCart: addToCart,
        removeFromCart: removeFromCart,
        clearCart: clearCart,
        getCartCount: getCartCount,
        getCartTotal: getCartTotal,
        isInCart: isInCart,
        isPaidCourse: isPaidCourse,
        applyStoredPrices: applyStoredPrices,
        saveCoursePrice: saveCoursePrice,
        syncAllCoursePrices: syncAllCoursePrices,
        formatPrice: formatPrice,
        refreshCartBadge: refreshCartBadge,
        initCartHeader: initCartHeader
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initCartHeader);
    } else {
        initCartHeader();
    }
    document.addEventListener("maherLangChanged", function () {
        var old = document.getElementById("maherCartLink");
        if (old) old.remove();
        initCartHeader();
    });
})(window);
