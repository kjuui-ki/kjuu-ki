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

    /* tab management */
    var tabs     = document.querySelectorAll(".dash-tab");
    var contents = document.querySelectorAll(".dash-tab-content");

    /* Show promo-requests tab only for primary admin */
    if (isSuperPrimary) {
        var _promoTab = document.getElementById("promoReqTab");
        if (_promoTab) _promoTab.style.display = "";
    }

    tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            tabs.forEach(function (t) { t.classList.remove("active"); });
            contents.forEach(function (c) { c.style.display = "none"; });
            tab.classList.add("active");
            var panel = document.getElementById("tab-" + tab.dataset.tab);
            if (panel) panel.style.display = "block";
            if (tab.dataset.tab === "staff-requests")  loadStaffRequests();
            if (tab.dataset.tab === "course-requests") loadCourseRequests();
            if (tab.dataset.tab === "courses")         loadCourses();
            if (tab.dataset.tab === "promo-requests")  loadPromoRequests();
        });
    });

    /* data */
    var allProfiles      = [];
    var allJobs          = [];
    var allApps          = [];
    var allStaffRequests = [];
    var profileMap       = {};
    var jobMap      = {};

    async function loadAll() {
        var results = await Promise.all([
            sb.from("profiles").select("id, full_name, email, role, phone, specialization, cv_url, created_at").order("created_at", { ascending: false }),
            sb.from("jobs").select("id, title, location, job_type, company_id, created_at").order("created_at", { ascending: false }),
            sb.from("applications").select("id, user_id, job_id, full_name, phone, specialization, status, cv_url, created_at").order("created_at", { ascending: false })
        ]);
        allProfiles = results[0].data || [];
        allJobs     = results[1].data || [];
        allApps     = results[2].data || [];
        allProfiles.forEach(function (p) { profileMap[p.id] = p; });
        allJobs.forEach(function (j) { jobMap[j.id] = j; });
        renderStats();
        renderUsers(allProfiles);
        renderJobs(allJobs);
        populateJobFilter();
        filterApps();
    }

    /* stats */
    function renderStats() {
        var seekers   = allProfiles.filter(function (p) { return p.role === "job_seeker"; }).length;
        var companies = allProfiles.filter(function (p) { return p.role === "company"; }).length;
        document.getElementById("statSeekers").textContent      = seekers;
        document.getElementById("statCompanies").textContent    = companies;
        document.getElementById("statJobs").textContent         = allJobs.length;
        document.getElementById("statApplications").textContent = allApps.length;
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
                        '<option value="company"'     + (p.role === "company"     ? " selected" : "") + '>' + t("adm.dyn.roleCompany") + '</option>' +
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
    var addCourseForm = document.getElementById("addCourseForm");
    var addCourseMsg  = document.getElementById("addCourseMsg");
    var allCourses   = [];
    var enrollCountMap = {};

    async function loadCourses() {
        if (!coursesBody) return;
        coursesBody.innerHTML = '<tr><td colspan="7" class="no-data-msg">\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644...</td></tr>';

        var results = await Promise.all([
            sb.from("courses").select("id, title, instructor, duration, category, max_seats, is_active, created_at").order("created_at", { ascending: false }),
            sb.from("course_enrollments").select("course_id")
        ]);
        allCourses = results[0].data || [];
        var enrollments = results[1].data || [];

        enrollCountMap = {};
        enrollments.forEach(function (e) {
            enrollCountMap[e.course_id] = (enrollCountMap[e.course_id] || 0) + 1;
        });
        renderCourses(allCourses);
    }

    function renderCourses(list) {
        if (!coursesBody) return;
        if (!list.length) { coursesBody.innerHTML = '<tr><td colspan="7" class="no-data-msg">' + t("adm.dyn.noCourses") + '</td></tr>'; return; }
        coursesBody.innerHTML = list.map(function (c) {
            return '<tr>' +
                '<td>' + esc(c.title || "\u2014") + '</td>' +
                '<td>' + esc(c.instructor || "\u2014") + '</td>' +
                '<td>' + esc(c.duration || "\u2014") + '</td>' +
                '<td>' + esc(c.category || "\u2014") + '</td>' +
                '<td><strong>' + (enrollCountMap[c.id] || 0) + '</strong></td>' +
                '<td>' + fmtDate(c.created_at) + '</td>' +
                '<td><div class="dashboard-actions">' +
                    '<button class="dashboard-btn dashboard-btn-edit" data-action="view-enrollments" data-cid="' + esc(c.id) + '" data-ctitle="' + esc(c.title || "") + '">' + t("adm.dyn.viewEnrollments") + '</button>' +
                    '<button class="dashboard-btn dashboard-btn-delete" data-action="delete-course" data-cid="' + esc(c.id) + '">' + t("adm.dyn.delete") + '</button>' +
                '</div></td>' +
            '</tr>';
        }).join("");
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
            if (!title.trim()) { if (addCourseMsg) { addCourseMsg.textContent = t("adm.course.titleRequired"); addCourseMsg.style.color="#f87171"; } return; }
            var res = await sb.from("courses").insert({
                title: title.trim(),
                instructor: instructor.trim() || null,
                duration: duration.trim() || null,
                category: category.trim() || null,
                max_seats: isNaN(seats) ? 0 : seats,
                description: description.trim() || null,
                created_by: user.id
            });
            if (res.error) {
                if (addCourseMsg) { addCourseMsg.textContent = t("adm.course.publishError") + ": " + res.error.message; addCourseMsg.style.color="#f87171"; }
                return;
            }
            if (addCourseMsg) { addCourseMsg.textContent = t("adm.course.publishSuccess"); addCourseMsg.style.color="#4ade80"; }
            addCourseForm.reset();
            await loadCourses();
        });
    }

    if (coursesBody) {
        coursesBody.addEventListener("click", async function (e) {
            var delBtn  = e.target.closest("[data-action='delete-course']");
            var viewBtn = e.target.closest("[data-action='view-enrollments']");
            if (delBtn) {
                if (!confirm("\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u062d\u0630\u0641 \u0647\u0630\u0647 \u0627\u0644\u062f\u0648\u0631\u0629\u061f")) return;
                var res = await sb.from("courses").delete().eq("id", delBtn.dataset.cid);
                if (res.error) { alert("\u062a\u0639\u0630\u0651\u0631 \u0627\u0644\u062d\u0630\u0641."); return; }
                await loadCourses();
            }
            if (viewBtn) {
                await loadCourseEnrollments(viewBtn.dataset.cid, viewBtn.dataset.ctitle);
            }
        });
    }

    var currentEnrollmentRows  = [];
    var currentEnrollmentTitle = "";

    async function loadCourseEnrollments(courseId, courseTitle) {
        var panel  = document.getElementById("courseEnrollmentsPanel");
        var tbody  = document.getElementById("enrollmentsTableBody");
        var titleEl = document.getElementById("enrollmentsPanelTitle");
        if (!panel || !tbody) return;
        currentEnrollmentTitle = courseTitle || "دورة";
        panel.style.display = "block";
        if (titleEl) titleEl.textContent = t("adm.enrollments.title") + ": " + currentEnrollmentTitle;
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
            var roleMap   = { company: "شركة", super_admin: "أدمن", job_seeker: "باحث" };

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
        populateJobFilter();
        var activeTab = document.querySelector(".dash-tab.active");
        if (activeTab) {
            var tabName = activeTab.dataset.tab;
            if (tabName === "jobs")            renderJobs(allJobs);
            if (tabName === "applications")    filterApps();
            if (tabName === "staff-requests")  renderStaffRequests(staffReqFilter && staffReqFilter.value ? allStaffRequests.filter(function (r) { return r.status === staffReqFilter.value; }) : allStaffRequests);
            if (tabName === "course-requests") renderCourseRequests(courseReqFilter && courseReqFilter.value ? allCourseRequests.filter(function (r) { return r.status === courseReqFilter.value; }) : allCourseRequests);
            if (tabName === "courses")         renderCourses(allCourses);
            if (tabName === "promo-requests")  renderPromoReqs(allPromoReqs);
        }
    });

    /* init */
    await loadAll();
});
