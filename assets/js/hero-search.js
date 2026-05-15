/**
 * hero-search.js — بحث الدورات والدبلومات من الصفحة الرئيسية
 */
(function () {
    "use strict";

    var input      = document.getElementById("ssb-keyword");
    var dropdown   = document.getElementById("ssb-dropdown");
    var submitBtn  = document.getElementById("ssb-submit");

    if (!input || !dropdown || !submitBtn) return;

    var debounceTimer = null;
    var allCourses    = [];
    var pathNameById  = {};
    var ready         = false;

    function esc(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function courseIcon(cat) {
        if (!cat) return "📚";
        var c = cat.toLowerCase();
        if (c.indexOf("تقن") !== -1 || c.indexOf("it") !== -1) return "💻";
        if (c.indexOf("مال") !== -1 || c.indexOf("محاس") !== -1) return "💰";
        if (c.indexOf("موارد") !== -1 || c.indexOf("hr") !== -1) return "👥";
        if (c.indexOf("قياد") !== -1) return "🎯";
        return "📚";
    }

    async function prefetch() {
        var sb = window.supabaseClient;
        if (!sb) return;

        try {
            var res = await sb
                .from("courses")
                .select("id, title, description, category, instructor, training_path_id, training_paths(name_ar)")
                .eq("is_active", true)
                .order("created_at", { ascending: false })
                .limit(250);

            if (res.error) {
                var fallback = await sb
                    .from("courses")
                    .select("id, title, description, category, instructor, training_path_id")
                    .eq("is_active", true)
                    .order("created_at", { ascending: false })
                    .limit(250);
                allCourses = fallback.data || [];
            } else {
                allCourses = res.data || [];
            }
            if (!allCourses.length && window.maherDefaultCourses && window.maherDefaultCourses.length) {
                allCourses = window.maherDefaultCourses.slice();
            }

            pathNameById = {};
            (window.maherDefaultTrainingPaths || []).forEach(function (p) {
                pathNameById[p.id] = p.name_ar;
            });
            allCourses.forEach(function (c) {
                if (c.training_paths && c.training_paths.name_ar) {
                    pathNameById[c.training_path_id] = c.training_paths.name_ar;
                }
            });

            ready = true;
        } catch (e) {
            ready = true;
        }
    }

    function pathLabel(c) {
        var id = c.training_path_id;
        if (!id) return c.category || "";
        return pathNameById[id] || c.category || "";
    }

    function filterCourses(keyword) {
        var k = (keyword || "").trim().toLowerCase();
        return allCourses.filter(function (c) {
            if (!k) return true;
            var pn = pathLabel(c);
            return (c.title && c.title.toLowerCase().includes(k)) ||
                (c.description && c.description.toLowerCase().includes(k)) ||
                (c.category && c.category.toLowerCase().includes(k)) ||
                (c.instructor && c.instructor.toLowerCase().includes(k)) ||
                (pn && pn.toLowerCase().includes(k));
        });
    }

    function renderDropdown(list) {
        if (!list.length) {
            dropdown.innerHTML = '<div class="ssb-no-results">لا توجد نتائج مطابقة</div>';
            dropdown.hidden = false;
            return;
        }

        var top = list.slice(0, 20);
        var html = '<div class="ssb-dropdown-head">نتائج البحث (' + list.length + ")</div>";
        html += top.map(function (c) {
            var path = pathLabel(c);
            var href = "job-details.html?course_id=" + encodeURIComponent(c.id);
            return '<div class="ssb-result" role="option" tabindex="0" data-href="' + href + '">'
                + '<div class="ssb-result-icon" aria-hidden="true">' + courseIcon(c.category) + '</div>'
                + '<div class="ssb-result-content">'
                + '<div class="ssb-result-title">' + esc(c.title) + '</div>'
                + (path ? '<div class="ssb-result-path">' + esc(path) + '</div>' : '')
                + (c.instructor ? '<div class="ssb-result-meta">' + esc(c.instructor) + '</div>' : '')
                + '</div>'
                + '<div class="ssb-result-arrow" aria-hidden="true">←</div>'
                + '</div>';
        }).join("");

        if (list.length > 20) {
            html += '<div class="ssb-result-all" id="ssb-view-all" role="button" tabindex="0">'
                + 'عرض كل النتائج (' + list.length + ')'
                + '</div>';
        }

        dropdown.innerHTML = html;
        dropdown.hidden = false;

        dropdown.querySelectorAll(".ssb-result").forEach(function (el) {
            function go() { window.location.href = el.getAttribute("data-href"); }
            el.addEventListener("click", go);
            el.addEventListener("keydown", function (e) {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
            });
        });

        var viewAll = document.getElementById("ssb-view-all");
        if (viewAll) {
            viewAll.addEventListener("click", navigate);
            viewAll.addEventListener("keydown", function (e) {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(); }
            });
        }
    }

    function navigate() {
        dropdown.hidden = true;
        var k = input.value.trim();
        var url = "courses.html";
        if (k) url += "?q=" + encodeURIComponent(k);
        window.location.href = url;
    }

    input.addEventListener("input", function () {
        var val = input.value.trim();
        clearTimeout(debounceTimer);

        if (!val) { dropdown.hidden = true; return; }

        if (!ready) {
            dropdown.innerHTML = '<div class="ssb-dropdown-loading">جاري التحميل…</div>';
            dropdown.hidden = false;
            return;
        }

        dropdown.innerHTML = '<div class="ssb-dropdown-loading">جاري البحث…</div>';
        dropdown.hidden = false;

        debounceTimer = setTimeout(function () {
            renderDropdown(filterCourses(val));
        }, 200);
    });

    input.addEventListener("keydown", function (e) {
        if (e.key === "Enter")  { e.preventDefault(); navigate(); }
        if (e.key === "Escape") { dropdown.hidden = true; }
    });

    submitBtn.addEventListener("click", navigate);

    document.addEventListener("click", function (e) {
        if (!e.target.closest("#smartSearchBox")) { dropdown.hidden = true; }
    });

    var box = document.getElementById("smartSearchBox");
    if (box) {
        box.querySelectorAll(".ssb-tag").forEach(function (tag) {
            tag.addEventListener("click", function () {
                input.value = tag.getAttribute("data-value");
                input.focus();
                if (ready) renderDropdown(filterCourses(input.value));
            });
        });
    }

    function startPrefetch() {
        if (window.supabaseClient) prefetch();
        else document.addEventListener("maherSupabaseReady", prefetch, { once: true });
    }
    startPrefetch();

})();
