"use strict";

document.addEventListener("DOMContentLoaded", async function () {

    var sb = window.supabaseClient;
    if (!sb) return;

    /* auth guard */
    var userRes = await sb.auth.getUser();
    var user = userRes.data && userRes.data.user ? userRes.data.user : null;
    if (!user) { window.location.href = "login.html"; return; }

    var profRes = await sb.from("profiles").select("role, full_name, email").eq("id", user.id).single();
    var profile = profRes.data;
    if (!profile || profile.role !== "super_admin") { window.location.href = "index.html"; return; }

    /* ── Primary admin lock ────────────────────────────────────── */
    var SUPER_PRIMARY_EMAIL = "kramabid1@gmail.com";
    var isSuperPrimary = (user.email === SUPER_PRIMARY_EMAIL);

    var displayName = profile.full_name || profile.email || user.email || "Admin";
    var nameEl = document.getElementById("adminName");
    if (nameEl) nameEl.textContent = displayName;

    /* ── Sidebar + topbar names ───────────────────────────── */
    var sidebarName = document.getElementById("sidebarAdminName");
    if (sidebarName) sidebarName.textContent = displayName;
    var topbarName = document.getElementById("admTopbarName");
    if (topbarName) topbarName.textContent = displayName;
    var adminInitial = (displayName || "م")[0];
    var sidebarInitEl = document.getElementById("sidebarAdminInitials");
    if (sidebarInitEl) sidebarInitEl.textContent = adminInitial;
    var topbarInitEl = document.getElementById("admTopbarInitials");
    if (topbarInitEl) topbarInitEl.textContent = adminInitial;

    /* ── Date ─────────────────────────────────────────────── */
    var dateEl = document.getElementById("admPageDate");
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString("ar-SA", {
            weekday: "long", year: "numeric", month: "long", day: "numeric"
        });
    }

    /* ── Logout ───────────────────────────────────────────── */
    var logoutBtn = document.getElementById("admLogoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async function () {
            logoutBtn.disabled = true;
            logoutBtn.textContent = "جاري الخروج...";
            await sb.auth.signOut();
            window.location.href = "index.html";
        });
    }

    /* ── Refresh ──────────────────────────────────────────── */
    var refreshBtn = document.getElementById("admRefreshBtn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", function () {
            refreshBtn.style.opacity = "0.5";
            loadAll().then(function () { refreshBtn.style.opacity = ""; });
        });
    }

    /* ── Mobile sidebar toggle ────────────────────────────── */
    var _sidebar  = document.getElementById("admSidebar");
    var _overlay  = document.getElementById("admOverlay");
    var toggleBtn = document.getElementById("admSidebarToggle");
    function _openSidebar()  { if (_sidebar) _sidebar.classList.add("open"); if (_overlay) _overlay.classList.add("open"); }
    function _closeSidebar() { if (_sidebar) _sidebar.classList.remove("open"); if (_overlay) _overlay.classList.remove("open"); }
    if (toggleBtn) toggleBtn.addEventListener("click", _openSidebar);
    if (_overlay)  _overlay.addEventListener("click", _closeSidebar);

    /* helpers */
    function esc(v) {
        return String(v || "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    /* i18n helper — reads current lang from localStorage */
    function t(key) {
        var lang = (typeof localStorage !== "undefined" ? localStorage.getItem("maherLang") : null) || "ar";
        var dict = (window.maherTranslations && window.maherTranslations[lang]) || {};
        return dict[key] || key;
    }

    function showToast(msg, type) {
        var t = document.createElement("div");
        t.textContent = msg;
        t.style.cssText = "position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);" +
            "padding:0.75rem 1.5rem;border-radius:12px;font-size:0.9rem;font-weight:700;" +
            "z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,0.18);transition:opacity .4s;color:#fff;" +
            (type === "error"
                ? "background:linear-gradient(135deg,#dc2626,#ef4444);"
                : "background:linear-gradient(135deg,#059669,#10b981);");
        document.body.appendChild(t);
        setTimeout(function () { t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 400); }, 3000);
    }
    function fmtDate(v) {
        if (!v) return "\u2014";
        var lang = (typeof localStorage !== "undefined" ? localStorage.getItem("maherLang") : null) || "ar";
        return new Date(v).toLocaleDateString(lang === "en" ? "en-US" : "ar-SA", { year: "numeric", month: "short", day: "numeric" });
    }
    function statusLabel(s) {
        if (s === "accepted") return '<span class="badge badge-accepted">' + t("adm.dyn.statusAccepted") + '</span>';
        if (s === "rejected") return '<span class="badge badge-rejected">'  + t("adm.dyn.statusRejected") + '</span>';
        return '<span class="badge badge-pending-status">' + t("adm.dyn.statusPending") + '</span>';
    }
    function roleLabel(r) {
        if (r === "job_seeker")  return '<span class="badge badge-role-seeker">'  + t("adm.dyn.roleSeeker")  + '</span>';
        if (r === "company")     return '<span class="badge badge-role-company">'  + t("adm.dyn.roleCompany") + '</span>';
        if (r === "super_admin") return '<span class="badge badge-role-admin">'    + t("adm.dyn.roleAdmin")   + '</span>';
        return '<span class="badge">' + esc(r) + '</span>';
    }

    var allTrainingPaths = [];
    var pathMapById = {};
    var cachedTpPathCounts = {};

    function filterTrainingPathsForAdmin(paths) {
        var el = document.getElementById("tpAdminSearch");
        var q = el ? (el.value || "").trim().toLowerCase() : "";
        if (!q) return paths.slice();
        return paths.filter(function (p) {
            var hay = ((p.name_ar || "") + " " + (p.slug || "")).toLowerCase();
            return hay.indexOf(q) !== -1;
        });
    }

    function renderTrainingPathsAdminRows() {
        var tbody = document.getElementById("trainingPathsTableBody");
        if (!tbody) return;
        var impBtn = document.getElementById("importDefaultPathsBtn");
        var filtered = filterTrainingPathsForAdmin(allTrainingPaths);
        if (!allTrainingPaths.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data-msg">لا توجد مسارات بعد. انقر «استيراد 17 مساراً من المرجع» أو نفّذ ملف database/seed_training_catalog.sql في Supabase.</td></tr>';
            if (impBtn) impBtn.style.display = "inline-flex";
            return;
        }
        if (impBtn) impBtn.style.display = "none";
        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data-msg">لا نتائج مطابقة لبحثك عن المسارات.</td></tr>';
            return;
        }
        tbody.innerHTML = filtered.map(function (p) {
            var n = cachedTpPathCounts[p.id] || 0;
            var vis = p.is_active ? "مفعّل" : "مخفي";
            return '<tr>' +
                '<td style="font-size:1.4rem;">' + esc(p.icon || "📘") + "</td>" +
                "<td>" + esc(p.name_ar) + "</td>" +
                "<td><code style=\"font-size:0.78rem;\">" + esc(p.slug) + "</code></td>" +
                "<td>" + esc(String(p.sort_order)) + "</td>" +
                "<td><strong>" + n + "</strong></td>" +
                "<td>" + vis + "</td>" +
                '<td><div class="dashboard-actions">' +
                '<button type="button" class="dashboard-btn dashboard-btn-edit" data-action="tp-toggle" data-id="' + esc(p.id) + '" data-active="' + (p.is_active ? "1" : "0") + '">' +
                    (p.is_active ? "إخفاء عن المتدربين" : "إظهار للمتدربين") + "</button>" +
                '<button type="button" class="dashboard-btn dashboard-btn-delete" data-action="tp-del" data-id="' + esc(p.id) + '">حذف</button>' +
                "</div></td></tr>";
        }).join("");
    }

    async function loadTrainingPathsAdmin() {
        var tbody = document.getElementById("trainingPathsTableBody");
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" class="no-data-msg">جاري التحميل...</td></tr>';
        var res = await sb.from("training_paths").select("*").order("sort_order", { ascending: true });
        allTrainingPaths = res.data || [];
        allTrainingPaths.forEach(function (p) { pathMapById[p.id] = p; });
        populateCoursePathSelect();

        var cntRes = await sb.from("courses").select("training_path_id");
        cachedTpPathCounts = {};
        (cntRes.data || []).forEach(function (r) {
            if (!r.training_path_id) return;
            cachedTpPathCounts[r.training_path_id] = (cachedTpPathCounts[r.training_path_id] || 0) + 1;
        });

        renderTrainingPathsAdminRows();
    }

    var importPathsBtn = document.getElementById("importDefaultPathsBtn");
    if (importPathsBtn) {
        importPathsBtn.addEventListener("click", async function () {
            if (!window.maherDefaultTrainingPaths || !window.maherDefaultTrainingPaths.length) {
                showToast("ملف المرجع غير محمّل.", "error");
                return;
            }
            importPathsBtn.disabled = true;
            var rows = window.maherDefaultTrainingPaths.map(function (p) {
                return {
                    id: p.id,
                    slug: p.slug,
                    name_ar: p.name_ar,
                    icon: p.icon || "📘",
                    sort_order: p.sort_order,
                    is_active: true
                };
            });
            var res = await sb.from("training_paths").upsert(rows, { onConflict: "id" });
            importPathsBtn.disabled = false;
            if (res.error) {
                var hint = (res.error.message || "").indexOf("row-level security") !== -1
                    ? " — نفّذ في Supabase الملف database/fix_training_paths_rls.sql ثم أعد المحاولة."
                    : "";
                showToast("تعذّر الاستيراد: " + res.error.message + hint, "error");
                return;
            }
            showToast("تم استيراد / تحديث المسارات الـ17.", "success");
            await loadTrainingPathsAdmin();
            await loadCourses();
            await loadAll();
        });
    }

    var tpAdminSearch = document.getElementById("tpAdminSearch");
    if (tpAdminSearch) {
        tpAdminSearch.addEventListener("input", function () {
            renderTrainingPathsAdminRows();
        });
    }

    function populateCoursePathSelect() {
        var sel = document.getElementById("courseTrainingPathId");
        if (!sel) return;
        var cur = sel.value;
        sel.innerHTML = '<option value="">— بدون مسار —</option>' +
            allTrainingPaths.map(function (p) {
                var suffix = p.is_active ? "" : " (معطّل للمتدربين)";
                return '<option value="' + esc(p.id) + '">' + esc(p.name_ar) + suffix + "</option>";
            }).join("");
        if (cur) sel.value = cur;
    }

    var addTpForm = document.getElementById("addTrainingPathForm");
    if (addTpForm) {
        addTpForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            var msg = document.getElementById("addTpMsg");
            var slug = (document.getElementById("tpSlug") || {}).value || "";
            var name = (document.getElementById("tpNameAr") || {}).value || "";
            var icon = (document.getElementById("tpIcon") || {}).value || "📘";
            var sort = parseInt((document.getElementById("tpSort") || {}).value || "0", 10);
            if (!slug.trim() || !name.trim()) {
                if (msg) { msg.textContent = "أدخل slug واسم المسار"; msg.style.color = "#f87171"; }
                return;
            }
            var res = await sb.from("training_paths").insert({
                slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
                name_ar: name.trim(),
                icon: icon.trim() || "📘",
                sort_order: isNaN(sort) ? 0 : sort,
                is_active: true
            });
            if (res.error) {
                if (msg) { msg.textContent = "خطأ: " + res.error.message; msg.style.color = "#f87171"; }
                return;
            }
            if (msg) { msg.textContent = "تم الحفظ"; msg.style.color = "#4ade80"; }
            addTpForm.reset();
            await loadTrainingPathsAdmin();
            await loadCourses();
        });
    }

    var tpTable = document.getElementById("trainingPathsTableBody");
    if (tpTable) {
        tpTable.addEventListener("click", async function (e) {
            var tgl = e.target.closest("[data-action='tp-toggle']");
            if (tgl) {
                var pid = tgl.getAttribute("data-id");
                var cur = tgl.getAttribute("data-active") === "1";
                var resT = await sb.from("training_paths").update({ is_active: !cur }).eq("id", pid);
                if (resT.error) { alert("تعذّر تحديث المسار"); return; }
                await loadTrainingPathsAdmin();
                await loadAll();
                await loadCourses();
                return;
            }
            var btn = e.target.closest("[data-action='tp-del']");
            if (!btn) return;
            if (!confirm("حذف المسار؟ ستُزال ربط الدورات به (دون حذف الدورات).")) return;
            var res = await sb.from("training_paths").delete().eq("id", btn.getAttribute("data-id"));
            if (res.error) { alert("تعذّر الحذف"); return; }
            await loadTrainingPathsAdmin();
            await loadCourses();
            await loadAll();
        });
    }

    /* admin notifications */
    async function loadAdminNotifications() {
        var listEl = document.getElementById("admNotifyList");
        var badge = document.getElementById("admNotifyBadge");
        if (!listEl) return;
        var res = await sb.from("admin_notifications")
            .select("id, title, body, meta, read_at, created_at")
            .order("created_at", { ascending: false })
            .limit(25);
        var rows = res.data || [];
        var unread = rows.filter(function (r) { return !r.read_at; }).length;
        if (badge) {
            badge.style.display = unread ? "inline-block" : "none";
            badge.textContent = unread > 99 ? "99+" : String(unread);
        }
        if (!rows.length) {
            listEl.innerHTML = '<div class="adm-notify-item" style="cursor:default;color:rgba(255,255,255,0.35);">لا إشعارات</div>';
            return;
        }
        listEl.innerHTML = rows.map(function (r) {
            var dim = r.read_at ? "opacity:0.55;" : "";
            return '<div class="adm-notify-item" style="' + dim + '" data-nid="' + esc(r.id) + '">' +
                "<strong>" + esc(r.title || "") + "</strong>" +
                "<small>" + esc(r.body || "") + " · " + fmtDate(r.created_at) + "</small></div>";
        }).join("");
    }

    async function markNotificationRead(id) {
        await sb.from("admin_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
        await loadAdminNotifications();
    }

    async function markAllNotificationsRead() {
        var r = await sb.from("admin_notifications").select("id").is("read_at", null);
        var ids = (r.data || []).map(function (x) { return x.id; });
        var iso = new Date().toISOString();
        for (var i = 0; i < ids.length; i++) {
            await sb.from("admin_notifications").update({ read_at: iso }).eq("id", ids[i]);
        }
        await loadAdminNotifications();
    }

    var admNotifyBtn = document.getElementById("admNotifyBtn");
    var admNotifyDropdown = document.getElementById("admNotifyDropdown");
    if (admNotifyBtn && admNotifyDropdown) {
        admNotifyBtn.addEventListener("click", function (ev) {
            ev.stopPropagation();
            admNotifyDropdown.classList.toggle("open");
            admNotifyDropdown.setAttribute("aria-hidden", admNotifyDropdown.classList.contains("open") ? "false" : "true");
            void loadAdminNotifications();
        });
        document.addEventListener("click", function () {
            admNotifyDropdown.classList.remove("open");
        });
        admNotifyDropdown.addEventListener("click", function (e) { e.stopPropagation(); });
    }
    var admNotifyList = document.getElementById("admNotifyList");
    if (admNotifyList) {
        admNotifyList.addEventListener("click", async function (e) {
            var row = e.target.closest(".adm-notify-item[data-nid]");
            if (!row) return;
            await markNotificationRead(row.getAttribute("data-nid"));
        });
    }
    var admNotifyMarkAll = document.getElementById("admNotifyMarkAll");
    if (admNotifyMarkAll) admNotifyMarkAll.addEventListener("click", function () { void markAllNotificationsRead(); });

    setInterval(function () {
        if (document.visibilityState === "visible") void loadAdminNotifications();
    }, 20000);

    /* tab management */
    var tabs     = document.querySelectorAll(".dash-tab");
    var contents = document.querySelectorAll(".dash-tab-content");

    /* Show promo-requests tab only for primary admin */
    if (isSuperPrimary) {
        var _promoTab = document.getElementById("promoReqTab");
        if (_promoTab) _promoTab.style.display = "";
    }

    var _tabTitles = {
        "overview":        "نظرة عامة",
        "users":           "إدارة المتدربين والمستخدمين",
        "training-paths":  "المسارات التدريبية",
        "courses":         "الدورات والدبلومات",
        "promo-requests":  "طلبات الترقية"
    };

    tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            tabs.forEach(function (t) { t.classList.remove("active"); });
            contents.forEach(function (c) { c.style.display = "none"; });
            tab.classList.add("active");
            var panel = document.getElementById("tab-" + tab.dataset.tab);
            if (panel) panel.style.display = "block";
            if (tab.dataset.tab === "training-paths") loadTrainingPathsAdmin();
            if (tab.dataset.tab === "courses")         void loadCourses(false);
            if (tab.dataset.tab === "promo-requests")  loadPromoRequests();
            /* update topbar title */
            var ttEl = document.getElementById("admPageTitle");
            if (ttEl && _tabTitles[tab.dataset.tab]) ttEl.textContent = _tabTitles[tab.dataset.tab];
            /* close mobile sidebar */
            _closeSidebar();
        });
    });

    /* data */
    var allProfiles       = [];
    var allJobs           = [];
    var allApps           = [];
    var allStaffRequests  = [];
    var allCourseRows     = [];
    var allEnrollmentRows = [];
    var allTrainingPathsStats = [];
    var profileMap        = {};
    var jobMap            = {};
    var courseMapDash     = {};

    async function loadAll() {
        var results = await Promise.all([
            sb.from("profiles").select("id, full_name, email, role, phone, specialization, cv_url, created_at").order("created_at", { ascending: false }),
            sb.from("courses").select("id, title, category, instructor, is_active, created_at, training_path_id").order("created_at", { ascending: false }),
            sb.from("course_enrollments").select("id, user_id, course_id, status, created_at").order("created_at", { ascending: false }),
            sb.from("training_paths").select("id, name_ar, is_active, sort_order").order("sort_order", { ascending: true })
        ]);
        allProfiles       = results[0].data || [];
        allCourseRows     = results[1].data || [];
        allEnrollmentRows = results[2].data || [];
        allTrainingPathsStats = results[3].data || [];
        allJobs           = [];
        allApps           = [];
        allProfiles.forEach(function (p) { profileMap[p.id] = p; });
        allCourseRows.forEach(function (c) { courseMapDash[c.id] = c; });
        jobMap = {};
        renderStats();
        renderUsers(allProfiles);
        if (document.getElementById("jobsTableBody")) renderJobs(allJobs);
        if (document.getElementById("appJobFilter")) populateJobFilter();
        if (document.getElementById("applicationsTableBody")) filterApps();
    }

    /* stats */
    function renderStats() {
        var trainees = allProfiles.filter(function (p) { return p.role === "job_seeker"; }).length;
        var admins   = allProfiles.filter(function (p) { return p.role === "super_admin"; }).length;
        var totalUsers = allProfiles.length;
        var statTotal = document.getElementById("statTotalUsers");
        if (statTotal) statTotal.textContent = totalUsers;
        var skEl = document.getElementById("statSeekers"); if (skEl) skEl.textContent = trainees;
        var coEl = document.getElementById("statCompanies"); if (coEl) coEl.textContent = allCourseRows.length;
        var jbEl = document.getElementById("statJobs"); if (jbEl) jbEl.textContent = allEnrollmentRows.length;
        var apEl = document.getElementById("statApplications"); if (apEl) apEl.textContent = allCourseRows.filter(function (c) { return c.is_active; }).length;
        var spEl = document.getElementById("statTrainingPaths"); if (spEl) spEl.textContent = allTrainingPathsStats.length;
        var spaEl = document.getElementById("statTrainingPathsActive"); if (spaEl) spaEl.textContent = allTrainingPathsStats.filter(function (p) { return p.is_active; }).length;
        var nbU = document.getElementById("navBadgeUsers"); if (nbU) nbU.textContent = totalUsers;
        var nbJ = document.getElementById("navBadgeJobs");  if (nbJ) nbJ.textContent = allCourseRows.length;
        var nbA = document.getElementById("navBadgeApps");  if (nbA) nbA.textContent = allEnrollmentRows.length;
        renderOverview();
    }

    /* ── Overview panel ────────────────────────────────────── */
    function renderOverview() {
        /* recent enrollments */
        var appsEl = document.getElementById("overviewRecentApps");
        if (appsEl) {
            var r5e = allEnrollmentRows.slice(0, 5);
            if (!r5e.length) {
                appsEl.innerHTML = '<div class="adm-loading-row">لا توجد تسجيلات بعد.</div>';
            } else {
                appsEl.innerHTML = r5e.map(function (e) {
                    var seeker = profileMap[e.user_id] || {};
                    var name   = seeker.full_name || seeker.email || "—";
                    var crs    = courseMapDash[e.course_id] || {};
                    var ini    = esc((name || "?")[0]);
                    var st     = (e.status || "enrolled").toLowerCase();
                    var sTxt   = st === "completed" ? "مكتمل" : st === "cancelled" ? "ملغى" : "مسجّل";
                    var sCls   = st === "completed" ? "accepted" : st === "cancelled" ? "rejected" : "pending";
                    return '<div class="adm-ov-item">' +
                        '<div class="adm-ov-avatar">' + ini + '</div>' +
                        '<div><div class="adm-ov-name">' + esc(name) + '</div>' +
                        '<div class="adm-ov-meta">' + esc(crs.title || "—") + '</div></div>' +
                        '<span class="adm-ov-status ' + sCls + '">' + sTxt + '</span>' +
                    '</div>';
                }).join("");
            }
        }
        /* recent users */
        var usersEl = document.getElementById("overviewRecentUsers");
        if (usersEl) {
            var r5u = allProfiles.slice(0, 5);
            if (!r5u.length) {
                usersEl.innerHTML = '<div class="adm-loading-row">لا يوجد مستخدمون بعد.</div>';
            } else {
                var roleClr = { job_seeker: "#6366f1,#4f46e5", company: "#0ea5e9,#0284c7", super_admin: "#f59e0b,#d97706" };
                var roleText = { job_seeker: "متدرب", company: "قديم", super_admin: "أدمن" };
                usersEl.innerHTML = r5u.map(function (p) {
                    var ini  = esc((p.full_name || p.email || "?")[0]);
                    var clr  = roleClr[p.role] || "#6366f1,#4f46e5";
                    var role = roleText[p.role] || p.role || "";
                    return '<div class="adm-ov-item">' +
                        '<div class="adm-ov-avatar" style="background:linear-gradient(135deg,' + clr + ')">' + ini + '</div>' +
                        '<div><div class="adm-ov-name">' + esc(p.full_name || p.email || "—") + '</div>' +
                        '<div class="adm-ov-meta">' + role + ' · ' + fmtDate(p.created_at) + '</div></div>' +
                    '</div>';
                }).join("");
            }
        }
        var pes = document.getElementById("overviewPathsSummary");
        if (pes) {
            if (!allTrainingPathsStats.length) {
                pes.innerHTML = '<div class="adm-loading-row">لا توجد مسارات — نفّذ ملفات الهجرة والبذور في Supabase.</div>';
            } else {
                var pAct = allTrainingPathsStats.filter(function (p) { return p.is_active; }).length;
                var cTot = allCourseRows.length;
                var cAct = allCourseRows.filter(function (c) { return c.is_active; }).length;
                pes.innerHTML =
                    '<div class="adm-loading-row" style="flex-direction:column;align-items:flex-start;gap:0.45rem;line-height:1.5;">' +
                    "<div>المسارات: <strong>" + allTrainingPathsStats.length + "</strong> — مفعّلة للمتدربين: <strong>" + pAct + "</strong></div>" +
                    "<div>الدورات والدبلومات: <strong>" + cTot + "</strong> — معروضة في الموقع: <strong>" + cAct + "</strong></div>" +
                    "<div style=\"font-size:0.78rem;opacity:0.75;\">يمكنك إخفاء المسار أو الدورة من تبويب المسارات / الدورات.</div>" +
                    "</div>";
            }
        }
        /* courses by category */
        var distEl = document.getElementById("overviewJobsDist");
        if (distEl) {
            if (!allCourseRows.length) {
                distEl.innerHTML = '<div class="adm-loading-row">لا توجد دورات بعد.</div>';
            } else {
                var catCounts = {};
                allCourseRows.forEach(function (c) { var tp = c.category || "عام"; catCounts[tp] = (catCounts[tp] || 0) + 1; });
                var maxVal = Math.max.apply(null, Object.keys(catCounts).map(function (k) { return catCounts[k]; })) || 1;
                var barColors = ["#3b82f6,#6366f1","#10b981,#059669","#f59e0b,#d97706","#ef4444,#dc2626","#8b5cf6,#7c3aed"];
                distEl.innerHTML = Object.keys(catCounts).sort(function (a,b) { return catCounts[b]-catCounts[a]; }).map(function (tp, i) {
                    var pct = Math.round((catCounts[tp] / maxVal) * 100);
                    var clr = barColors[i % barColors.length];
                    return '<div class="adm-dist-row">' +
                        '<div class="adm-dist-label">' + esc(tp) + '</div>' +
                        '<div class="adm-dist-bar-wrap"><div class="adm-dist-bar" style="width:' + pct + '%;background:linear-gradient(90deg,' + clr + ')"></div></div>' +
                        '<div class="adm-dist-count">' + catCounts[tp] + '</div>' +
                    '</div>';
                }).join("");
            }
        }
    }

    /* users */
    var usersBody = document.getElementById("usersTableBody");
    function renderUsers(list) {
        if (!usersBody) return;
        if (!list.length) { usersBody.innerHTML = '<tr><td colspan="7" class="no-data-msg">' + t("adm.dyn.noUsers") + '</td></tr>'; return; }
        usersBody.innerHTML = list.map(function (p) {
            var cv    = p.cv_url ? '<a href="' + esc(p.cv_url) + '" target="_blank" class="btn-link">' + t("adm.dyn.viewCv") + '</a>' : "\u2014";
            var phone = p.phone  ? '<a href="tel:' + esc(p.phone) + '" class="phone-link">' + esc(p.phone) + '</a>' : "\u2014";
            var actionsHtml;
            if (isSuperPrimary) {
                /* Primary admin: full controls */
                actionsHtml =
                    '<select class="admin-select-sm role-select" data-uid="' + esc(p.id) + '">' +
                        '<option value="job_seeker"'  + (p.role === "job_seeker"  ? " selected" : "") + '>' + t("adm.dyn.roleSeeker")  + '</option>' +
                        '<option value="super_admin"' + (p.role === "super_admin" ? " selected" : "") + '>' + t("adm.dyn.roleAdmin")   + '</option>' +
                    '</select>' +
                    '<button class="dashboard-btn dashboard-btn-reset-pwd" data-action="reset-pwd" data-uid="' + esc(p.id) + '" data-email="' + esc(p.email || "") + '" title="' + t("adm.dyn.assign") + '">' + t("adm.dyn.assign") + '</button>' +
                    '<button class="dashboard-btn dashboard-btn-delete" data-action="delete-user" data-uid="' + esc(p.id) + '">' + t("adm.dyn.delete") + '</button>';
            } else {
                /* Secondary admin: read-only + promo request button for non-admins */
                if (p.role !== "super_admin") {
                    actionsHtml = '<button class="dashboard-btn" style="background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-size:0.78rem;" data-action="request-promo" data-uid="' + esc(p.id) + '" data-uname="' + esc(p.full_name || p.email || "") + '">' + t("adm.dyn.requestPromo") + '</button>';
                } else {
                    actionsHtml = '<span style="color:#64748b;font-size:0.8rem;">' + t("adm.dyn.alreadyAdmin") + '</span>';
                }
            }
            return '<tr>' +
                '<td>' + esc(p.full_name || "\u2014") + '</td>' +
                '<td>' + esc(p.email    || "\u2014") + '</td>' +
                '<td>' + phone + '</td>' +
                '<td>' + roleLabel(p.role) + '</td>' +
                '<td>' + fmtDate(p.created_at) + '</td>' +
                '<td>' + cv + '</td>' +
                '<td><div class="dashboard-actions">' + actionsHtml + '</div></td>' +
            '</tr>';
        }).join("");
    }
    var usersSearch = document.getElementById("usersSearch");
    var usersRoleFilter = document.getElementById("usersRoleFilter");
    function filterUsers() {
        var q    = usersSearch      ? usersSearch.value.trim().toLowerCase() : "";
        var role = usersRoleFilter  ? usersRoleFilter.value : "";
        renderUsers(allProfiles.filter(function (p) {
            var matchText = !q || (p.full_name || "").toLowerCase().indexOf(q) !== -1 || (p.email || "").toLowerCase().indexOf(q) !== -1;
            var matchRole = !role || p.role === role;
            return matchText && matchRole;
        }));
    }
    if (usersSearch)     usersSearch.addEventListener("input", filterUsers);
    if (usersRoleFilter) usersRoleFilter.addEventListener("change", filterUsers);
    if (usersBody) {
        usersBody.addEventListener("change", async function (e) {
            var sel = e.target.closest(".role-select");
            if (!sel) return;
            var res = await sb.from("profiles").update({ role: sel.value }).eq("id", sel.dataset.uid);
            if (res.error) { alert("\u062a\u0639\u0630\u0631 \u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u062f\u0648\u0631."); await loadAll(); return; }
            if (profileMap[sel.dataset.uid]) profileMap[sel.dataset.uid].role = sel.value;
            renderStats();
        });
        usersBody.addEventListener("click", async function (e) {
            /* Secondary admin: request promo */
            var promoBtn = e.target.closest("[data-action='request-promo']");
            if (promoBtn) {
                var targetUid  = promoBtn.dataset.uid;
                var targetName = promoBtn.dataset.uname;
                promoBtn.disabled    = true;
                promoBtn.textContent = t("adm.dyn.sending");
                var reqRes = await sb.from("admin_promotion_requests").insert({
                    requested_by:   user.id,
                    target_user_id: targetUid,
                    status:         "pending"
                });
                promoBtn.disabled  = false;
                promoBtn.innerHTML = t("adm.dyn.requestPromo");
                if (reqRes.error) {
                    showToast("\u062a\u0639\u0630\u0651\u0631 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628. \u062a\u0623\u0643\u062f \u0645\u0646 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062c\u062f\u0648\u0644 \u0641\u064a Supabase.", "error");
                } else {
                    promoBtn.textContent = t("adm.dyn.sent");
                    promoBtn.disabled = true;
                    showToast("\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u062a\u0631\u0642\u064a\u0629 \u0644\u0644\u0645\u0634\u0631\u0641 \u0627\u0644\u0631\u0626\u064a\u0633\u064a \u2705", "success");
                }
                return;
            }

            var resetBtn = e.target.closest("[data-action='reset-pwd']");
            if (resetBtn) {
                var email = resetBtn.dataset.email;
                if (!email) return;
                if (!confirm('إرسال رابط إعادة تعيين كلمة المرور إلى:\n' + email + '\n\nهل أنت متأكد؟')) return;
                resetBtn.disabled = true;
                resetBtn.textContent = t("adm.dyn.sending");
                var redirectUrl = window.location.origin + (window.location.pathname.replace(/\/[^\/]*$/, '/')) + 'reset-password.html';
                var res = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
                resetBtn.disabled = false;
                resetBtn.textContent = t("adm.dyn.assign");
                if (res.error) {
                    alert('تعذّر إرسال البريد: ' + res.error.message);
                } else {
                    alert('✅ تم إرسال رابط إعادة التعيين إلى ' + email);
                }
                return;
            }
            var btn = e.target.closest("[data-action='delete-user']");
            if (!btn) return;
            if (!confirm("\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u062d\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u061f")) return;
            var res = await sb.from("profiles").delete().eq("id", btn.dataset.uid);
            if (res.error) { alert("\u062a\u0639\u0630\u0631 \u062d\u0630\u0641 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645."); return; }
            await loadAll();
        });
    }

    /* jobs */
    var jobsBody = document.getElementById("jobsTableBody");
    function renderJobs(list) {
        if (!jobsBody) return;
        if (!list.length) { jobsBody.innerHTML = '<tr><td colspan="6" class="no-data-msg">' + t("adm.dyn.noJobs") + '</td></tr>'; return; }
        jobsBody.innerHTML = list.map(function (j) {
            var company = profileMap[j.company_id] || {};
            return '<tr>' +
                '<td>' + esc(j.title || "\u2014") + '</td>' +
                '<td>' + esc(company.full_name || "\u2014") + '</td>' +
                '<td>' + esc(j.location || "\u2014") + '</td>' +
                '<td>' + esc(j.job_type || "\u2014") + '</td>' +
                '<td>' + fmtDate(j.created_at) + '</td>' +
                '<td><div class="dashboard-actions">' +
                    '<button class="dashboard-btn dashboard-btn-edit" data-action="edit-job" data-jid="' + esc(j.id) + '" data-title="' + esc(j.title || "") + '">' + t("adm.dyn.edit") + '</button>' +
                    '<button class="dashboard-btn dashboard-btn-delete" data-action="delete-job" data-jid="' + esc(j.id) + '">' + t("adm.dyn.delete") + '</button>' +
                '</div></td>' +
            '</tr>';
        }).join("");
    }
    var jobsSearch = document.getElementById("jobsSearch");
    if (jobsSearch) {
        jobsSearch.addEventListener("input", function () {
            var q = this.value.trim().toLowerCase();
            renderJobs(q ? allJobs.filter(function (j) {
                var c = profileMap[j.company_id] || {};
                return (j.title || "").toLowerCase().indexOf(q) !== -1 || (c.full_name || "").toLowerCase().indexOf(q) !== -1;
            }) : allJobs);
        });
    }
    if (jobsBody) {
        jobsBody.addEventListener("click", async function (e) {
            var editBtn = e.target.closest("[data-action='edit-job']");
            var delBtn  = e.target.closest("[data-action='delete-job']");
            if (editBtn) {
                var newTitle = prompt("\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0648\u0638\u064a\u0641\u0629 \u0627\u0644\u062c\u062f\u064a\u062f:", editBtn.dataset.title || "");
                if (!newTitle || !newTitle.trim()) return;
                var res = await sb.from("jobs").update({ title: newTitle.trim() }).eq("id", editBtn.dataset.jid);
                if (res.error) { alert("\u062a\u0639\u0630\u0631 \u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0648\u0638\u064a\u0641\u0629."); return; }
                await loadAll();
            }
            if (delBtn) {
                if (!confirm("\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u062d\u0630\u0641 \u0647\u0630\u0647 \u0627\u0644\u0648\u0638\u064a\u0641\u0629\u061f")) return;
                var res2 = await sb.from("jobs").delete().eq("id", delBtn.dataset.jid);
                if (res2.error) { alert("\u062a\u0639\u0630\u0631 \u062d\u0630\u0641 \u0627\u0644\u0648\u0638\u064a\u0641\u0629."); return; }
                await loadAll();
            }
        });
    }

    /* applications */
    var appsBody      = document.getElementById("applicationsTableBody");
    var appFilter     = document.getElementById("appStatusFilter");
    var appJobFilter  = document.getElementById("appJobFilter");

    function populateJobFilter() {
        if (!appJobFilter) return;
        /* keep the first blank option, replace everything after it */
        appJobFilter.innerHTML = '<option value="">' + t("adm.apps.filter.allJobs") + '</option>';
        allJobs.forEach(function (j) {
            var opt = document.createElement("option");
            opt.value = j.id;
            opt.textContent = j.title || j.id;
            appJobFilter.appendChild(opt);
        });
    }

    function filterApps() {
        var statusVal = appFilter    ? appFilter.value    : "";
        var jobVal    = appJobFilter ? appJobFilter.value : "";
        var filtered  = allApps.filter(function (a) {
            var matchStatus = !statusVal || (a.status || "pending") === statusVal;
            var matchJob    = !jobVal    || a.job_id === jobVal;
            return matchStatus && matchJob;
        });
        renderApps(filtered);
    }

    function renderApps(list) {
        if (!appsBody) return;
        if (!list.length) { appsBody.innerHTML = '<tr><td colspan="9" class="no-data-msg">' + t("adm.dyn.noApps") + '</td></tr>'; return; }
        appsBody.innerHTML = list.map(function (a) {
            var seeker       = profileMap[a.user_id] || {};
            var job          = jobMap[a.job_id] || {};
            var name         = a.full_name      || seeker.full_name      || "\u2014";
            var email        = seeker.email     || "\u2014";
            var phone        = a.phone          || seeker.phone          || "\u2014";
            var specialization = a.specialization || seeker.specialization || "\u2014";
            var jobTitle     = job.title        || "\u2014";
            var cvUrl        = a.cv_url         || seeker.cv_url;
            var cv           = cvUrl ? '<a href="' + esc(cvUrl) + '" target="_blank" class="btn-link">' + t("adm.dyn.viewCvShort") + '</a>' : "\u2014";
            return '<tr>' +
                '<td>' + esc(name) + '</td>' +
                '<td>' + esc(email) + '</td>' +
                '<td>' + esc(phone) + '</td>' +
                '<td>' + esc(specialization) + '</td>' +
                '<td>' + esc(jobTitle) + '</td>' +
                '<td>' + fmtDate(a.created_at) + '</td>' +
                '<td>' + statusLabel(a.status || "pending") + '</td>' +
                '<td>' + cv + '</td>' +
                '<td><div class="dashboard-actions">' +
                    '<button class="dashboard-btn dashboard-btn-accept" data-action="app-accept" data-aid="' + esc(a.id) + '">' + t("adm.dyn.accept") + '</button>' +
                    '<button class="dashboard-btn dashboard-btn-reject" data-action="app-reject" data-aid="' + esc(a.id) + '">' + t("adm.dyn.reject") + '</button>' +
                '</div></td>' +
            '</tr>';
        }).join("");
    }
    if (appFilter)    appFilter.addEventListener("change",    filterApps);
    if (appJobFilter) appJobFilter.addEventListener("change", filterApps);

    /* export applications to Excel */
    var exportBtn = document.getElementById("exportAppsBtn");
    if (exportBtn) {
        exportBtn.addEventListener("click", function () {

            var statusVal = appFilter    ? appFilter.value    : "";
            var jobVal    = appJobFilter ? appJobFilter.value : "";
            var rows = allApps.filter(function (a) {
                var matchStatus = !statusVal || (a.status || "pending") === statusVal;
                var matchJob    = !jobVal    || a.job_id === jobVal;
                return matchStatus && matchJob;
            });

            if (!rows.length) { alert("لا توجد بيانات للتصدير."); return; }

            var statusText = { accepted: "مقبول", rejected: "مرفوض", pending: "قيد المراجعة" };

            var data = [["#", "الاسم الكامل", "البريد الإلكتروني", "رقم الجوال", "التخصص", "الوظيفة", "الحالة", "تاريخ التقديم", "رابط السيرة الذاتية"]];

            rows.forEach(function (a, i) {
                var seeker = profileMap[a.user_id] || {};
                var job    = jobMap[a.job_id]      || {};
                data.push([
                    i + 1,
                    a.full_name      || seeker.full_name      || "—",
                    seeker.email     || "—",
                    a.phone          || seeker.phone          || "—",
                    a.specialization || seeker.specialization || "—",
                    job.title        || "—",
                    statusText[a.status] || a.status || "—",
                    a.created_at ? new Date(a.created_at).toLocaleDateString("ar-SA") : "—",
                    a.cv_url         || seeker.cv_url         || "—"
                ]);
            });

            var wb = XLSX.utils.book_new();
            var ws = XLSX.utils.aoa_to_sheet(data);

            ws["!cols"] = [
                { wch: 5  },  // #
                { wch: 22 },  // name
                { wch: 30 },  // email
                { wch: 16 },  // phone
                { wch: 20 },  // specialization
                { wch: 25 },  // job title
                { wch: 14 },  // status
                { wch: 18 },  // date
                { wch: 40 }   // cv url
            ];

            var selectedJobTitle = jobVal && jobMap[jobVal] ? jobMap[jobVal].title : "";
            var sheetName = selectedJobTitle ? selectedJobTitle.substring(0, 31) : "المتقدمون";
            XLSX.utils.book_append_sheet(wb, ws, sheetName);

            var safeName = (selectedJobTitle || "المتقدمون").replace(/[\\/:*?"<>|]/g, "_");
            XLSX.writeFile(wb, "متقدمو_" + safeName + ".xlsx");
        });
    }
    if (appsBody) {
        appsBody.addEventListener("click", async function (e) {
            var btn = e.target.closest("[data-action^='app-']");
            if (!btn) return;
            var newStatus = btn.dataset.action === "app-accept" ? "accepted" : "rejected";
            var res = await sb.from("applications").update({ status: newStatus }).eq("id", btn.dataset.aid);
            if (res.error) { alert("\u062a\u0639\u0630\u0631 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062d\u0627\u0644\u0629."); return; }
            var app = allApps.find(function (a) { return a.id === btn.dataset.aid; });
            if (app) app.status = newStatus;
            filterApps();
        });
    }

    /* staff requests (admin) */
    var staffReqBody   = document.getElementById("staffRequestsTableBody");
    var staffReqFilter = document.getElementById("staffReqStatusFilter");

    function staffReqStatusLabel(s) {
        if (s === "reviewed") return '<span class="badge badge-accepted">'      + t("adm.dyn.statusReviewed") + '</span>';
        if (s === "rejected") return '<span class="badge badge-rejected">'      + t("adm.dyn.statusRejected") + '</span>';
        return '<span class="badge badge-pending-status">' + t("adm.dyn.statusPending") + '</span>';
    }

    function renderStaffRequests(list) {
        if (!staffReqBody) return;
        if (!list.length) { staffReqBody.innerHTML = '<tr><td colspan="9" class="no-data-msg">' + t("adm.dyn.noApps") + '</td></tr>'; return; }
        staffReqBody.innerHTML = list.map(function (r) {
            var company = profileMap[r.company_id] || {};
            var companyName = company.full_name || company.email || "\u2014";
            return '<tr>' +
                '<td>' + esc(companyName) + '</td>' +
                '<td>' + esc(r.job_title || "\u2014") + '</td>' +
                '<td>' + esc(String(r.count || 1)) + '</td>' +
                '<td>' + esc(r.specialization || "\u2014") + '</td>' +
                '<td>' + esc(r.work_type || "\u2014") + '</td>' +
                '<td>' + esc(r.salary || "\u2014") + '</td>' +
                '<td>' + fmtDate(r.created_at) + '</td>' +
                '<td>' + staffReqStatusLabel(r.status) + '</td>' +
                '<td><div class="dashboard-actions">' +
                    '<button class="dashboard-btn dashboard-btn-accept" data-action="req-review" data-rid="' + esc(r.id) + '">' + t("adm.dyn.review") + '</button>' +
                    '<button class="dashboard-btn dashboard-btn-reject" data-action="req-reject" data-rid="' + esc(r.id) + '">' + t("adm.dyn.reject") + '</button>' +
                '</div></td>' +
            '</tr>';
        }).join("");
    }

    async function loadStaffRequests() {
        if (!staffReqBody) return;
        staffReqBody.innerHTML = '<tr><td colspan="9" class="no-data-msg">\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644...</td></tr>';
        var resp = await sb.from("employee_requests")
            .select("id, company_id, job_title, count, specialization, work_type, salary, deadline, skills, notes, status, created_at")
            .order("created_at", { ascending: false });
        allStaffRequests = resp.data || [];
        var filterVal = staffReqFilter ? staffReqFilter.value : "";
        renderStaffRequests(filterVal ? allStaffRequests.filter(function (r) { return r.status === filterVal; }) : allStaffRequests);
    }

    if (staffReqFilter) {
        staffReqFilter.addEventListener("change", function () {
            var val = this.value;
            renderStaffRequests(val ? allStaffRequests.filter(function (r) { return r.status === val; }) : allStaffRequests);
        });
    }

    if (staffReqBody) {
        staffReqBody.addEventListener("click", async function (e) {
            var btn = e.target.closest("[data-action^='req-']");
            if (!btn) return;
            var rid = btn.dataset.rid;
            var newStatus = btn.dataset.action === "req-review" ? "reviewed" : "rejected";
            var res = await sb.from("employee_requests").update({ status: newStatus }).eq("id", rid);
            if (res.error) { alert("\u062a\u0639\u0630\u0631 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062d\u0627\u0644\u0629."); return; }
            var req = allStaffRequests.find(function (r) { return r.id === rid; });
            if (req) req.status = newStatus;
            var filterVal = staffReqFilter ? staffReqFilter.value : "";
            renderStaffRequests(filterVal ? allStaffRequests.filter(function (r) { return r.status === filterVal; }) : allStaffRequests);
        });
    }

    /* ── course requests (admin) ──────────────────────────────────── */
    var courseReqBody        = document.getElementById("courseRequestsTableBody");
    var courseReqFilter      = document.getElementById("courseReqStatusFilter");
    var allCourseRequests    = [];

    function courseReqStatusLabel(s) {
        if (s === "approved") return '<span class="badge badge-accepted">' + t("adm.dyn.statusApproved") + '</span>';
        if (s === "rejected") return '<span class="badge badge-rejected">'  + t("adm.dyn.statusRejected") + '</span>';
        return '<span class="badge badge-pending-status">' + t("adm.dyn.statusPending") + '</span>';
    }

    function renderCourseRequests(list) {
        if (!courseReqBody) return;
        if (!list.length) { courseReqBody.innerHTML = '<tr><td colspan="9" class="no-data-msg">' + t("adm.dyn.noApps") + '</td></tr>'; return; }
        courseReqBody.innerHTML = list.map(function (r) {
            var company = profileMap[r.company_id] || {};
            return '<tr>' +
                '<td>' + esc(company.full_name || company.email || "\u2014") + '</td>' +
                '<td><strong>' + esc(r.course_name || "\u2014") + '</strong></td>' +
                '<td>' + esc(r.category || "\u2014") + '</td>' +
                '<td>' + esc(String(r.seats || "\u2014")) + '</td>' +
                '<td>' + esc(r.duration || "\u2014") + '</td>' +
                '<td>' + esc(r.expected_date || "\u2014") + '</td>' +
                '<td>' + fmtDate(r.created_at) + '</td>' +
                '<td>' + courseReqStatusLabel(r.status) + '</td>' +
                '<td><div class="dashboard-actions">' +
                    '<button class="dashboard-btn dashboard-btn-accept" data-action="cr-approve" data-rid="' + esc(r.id) + '">' + t("adm.dyn.approve") + '</button>' +
                    '<button class="dashboard-btn dashboard-btn-reject"  data-action="cr-reject"  data-rid="' + esc(r.id) + '">' + t("adm.dyn.reject")  + '</button>' +
                '</div></td>' +
            '</tr>';
        }).join("");
    }

    async function loadCourseRequests() {
        if (!courseReqBody) return;
        courseReqBody.innerHTML = '<tr><td colspan="9" class="no-data-msg">\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644...</td></tr>';
        var resp = await sb.from("course_requests")
            .select("id, company_id, course_name, category, seats, duration, expected_date, description, notes, status, created_at")
            .order("created_at", { ascending: false });
        allCourseRequests = resp.data || [];
        var filterVal = courseReqFilter ? courseReqFilter.value : "";
        renderCourseRequests(filterVal ? allCourseRequests.filter(function (r) { return r.status === filterVal; }) : allCourseRequests);
    }

    if (courseReqFilter) {
        courseReqFilter.addEventListener("change", function () {
            var val = this.value;
            renderCourseRequests(val ? allCourseRequests.filter(function (r) { return r.status === val; }) : allCourseRequests);
        });
    }

    if (courseReqBody) {
        courseReqBody.addEventListener("click", async function (e) {
            var btn = e.target.closest("[data-action^='cr-']");
            if (!btn) return;
            var newStatus = btn.dataset.action === "cr-approve" ? "approved" : "rejected";
            var res = await sb.from("course_requests").update({ status: newStatus }).eq("id", btn.dataset.rid);
            if (res.error) { alert("\u062a\u0639\u0630\u0651\u0631 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062d\u0627\u0644\u0629."); return; }
            var req = allCourseRequests.find(function (r) { return r.id === btn.dataset.rid; });
            if (req) req.status = newStatus;
            var filterVal = courseReqFilter ? courseReqFilter.value : "";
            renderCourseRequests(filterVal ? allCourseRequests.filter(function (r) { return r.status === filterVal; }) : allCourseRequests);
        });
    }

    /* ── courses (admin) ──────────────────────────────────────────── */
    var coursesBody  = document.getElementById("coursesTableBody");
    var coursesPaginationEl = document.getElementById("coursesPagination");
    var addCourseForm = document.getElementById("addCourseForm");
    var addCourseMsg  = document.getElementById("addCourseMsg");
    var allCourses   = [];
    var enrollCountMap = {};
    var coursesCacheReady = false;
    var coursesAdminPage = 0;
    var COURSES_PAGE_SIZE = 35;
    var coursesSearchTimer = null;
    var coursesLoadInFlight = null;

    function buildEnrollCountMap(rows) {
        var map = {};
        (rows || []).forEach(function (e) {
            if (!e || !e.course_id) return;
            map[e.course_id] = (map[e.course_id] || 0) + 1;
        });
        return map;
    }

    function parseCourseEnrollCount(c) {
        if (c._enrollCount != null) return c._enrollCount;
        var rel = c.course_enrollments;
        if (Array.isArray(rel) && rel[0] && rel[0].count != null) return rel[0].count;
        return enrollCountMap[c.id] || 0;
    }

    function getFilteredAdminCourses() {
        var el = document.getElementById("coursesAdminSearch");
        var q = el ? (el.value || "").trim().toLowerCase() : "";
        if (!q) return allCourses;
        return allCourses.filter(function (c) {
            var p = c.training_path_id ? pathMapById[c.training_path_id] : null;
            var pn = p ? (p.name_ar || "") : "";
            var hay = (c.title || "") + " " + (c.instructor || "") + " " + (c.category || "") + " " + pn;
            return hay.toLowerCase().indexOf(q) !== -1;
        });
    }

    function syncOverviewFromCourses() {
        allCourseRows = allCourses.map(function (c) {
            return {
                id: c.id,
                title: c.title,
                category: c.category,
                instructor: c.instructor,
                is_active: c.is_active,
                created_at: c.created_at,
                training_path_id: c.training_path_id
            };
        });
        courseMapDash = {};
        allCourseRows.forEach(function (c) { courseMapDash[c.id] = c; });
        renderStats();
    }

    async function ensurePathsForCourses() {
        if (allTrainingPaths.length && Object.keys(pathMapById).length) {
            populateCoursePathSelect();
            return;
        }
        var pathRes = await sb.from("training_paths").select("id, name_ar, slug, icon, sort_order, is_active").order("sort_order", { ascending: true });
        allTrainingPaths = pathRes.data || [];
        pathMapById = {};
        allTrainingPaths.forEach(function (p) { pathMapById[p.id] = p; });
        populateCoursePathSelect();
    }

    function renderCoursesPagination(totalFiltered, totalPages) {
        if (!coursesPaginationEl) return;
        if (!totalFiltered) {
            coursesPaginationEl.innerHTML = "";
            return;
        }
        var from = coursesAdminPage * COURSES_PAGE_SIZE + 1;
        var to = Math.min(totalFiltered, (coursesAdminPage + 1) * COURSES_PAGE_SIZE);
        coursesPaginationEl.innerHTML =
            '<span>عرض ' + from + "–" + to + " من " + totalFiltered + " دورة</span>" +
            '<div class="adm-courses-pagination-btns">' +
                '<button type="button" data-cpage="prev"' + (coursesAdminPage <= 0 ? " disabled" : "") + ">السابق</button>" +
                '<span style="padding:0 0.5rem;">صفحة ' + (coursesAdminPage + 1) + " / " + totalPages + "</span>" +
                '<button type="button" data-cpage="next"' + (coursesAdminPage >= totalPages - 1 ? " disabled" : "") + ">التالي</button>" +
            "</div>";
    }

    function renderCoursesPage() {
        var filtered = getFilteredAdminCourses();
        var total = filtered.length;
        var totalPages = Math.max(1, Math.ceil(total / COURSES_PAGE_SIZE) || 1);
        if (coursesAdminPage >= totalPages) coursesAdminPage = totalPages - 1;
        if (coursesAdminPage < 0) coursesAdminPage = 0;
        var slice = filtered.slice(coursesAdminPage * COURSES_PAGE_SIZE, (coursesAdminPage + 1) * COURSES_PAGE_SIZE);
        renderCourses(slice, total, totalPages);
    }

    async function loadCourses(forceReload) {
        if (!coursesBody) return;
        if (coursesCacheReady && !forceReload) {
            renderCoursesPage();
            return;
        }
        if (coursesLoadInFlight) {
            await coursesLoadInFlight;
            if (coursesCacheReady) renderCoursesPage();
            return;
        }

        coursesBody.innerHTML = '<tr><td colspan="11" class="no-data-msg">\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644...</td></tr>';
        if (coursesPaginationEl) coursesPaginationEl.innerHTML = "";

        coursesLoadInFlight = (async function () {
            await ensurePathsForCourses();

            var coursesRes = await sb.from("courses")
                .select("id, title, instructor, duration, category, max_seats, is_active, created_at, training_path_id, content_type, price_type, price_amount, course_enrollments(count)")
                .order("created_at", { ascending: false });

            if (coursesRes.error) {
                coursesRes = await sb.from("courses")
                    .select("id, title, instructor, duration, category, max_seats, is_active, created_at, training_path_id, content_type, price_type, price_amount")
                    .order("created_at", { ascending: false });
            }

            allCourses = coursesRes.data || [];
            enrollCountMap = {};
            allCourses.forEach(function (c) {
                c._enrollCount = parseCourseEnrollCount(c);
                enrollCountMap[c.id] = c._enrollCount;
                delete c.course_enrollments;
            });

            if (!coursesRes.error && allCourses.length && !Object.keys(enrollCountMap).some(function (k) { return enrollCountMap[k] > 0; })) {
                if (allEnrollmentRows.length) {
                    enrollCountMap = buildEnrollCountMap(allEnrollmentRows);
                } else {
                    var er = await sb.from("course_enrollments").select("course_id");
                    enrollCountMap = buildEnrollCountMap(er.data);
                }
                allCourses.forEach(function (c) {
                    c._enrollCount = enrollCountMap[c.id] || 0;
                });
            }

            coursesCacheReady = true;
            coursesAdminPage = 0;
            renderCoursesPage();
        })();

        try {
            await coursesLoadInFlight;
        } finally {
            coursesLoadInFlight = null;
        }
    }

    if (coursesPaginationEl) {
        coursesPaginationEl.addEventListener("click", function (e) {
            var btn = e.target.closest("[data-cpage]");
            if (!btn || btn.disabled) return;
            if (btn.getAttribute("data-cpage") === "prev") coursesAdminPage--;
            else coursesAdminPage++;
            renderCoursesPage();
        });
    }

    var coursesAdminSearch = document.getElementById("coursesAdminSearch");
    if (coursesAdminSearch) {
        coursesAdminSearch.addEventListener("input", function () {
            if (!coursesBody) return;
            clearTimeout(coursesSearchTimer);
            coursesSearchTimer = setTimeout(function () {
                coursesAdminPage = 0;
                renderCoursesPage();
            }, 280);
        });
    }

    function renderCourses(list, totalFiltered, totalPages) {
        if (!coursesBody) return;
        if (!list.length) {
            var inp = document.getElementById("coursesAdminSearch");
            var hasFilter = inp && (inp.value || "").trim();
            var msg = (allCourses.length && hasFilter)
                ? "لا نتائج مطابقة لبحثك في الدورات."
                : t("adm.dyn.noCourses");
            coursesBody.innerHTML = '<tr><td colspan="11" class="no-data-msg">' + esc(msg) + '</td></tr>';
            renderCoursesPagination(totalFiltered || 0, totalPages || 1);
            return;
        }
        var html = list.map(function (c) {
            var p = c.training_path_id ? pathMapById[c.training_path_id] : null;
            var pName = p ? p.name_ar : "—";
            var typ = c.content_type === "diploma" ? "دبلوم" : "دورة";
            var pr = c.price_type === "paid" && Number(c.price_amount) > 0 ? String(c.price_amount) + " ر.س" : "مجاني";
            var visBadge = c.is_active
                ? '<span class="badge badge-accepted">معروض</span>'
                : '<span class="badge badge-rejected">مخفي</span>';
            return '<tr>' +
                "<td>" + esc(pName) + "</td>" +
                "<td>" + esc(typ) + "</td>" +
                "<td>" + esc(pr) + "</td>" +
                '<td>' + esc(c.title || "\u2014") + '</td>' +
                '<td>' + esc(c.instructor || "\u2014") + '</td>' +
                '<td>' + esc(c.duration || "\u2014") + '</td>' +
                '<td>' + esc(c.category || "\u2014") + '</td>' +
                '<td><strong>' + (c._enrollCount != null ? c._enrollCount : (enrollCountMap[c.id] || 0)) + '</strong></td>' +
                '<td>' + fmtDate(c.created_at) + '</td>' +
                "<td>" + visBadge + "</td>" +
                '<td><div class="dashboard-actions">' +
                    '<button type="button" class="dashboard-btn dashboard-btn-edit" data-action="course-toggle-active" data-cid="' + esc(c.id) + '" data-active="' + (c.is_active ? "1" : "0") + '">' +
                    (c.is_active ? "إخفاء عن الموقع" : "إظهار في الموقع") + "</button>" +
                    '<button class="dashboard-btn dashboard-btn-edit" data-action="edit-course" data-cid="' + esc(c.id) + '" data-title="' + esc(c.title || "") + '" data-inst="' + esc(c.instructor || "") + '" data-cat="' + esc(c.category || "") + '" data-dur="' + esc(c.duration || "") + '">' + t("adm.dyn.edit") + '</button>' +
                    '<button class="dashboard-btn dashboard-btn-edit" data-action="view-enrollments" data-cid="' + esc(c.id) + '" data-ctitle="' + esc(c.title || "") + '">' + t("adm.dyn.viewEnrollments") + '</button>' +
                    '<button class="dashboard-btn dashboard-btn-delete" data-action="delete-course" data-cid="' + esc(c.id) + '">' + t("adm.dyn.delete") + '</button>' +
                '</div></td>' +
            '</tr>';
        }).join("");
        coursesBody.innerHTML = html;
        renderCoursesPagination(totalFiltered || list.length, totalPages || 1);
    }

    if (addCourseForm) {
        addCourseForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            var title       = (document.getElementById("courseTitle") || {}).value || "";
            var instructor  = (document.getElementById("courseInstructor") || {}).value || "";
            var duration    = (document.getElementById("courseDuration") || {}).value || "";
            var category    = (document.getElementById("courseCategory") || {}).value || "";
            var seats       = parseInt((document.getElementById("courseSeats") || {}).value || "0", 10);
            var description = (document.getElementById("courseDescription") || {}).value || "";
            var pathId      = (document.getElementById("courseTrainingPathId") || {}).value || "";
            var contentType = (document.getElementById("courseContentType") || {}).value || "course";
            var priceType   = (document.getElementById("coursePriceType") || {}).value || "free";
            var priceAmt    = parseFloat((document.getElementById("coursePriceAmount") || {}).value || "0");
            if (!title.trim()) { if (addCourseMsg) { addCourseMsg.textContent = t("adm.course.titleRequired"); addCourseMsg.style.color="#f87171"; } return; }
            var row = {
                title: title.trim(),
                instructor: instructor.trim() || null,
                duration: duration.trim() || null,
                category: category.trim() || null,
                max_seats: isNaN(seats) ? 0 : seats,
                description: description.trim() || null,
                created_by: user.id,
                training_path_id: pathId || null,
                content_type: contentType === "diploma" ? "diploma" : "course",
                price_type: priceType === "paid" ? "paid" : "free",
                price_amount: priceType === "paid" && !isNaN(priceAmt) ? priceAmt : 0,
                is_active: true
            };
            var res = await sb.from("courses").insert(row);
            if (res.error) {
                if (addCourseMsg) { addCourseMsg.textContent = t("adm.course.publishError") + ": " + res.error.message; addCourseMsg.style.color="#f87171"; }
                return;
            }
            if (addCourseMsg) { addCourseMsg.textContent = t("adm.course.publishSuccess"); addCourseMsg.style.color="#4ade80"; }
            addCourseForm.reset();
            coursesCacheReady = false;
            await loadCourses(true);
            syncOverviewFromCourses();
        });
    }

    if (coursesBody) {
        coursesBody.addEventListener("click", async function (e) {
            var actBtn = e.target.closest("[data-action='course-toggle-active']");
            if (actBtn) {
                var cid0 = actBtn.getAttribute("data-cid");
                var curA = actBtn.getAttribute("data-active") === "1";
                var resA = await sb.from("courses").update({ is_active: !curA }).eq("id", cid0);
                if (resA.error) { alert("تعذّر تحديث حالة الظهور"); return; }
                coursesCacheReady = false;
                await loadCourses(true);
                syncOverviewFromCourses();
                return;
            }
            var editBtn = e.target.closest("[data-action='edit-course']");
            var delBtn  = e.target.closest("[data-action='delete-course']");
            var viewBtn = e.target.closest("[data-action='view-enrollments']");
            if (editBtn) {
                var cid = editBtn.dataset.cid;
                var nt = prompt("عنوان الدورة:", editBtn.dataset.title || "");
                if (!nt || !nt.trim()) return;
                var ni = prompt("المدرب (اختياري):", editBtn.dataset.inst || "");
                var nc = prompt("الفئة (اختياري):", editBtn.dataset.cat || "");
                var nd = prompt("المدة (اختياري):", editBtn.dataset.dur || "");
                var res = await sb.from("courses").update({
                    title: nt.trim(),
                    instructor: ni ? ni.trim() : null,
                    category: nc ? nc.trim() : null,
                    duration: nd ? nd.trim() : null
                }).eq("id", cid);
                if (res.error) { alert("تعذّر التعديل."); return; }
                coursesCacheReady = false;
                await loadCourses(true);
                syncOverviewFromCourses();
            }
            if (delBtn) {
                if (!confirm("\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u062d\u0630\u0641 \u0647\u0630\u0647 \u0627\u0644\u062f\u0648\u0631\u0629\u061f")) return;
                var resDel = await sb.from("courses").delete().eq("id", delBtn.dataset.cid);
                if (resDel.error) { alert("\u062a\u0639\u0630\u0651\u0631 \u0627\u0644\u062d\u0630\u0641."); return; }
                coursesCacheReady = false;
                await loadCourses(true);
                syncOverviewFromCourses();
            }
            if (viewBtn) {
                await loadCourseEnrollments(viewBtn.dataset.cid, viewBtn.dataset.ctitle);
            }
        });
    }
    var currentEnrollmentTitle = "";

    async function loadCourseEnrollments(courseId, courseTitle) {
        var panel  = document.getElementById("courseEnrollmentsPanel");
        var tbody  = document.getElementById("enrollmentsTableBody");
        var titleEl = document.getElementById("enrollmentsPanelTitle");
        if (!panel || !tbody) return;
        currentEnrollmentTitle = courseTitle || "دورة";
        panel.style.display = "block";
        if (titleEl) titleEl.textContent = t("adm.enrollments.title") + ": " + currentEnrollmentTitle;
        var pathLine = document.getElementById("enrollmentsPathLine");
        var cr0 = allCourses.find(function (x) { return x.id === courseId; });
        var pst = "";
        if (cr0 && cr0.training_path_id) {
            var pm = pathMapById[cr0.training_path_id];
            if (pm && pm.name_ar) pst = "المسار: " + pm.name_ar;
            else if (window.maherDefaultTrainingPaths) {
                var fd = window.maherDefaultTrainingPaths.find(function (x) { return x.id === cr0.training_path_id; });
                if (fd) pst = "المسار: " + fd.name_ar;
            }
        }
        if (pathLine) {
            pathLine.textContent = pst;
            pathLine.style.display = pst ? "block" : "none";
        }
        tbody.innerHTML = '<tr><td colspan="6" class="no-data-msg">' + t("adm.dyn.loading") + '</td></tr>';
        panel.scrollIntoView({ behavior: "smooth", block: "start" });

        var res = await sb.from("course_enrollments").select("user_id, status, created_at").eq("course_id", courseId).order("created_at", { ascending: false });
        currentEnrollmentRows = res.data || [];
        if (!currentEnrollmentRows.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data-msg">' + t("adm.dyn.noEnrollments") + '</td></tr>';
            return;
        }

        tbody.innerHTML = currentEnrollmentRows.map(function (r) {
            var p = profileMap[r.user_id] || {};
            var statusBadge = r.status === "completed"
                ? '<span class="badge badge-accepted">'      + t("adm.dyn.statusCompleted") + '</span>'
                : r.status === "cancelled"
                ? '<span class="badge badge-rejected">'      + t("adm.dyn.statusCancelled") + '</span>'
                : '<span class="badge badge-pending-status">' + t("adm.dyn.statusEnrolled")  + '</span>';
            var phone = p.phone ? '<a href="tel:' + esc(p.phone) + '" class="phone-link">' + esc(p.phone) + '</a>' : "\u2014";
            return '<tr>' +
                '<td>' + esc(p.full_name || "\u2014") + '</td>' +
                '<td>' + esc(p.email    || "\u2014") + '</td>' +
                '<td>' + phone + '</td>' +
                '<td>' + roleLabel(p.role || "") + '</td>' +
                '<td>' + fmtDate(r.created_at) + '</td>' +
                '<td>' + statusBadge + '</td>' +
            '</tr>';
        }).join("");
    }

    /* ── Export enrollments to Excel ── */
    var exportEnrBtn = document.getElementById("exportEnrollmentsBtn");
    if (exportEnrBtn) {
        exportEnrBtn.addEventListener("click", function () {
            if (!currentEnrollmentRows.length) return;

            var statusMap = { completed: "مكتمل", cancelled: "ملغى", enrolled: "مسجّل" };
            var roleMap   = { company: "قديم", super_admin: "أدمن", job_seeker: "متدرب" };

            // Build data array (header + rows)
            var data = [["#", "الاسم الكامل", "البريد الإلكتروني", "رقم الجوال", "الدور", "تاريخ التسجيل", "الحالة"]];
            currentEnrollmentRows.forEach(function (r, i) {
                var p = profileMap[r.user_id] || {};
                data.push([
                    i + 1,
                    p.full_name || "—",
                    p.email     || "—",
                    p.phone     || "—",
                    roleMap[p.role] || p.role || "—",
                    fmtDate(r.created_at),
                    statusMap[r.status] || r.status || "—"
                ]);
            });

            var wb  = XLSX.utils.book_new();
            var ws  = XLSX.utils.aoa_to_sheet(data);

            // Column widths
            ws["!cols"] = [
                { wch: 5  },  // #
                { wch: 22 },  // name
                { wch: 30 },  // email
                { wch: 16 },  // phone
                { wch: 10 },  // role
                { wch: 18 },  // date
                { wch: 12 }   // status
            ];

            XLSX.utils.book_append_sheet(wb, ws, currentEnrollmentTitle || "المسجلون");

            var safeName = (currentEnrollmentTitle || "المسجلون").replace(/[\\/:*?"<>|]/g, "_");
            XLSX.writeFile(wb, "مسجلو " + safeName + ".xlsx");
        });
    }

    var closeEnrPanel = document.getElementById("closeEnrollmentsPanel");
    if (closeEnrPanel) {
        closeEnrPanel.addEventListener("click", function () {
            var panel = document.getElementById("courseEnrollmentsPanel");
            if (panel) panel.style.display = "none";
        });
    }

    /* ── Promotion Requests (primary admin only) ────────────────── */
    var promoReqBody = document.getElementById("promoReqTableBody");
    var allPromoReqs = [];

    async function loadPromoRequests() {
        if (!promoReqBody || !isSuperPrimary) return;
        promoReqBody.innerHTML = '<div class="prq-loading">' + t("adm.dyn.loading") + '</div>';
        var resp = await sb.from("admin_promotion_requests")
            .select("id, requested_by, target_user_id, status, created_at")
            .order("created_at", { ascending: false });
        allPromoReqs = resp.data || [];
        renderPromoReqs(allPromoReqs);
    }

    function initials(name) {
        if (!name) return "?";
        var parts = name.trim().split(" ");
        return parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0][0];
    }

    function renderPromoReqs(list) {
        if (!promoReqBody) return;

        /* stats strip */
        var statsEl = document.getElementById("prqStats");
        if (statsEl) {
            var pending  = list.filter(function (r) { return r.status === "pending";  }).length;
            var approved = list.filter(function (r) { return r.status === "approved"; }).length;
            var rejected = list.filter(function (r) { return r.status === "rejected"; }).length;
            statsEl.innerHTML =
                '<div class="prq-stat"><span class="prq-stat-num">' + list.length + '</span><span class="prq-stat-lbl">' + t("adm.promo.total")    + '</span></div>' +
                '<div class="prq-stat prq-stat--pending"><span class="prq-stat-num">' + pending  + '</span><span class="prq-stat-lbl">' + t("adm.dyn.statusPending")  + '</span></div>' +
                '<div class="prq-stat prq-stat--approved"><span class="prq-stat-num">' + approved + '</span><span class="prq-stat-lbl">' + t("adm.dyn.statusApproved") + '</span></div>' +
                '<div class="prq-stat prq-stat--rejected"><span class="prq-stat-num">' + rejected + '</span><span class="prq-stat-lbl">' + t("adm.dyn.statusRejected") + '</span></div>';
        }

        if (!list.length) {
            promoReqBody.innerHTML =
                '<div class="prq-empty">' +
                '<div class="prq-empty-icon">📭</div>' +
                '<p class="prq-empty-text">' + t("adm.promo.empty") + '</p>' +
                '</div>';
            return;
        }

        promoReqBody.innerHTML = list.map(function (r) {
            var req = profileMap[r.requested_by]   || {};
            var tgt = profileMap[r.target_user_id] || {};

            var statusClass = r.status === "approved" ? "prq-status--approved"
                            : r.status === "rejected" ? "prq-status--rejected"
                            : "prq-status--pending";
            var statusTxt   = r.status === "approved" ? "\u2705 " + t("adm.dyn.statusApproved")
                            : r.status === "rejected"  ? "\u274c " + t("adm.dyn.statusRejected")
                            : "\u23f3 "                             + t("adm.dyn.statusPending");

            var reqRole  = roleLabel(req.role || "");
            var tgtRole  = roleLabel(tgt.role || "");

            var actionsHtml = r.status === "pending"
                ? '<div class="prq-card-actions">' +
                      '<button class="prq-btn-approve" data-action="promo-approve" data-rid="' + esc(r.id) + '" data-uid="' + esc(r.target_user_id) + '">\u2714 ' + t("adm.dyn.approve") + '</button>' +
                      '<button class="prq-btn-reject"  data-action="promo-reject"  data-rid="' + esc(r.id) + '">\u2715 ' + t("adm.dyn.reject") + '</button>' +
                  '</div>'
                : "";

            var reqInitials = initials(req.full_name || req.email || "");
            var tgtInitials = initials(tgt.full_name || tgt.email || "");

            return '<div class="prq-card" data-status="' + esc(r.status) + '">' +
                '<div class="prq-card-top">' +
                    '<span class="prq-date">' + fmtDate(r.created_at) + '</span>' +
                    '<span class="prq-status ' + statusClass + '">' + statusTxt + '</span>' +
                '</div>' +
                '<div class="prq-card-mid">' +
                    /* Requester */
                    '<div class="prq-party">' +
                        '<div class="prq-party-lbl">' + t("adm.promo.requester") + '</div>' +
                        '<div class="prq-avatar prq-avatar--req">' + esc(reqInitials) + '</div>' +
                        '<div class="prq-party-name">' + esc(req.full_name || "\u2014") + '</div>' +
                        '<div class="prq-party-meta"><span>✉</span> ' + esc(req.email || "\u2014") + '</div>' +
                        (req.phone ? '<div class="prq-party-meta"><span>📱</span> <a href="tel:' + esc(req.phone) + '">' + esc(req.phone) + '</a></div>' : '') +
                        (req.specialization ? '<div class="prq-party-meta"><span>🎓</span> ' + esc(req.specialization) + '</div>' : '') +
                        '<div class="prq-party-role">' + reqRole + '</div>' +
                    '</div>' +
                    /* Arrow */
                    '<div class="prq-arrow">' +
                        '<div class="prq-arrow-line"></div>' +
                        '<div class="prq-arrow-label">' + t("adm.promo.wantsPromo") + '</div>' +
                        '<div class="prq-arrow-icon">←</div>' +
                    '</div>' +
                    /* Target */
                    '<div class="prq-party">' +
                        '<div class="prq-party-lbl">' + t("adm.promo.targetUser") + '</div>' +
                        '<div class="prq-avatar prq-avatar--tgt">' + esc(tgtInitials) + '</div>' +
                        '<div class="prq-party-name">' + esc(tgt.full_name || "\u2014") + '</div>' +
                        '<div class="prq-party-meta"><span>✉</span> ' + esc(tgt.email || "\u2014") + '</div>' +
                        (tgt.phone ? '<div class="prq-party-meta"><span>📱</span> <a href="tel:' + esc(tgt.phone) + '">' + esc(tgt.phone) + '</a></div>' : '') +
                        (tgt.specialization ? '<div class="prq-party-meta"><span>🎓</span> ' + esc(tgt.specialization) + '</div>' : '') +
                        '<div class="prq-party-role prq-party-role--target">' + tgtRole + ' → ' + t("adm.promo.targetRole") + '</div>' +
                    '</div>' +
                '</div>' +
                actionsHtml +
            '</div>';
        }).join("");
    }

    if (promoReqBody) {
        promoReqBody.addEventListener("click", async function (e) {
            var btn = e.target.closest("[data-action^='promo-']");
            if (!btn) return;
            var rid = btn.dataset.rid;
            btn.disabled = true;
            btn.textContent = "...";
            if (btn.dataset.action === "promo-approve") {
                var uid = btn.dataset.uid;
                var r1 = await sb.from("profiles").update({ role: "super_admin" }).eq("id", uid);
                if (r1.error) { showToast("\u062a\u0639\u0630\u0651\u0631 \u0627\u0644\u062a\u0631\u0642\u064a\u0629.", "error"); btn.disabled = false; btn.textContent = "\u2714 \u0645\u0648\u0627\u0641\u0642\u0629"; return; }
                await sb.from("admin_promotion_requests").update({ status: "approved" }).eq("id", rid);
                if (profileMap[uid]) profileMap[uid].role = "super_admin";
                renderStats();
                showToast("\u2705 \u062a\u0645\u062a \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0648\u062a\u0631\u0642\u064a\u0629 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0644\u0645\u0634\u0631\u0641 \u0639\u0627\u0645.", "success");
            } else {
                var r2 = await sb.from("admin_promotion_requests").update({ status: "rejected" }).eq("id", rid);
                if (r2.error) { showToast("\u062a\u0639\u0630\u0651\u0631 \u0627\u0644\u0631\u0641\u0636.", "error"); btn.disabled = false; btn.textContent = "\u2715 \u0631\u0641\u0636"; return; }
                showToast("\u062a\u0645 \u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628.", "success");
            }
            await loadPromoRequests();
        });
    }

    /* ── Re-render on language change ─────────────────────────────── */
    document.addEventListener("maherLangChanged", function () {
        filterUsers();
        if (document.getElementById("appJobFilter")) populateJobFilter();
        var activeTab = document.querySelector(".dash-tab.active");
        if (activeTab) {
            var tabName = activeTab.dataset.tab;
            if (tabName === "courses")        renderCoursesPage();
            if (tabName === "promo-requests") renderPromoReqs(allPromoReqs);
        }
    });

    /* init */
    await loadAll();
    await loadTrainingPathsAdmin();
    void loadAdminNotifications();
});
