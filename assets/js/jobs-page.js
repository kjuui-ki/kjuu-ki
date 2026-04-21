document.addEventListener("DOMContentLoaded", async function () {
    "use strict";
    var jobsGrid    = document.getElementById("jobsCardsGrid");
    var resultsInfo = document.getElementById("jobsResultsInfo");
    var searchInput = document.getElementById("jobsSearchInput");
    var typeFilter  = document.getElementById("jobsTypeFilter");
    var cityFilter  = document.getElementById("jobsCityFilter");

    if (!jobsGrid) return;

    /* ── Pre-fill from URL params ───────────────────────────── */
    var urlParams = new URLSearchParams(window.location.search);
    var initQ     = (urlParams.get("q")    || "").trim();
    var initCity  = (urlParams.get("city") || "").trim();
    if (searchInput && initQ)    searchInput.value = initQ;
    if (cityFilter  && initCity) cityFilter.value  = initCity;

    /* ── Show skeleton immediately ────────────────────────────────── */
    function showSkeleton() {
        var html = "";
        for (var i = 0; i < 6; i++) {
            html += '<div class="skeleton-card">'
                + '<div class="skeleton-line skeleton-logo"></div>'
                + '<div class="skeleton-line skeleton-title"></div>'
                + '<div class="skeleton-line skeleton-sub"></div>'
                + '<div class="skeleton-line skeleton-text"></div>'
                + '<div class="skeleton-line skeleton-text"></div>'
                + '<div class="skeleton-line skeleton-text"></div>'
                + '<div class="skeleton-footer">'
                + '<div class="skeleton-line skeleton-badge"></div>'
                + '<div class="skeleton-line skeleton-badge"></div>'
                + '<div class="skeleton-line skeleton-btn"></div>'
                + '</div>'
                + '</div>';
        }
        jobsGrid.innerHTML = html;
    }

    showSkeleton();

    if (typeof supabaseClient === "undefined" || !supabaseClient) {
        jobsGrid.innerHTML = "<p>تعذر الاتصال بقاعدة البيانات.</p>";
        return;
    }

    /* ── Helpers ────────────────────────────────────────── */
    function escapeText(v) {
        return String(v || "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function formatSnippet(text) {
        var raw = String(text || "").trim();
        if (!raw) return "";
        return raw.length > 160 ? raw.slice(0, 160).trim() + "..." : raw;
    }

    function getDiffDays(ts) {
        if (!ts) return 999;
        try { return Math.floor((new Date() - new Date(ts)) / 86400000); } catch (e) { return 999; }
    }

    function getDateLabel(ts) {
        var d = getDiffDays(ts);
        if (d === 0)  return "اليوم";
        if (d === 1)  return "أمس";
        if (d < 7)    return "منذ " + d + " أيام";
        if (d < 30)   return "منذ " + Math.floor(d / 7) + " أسابيع";
        return "منذ " + Math.floor(d / 30) + " شهر";
    }

    function getTypeKey(jobType) {
        var t = (jobType || "").toLowerCase();
        if (t.includes("كامل") || t.includes("full"))          return "full";
        if (t.includes("جزئي") || t.includes("part"))          return "part";
        if (t.includes("عن بعد") || t.includes("remote"))    return "remote";
        return "default";
    }

    /* ── Stored data ─────────────────────────────────────── */
    var allJobs       = [];
    var companyMap    = new Map();
    var appliedJobIds = new Set();
    var userRole      = null;

    /* ── Render cards ────────────────────────────────────── */
    function renderJobs(list) {
        if (resultsInfo) {
            resultsInfo.textContent = list.length ? list.length + " وظيفة متاحة" : "";
        }

        if (!list.length) {
            jobsGrid.innerHTML =
                '<div class="jobs-empty">'
                + '<div class="jobs-empty-icon">🔍</div>'
                + '<p>لا توجد وظائف تطابق بحثك</p>'
                + '</div>';
            return;
        }

        jobsGrid.innerHTML = "";
        list.forEach(function (job) {
            var card       = document.createElement("article");
            card.className = "job-card-modern";

            var cName     = companyMap.get(job.company_id) || "شركة";
            var location  = job.location || "";
            var jobType   = job.job_type || "";
            var snippet   = formatSnippet(job.description || job.requirements || "");
            var isApplied = userRole === "job_seeker" && appliedJobIds.has(job.id);
            var initials  = escapeText(cName.trim().charAt(0) || "ش");
            var diff      = getDiffDays(job.created_at);
            var dateLabel = getDateLabel(job.created_at);
            var isNew     = diff <= 3;
            var typeKey   = getTypeKey(jobType);

            card.innerHTML =
                '<div class="jcm-stripe jcm-stripe-' + typeKey + '"></div>'
                + '<div class="jcm-header">'
                +   '<div class="jcm-logo jcm-logo-' + typeKey + '">' + initials + '</div>'
                +   '<div class="jcm-meta">'
                +     '<div class="jcm-meta-top">'
                +       '<h3 class="jcm-title">' + escapeText(job.title || "بدون عنوان") + '</h3>'
                +       (isNew ? '<span class="jcm-new-badge">جديد ✨</span>' : '')
                +     '</div>'
                +     '<div class="jcm-company">' + escapeText(cName) + '</div>'
                +   '</div>'
                +   (dateLabel ? '<span class="jcm-date">' + escapeText(dateLabel) + '</span>' : '')
                + '</div>'
                + (snippet ? '<p class="jcm-excerpt">' + escapeText(snippet) + '</p>' : '')
                + '<div class="jcm-tags">'
                +   (location ? '<span class="jcm-tag jcm-tag-loc">'
                    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 13 6 13s6-7.75 6-13c0-3.314-2.686-6-6-6z"/><circle cx="12" cy="8" r="2"/></svg>'
                    + escapeText(location) + '</span>' : '')
                +   (jobType ? '<span class="jcm-tag jtype-' + typeKey + '">' + escapeText(jobType) + '</span>' : '')
                + '</div>'
                + '<div class="jcm-footer">'
                +   '<a href="apply.html?job_id=' + encodeURIComponent(job.id) + '"'
                +   ' class="jcm-apply-btn' + (isApplied ? ' is-applied"' : '"')
                +   (isApplied ? ' aria-disabled="true"' : '') + '>'
                +   (isApplied
                        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> تم التقديم'
                        : 'تقديم <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>')
                +   '</a>'
                + '</div>';

            jobsGrid.appendChild(card);
        });
    }

    /* ── Client-side filter ────────────────────────────────── */
    function applyFilters() {
        var q    = searchInput ? searchInput.value.trim().toLowerCase() : "";
        var type = typeFilter  ? typeFilter.value  : "";
        var city = cityFilter  ? cityFilter.value  : "";

        var filtered = allJobs.filter(function (job) {
            var cName = companyMap.get(job.company_id) || "";
            return (!q    || (job.title    || "").toLowerCase().includes(q) || cName.toLowerCase().includes(q))
                && (!type || (job.job_type || "").includes(type))
                && (!city || (job.location || "").includes(city));
        });

        renderJobs(filtered);
    }

    if (searchInput) searchInput.addEventListener("input",  applyFilters);
    if (typeFilter)  typeFilter.addEventListener("change",  applyFilters);
    if (cityFilter)  cityFilter.addEventListener("change",  applyFilters);

    /* ── Load data ─────────────────────────────────────── */
    try {
        var authData = await supabaseClient.auth.getUser();
        var user     = authData.data && authData.data.user ? authData.data.user : null;

        if (user) {
            try {
                var pRes = await supabaseClient
                    .from("profiles").select("role").eq("id", user.id).single();
                if (pRes.data && pRes.data.role) {
                    userRole = String(pRes.data.role).trim().toLowerCase();
                }
            } catch (e) {}
        }

        var jobsRes = await supabaseClient
            .from("jobs")
            .select("id, title, description, requirements, location, job_type, company_id, created_at")
            .order("created_at", { ascending: false });

        if (jobsRes.error) {
            jobsGrid.innerHTML = '<p style="color:rgba(255,255,255,0.7);padding:2rem;text-align:center;">حدث خطأ أثناء جلب الوظائف.</p>';
            return;
        }

        if (!jobsRes.data || jobsRes.data.length === 0) {
            jobsGrid.innerHTML =
                '<div class="jobs-empty">'
                + '<div class="jobs-empty-icon">💼</div>'
                + '<p>لا توجد وظائف متاحة حاليًا.</p>'
                + '</div>';
            return;
        }

        allJobs = jobsRes.data;

        /* Company names */
        var companyIds = [];
        allJobs.forEach(function (j) {
            if (j.company_id && companyIds.indexOf(j.company_id) === -1) companyIds.push(j.company_id);
        });
        if (companyIds.length) {
            var compRes = await supabaseClient
                .from("profiles").select("id, full_name").in("id", companyIds);
            if (Array.isArray(compRes.data)) {
                compRes.data.forEach(function (c) {
                    if (c && c.id) companyMap.set(c.id, c.full_name || "");
                });
            }
        }

        /* Applied jobs for seekers */
        if (userRole === "job_seeker" && user) {
            var appRes = await supabaseClient
                .from("applications").select("job_id").eq("user_id", user.id);
            if (Array.isArray(appRes.data)) {
                appRes.data.forEach(function (a) {
                    if (a && a.job_id) appliedJobIds.add(a.job_id);
                });
            }
        }

        applyFilters();

    } catch (err) {
        console.error("Error loading jobs:", err);
        jobsGrid.innerHTML = '<p style="color:rgba(255,255,255,0.7);padding:2rem;text-align:center;">حدث خطأ غير متوقع.</p>';
    }
});
