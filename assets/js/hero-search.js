/**
 * hero-search.js — Live autocomplete search for the homepage hero.
 * Depends on window.supabaseClient (set by auth.js via defer).
 */
(function () {
    "use strict";

    var input      = document.getElementById("ssb-keyword");
    var citySelect = document.getElementById("ssb-city");
    var dropdown   = document.getElementById("ssb-dropdown");
    var submitBtn  = document.getElementById("ssb-submit");

    if (!input || !dropdown || !submitBtn) return;

    var debounceTimer = null;
    var allJobs       = [];
    var companyMap    = {};   /* company_id → full_name */
    var ready         = false;

    /* ── Security helpers ─────────────────────────────────────────── */
    function esc(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /* ── Prefetch jobs (runs once after Supabase is ready) ─────────── */
    async function prefetch() {
        var sb = window.supabaseClient;
        if (!sb) return;

        try {
            var res = await sb
                .from("jobs")
                .select("id, title, location, job_type, company_id")
                .order("created_at", { ascending: false })
                .limit(200);

            if (!res.data || res.data.length === 0) { ready = true; return; }
            allJobs = res.data;

            var ids = [];
            allJobs.forEach(function (j) {
                if (j.company_id && ids.indexOf(j.company_id) === -1) ids.push(j.company_id);
            });

            if (ids.length > 0) {
                var profRes = await sb
                    .from("profiles")
                    .select("id, full_name")
                    .in("id", ids);
                if (Array.isArray(profRes.data)) {
                    profRes.data.forEach(function (p) { companyMap[p.id] = p.full_name || ""; });
                }
            }

            ready = true;
        } catch (e) {
            ready = true;
        }
    }

    /* ── Filter helper ─────────────────────────────────────────────── */
    function filterJobs(keyword, city) {
        var k = (keyword || "").trim().toLowerCase();
        var c = (city || "").trim();
        return allJobs.filter(function (j) {
            var titleOk   = !k || (j.title || "").toLowerCase().includes(k)
                                || (companyMap[j.company_id] || "").toLowerCase().includes(k);
            var cityOk    = !c || (j.location || "").includes(c);
            return titleOk && cityOk;
        });
    }

    /* ── Render dropdown ───────────────────────────────────────────── */
    function renderDropdown(jobs) {
        if (!jobs.length) {
            dropdown.innerHTML = '<div class="ssb-no-results">لا توجد نتائج مطابقة</div>';
            dropdown.hidden = false;
            return;
        }

        var topFive = jobs.slice(0, 5);
        var html = topFive.map(function (job) {
            var company  = esc(companyMap[job.company_id] || "");
            var location = esc(job.location || "");
            var type     = esc(job.job_type  || "");
            var href     = "apply.html?job_id=" + encodeURIComponent(job.id);

            return '<div class="ssb-result" data-href="' + href + '">'
                + '<div class="ssb-result-icon">💼</div>'
                + '<div class="ssb-result-content">'
                + '<div class="ssb-result-title">' + esc(job.title) + '</div>'
                + '<div class="ssb-result-meta">'
                + (company  ? company  : "")
                + (location ? " &bull; " + location : "")
                + '</div>'
                + '</div>'
                + (type ? '<span class="ssb-result-badge">' + type + '</span>' : '')
                + '</div>';
        }).join("");

        if (jobs.length > 5) {
            html += '<div class="ssb-result-all" id="ssb-view-all">'
                  + '← عرض كل النتائج (' + jobs.length + ')'
                  + '</div>';
        }

        dropdown.innerHTML = html;
        dropdown.hidden = false;

        dropdown.querySelectorAll(".ssb-result").forEach(function (el) {
            el.addEventListener("click", function () {
                window.location.href = el.getAttribute("data-href");
            });
        });

        var viewAll = document.getElementById("ssb-view-all");
        if (viewAll) {
            viewAll.addEventListener("click", navigate);
        }
    }

    /* ── Navigate to jobs.html with filters ──────────────────────── */
    function navigate() {
        dropdown.hidden = true;
        var k = input.value.trim();
        var c = citySelect ? citySelect.value : "";
        var url = "jobs.html";
        var p   = [];
        if (k) p.push("q="    + encodeURIComponent(k));
        if (c) p.push("city=" + encodeURIComponent(c));
        if (p.length) url += "?" + p.join("&");
        window.location.href = url;
    }

    /* ── Input event — live search ────────────────────────────────── */
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
            renderDropdown(filterJobs(val, citySelect ? citySelect.value : ""));
        }, 260);
    });

    /* ── Keyboard ──────────────────────────────────────────────────── */
    input.addEventListener("keydown", function (e) {
        if (e.key === "Enter")  { e.preventDefault(); navigate(); }
        if (e.key === "Escape") { dropdown.hidden = true; }
    });

    /* ── Submit button ─────────────────────────────────────────────── */
    submitBtn.addEventListener("click", navigate);

    /* ── City change — refresh dropdown if open ───────────────────── */
    if (citySelect) {
        citySelect.addEventListener("change", function () {
            var val = input.value.trim();
            if (val && ready && !dropdown.hidden) {
                renderDropdown(filterJobs(val, citySelect.value));
            }
        });
    }

    /* ── Close on outside click ────────────────────────────────────── */
    document.addEventListener("click", function (e) {
        if (!e.target.closest("#smartSearchBox")) { dropdown.hidden = true; }
    });

    /* ── Quick-tag chips ───────────────────────────────────────────── */
    var box = document.getElementById("smartSearchBox");
    if (box) {
        box.querySelectorAll(".ssb-tag").forEach(function (tag) {
            tag.addEventListener("click", function () {
                input.value = tag.getAttribute("data-value");
                input.focus();
                if (ready) renderDropdown(filterJobs(input.value, citySelect ? citySelect.value : ""));
            });
        });
    }

    /* ── Start prefetch when Supabase client is ready ─────────────── */
    function tryPrefetch() {
        if (window.supabaseClient) { prefetch(); }
        else { setTimeout(tryPrefetch, 150); }
    }
    tryPrefetch();

})();
