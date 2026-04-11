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

    var displayName = profile.full_name || profile.email || user.email || "Admin";
    var nameEl = document.getElementById("adminName");
    if (nameEl) nameEl.textContent = displayName;

    /* helpers */
    function esc(v) {
        return String(v || "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function fmtDate(v) {
        if (!v) return "\u2014";
        return new Date(v).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
    }
    function statusLabel(s) {
        if (s === "accepted") return '<span class="badge badge-accepted">\u0645\u0642\u0628\u0648\u0644</span>';
        if (s === "rejected") return '<span class="badge badge-rejected">\u0645\u0631\u0641\u0648\u0636</span>';
        return '<span class="badge badge-pending-status">\u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629</span>';
    }
    function roleLabel(r) {
        if (r === "job_seeker")  return '<span class="badge badge-role-seeker">\u0628\u0627\u062d\u062b</span>';
        if (r === "company")     return '<span class="badge badge-role-company">\u0634\u0631\u0643\u0629</span>';
        if (r === "super_admin") return '<span class="badge badge-role-admin">\u0623\u062f\u0645\u0646</span>';
        return '<span class="badge">' + esc(r) + '</span>';
    }

    /* tab management */
    var tabs     = document.querySelectorAll(".dash-tab");
    var contents = document.querySelectorAll(".dash-tab-content");
    tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            tabs.forEach(function (t) { t.classList.remove("active"); });
            contents.forEach(function (c) { c.style.display = "none"; });
            tab.classList.add("active");
            var panel = document.getElementById("tab-" + tab.dataset.tab);
            if (panel) panel.style.display = "block";
            if (tab.dataset.tab === "staff-requests") loadStaffRequests();
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
        if (!list.length) { usersBody.innerHTML = '<tr><td colspan="6" class="no-data-msg">\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646.</td></tr>'; return; }
        usersBody.innerHTML = list.map(function (p) {
            var cv = p.cv_url ? '<a href="' + esc(p.cv_url) + '" target="_blank" class="btn-link">\u0639\u0631\u0636</a>' : "\u2014";
            return '<tr>' +
                '<td>' + esc(p.full_name || "\u2014") + '</td>' +
                '<td>' + esc(p.email || "\u2014") + '</td>' +
                '<td>' + roleLabel(p.role) + '</td>' +
                '<td>' + fmtDate(p.created_at) + '</td>' +
                '<td>' + cv + '</td>' +
                '<td><div class="dashboard-actions">' +
                    '<select class="admin-select-sm role-select" data-uid="' + esc(p.id) + '">' +
                        '<option value="job_seeker"' + (p.role === "job_seeker" ? " selected" : "") + '>\u0628\u0627\u062d\u062b</option>' +
                        '<option value="company"'    + (p.role === "company"    ? " selected" : "") + '>\u0634\u0631\u0643\u0629</option>' +
                        '<option value="super_admin"'+ (p.role === "super_admin"? " selected" : "") + '>\u0623\u062f\u0645\u0646</option>' +
                    '</select>' +
                    '<button class="dashboard-btn dashboard-btn-delete" data-action="delete-user" data-uid="' + esc(p.id) + '">\u062d\u0630\u0641</button>' +
                '</div></td>' +
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
        if (!list.length) { jobsBody.innerHTML = '<tr><td colspan="6" class="no-data-msg">\u0644\u0627 \u062a\u0648\u062c\u062f \u0648\u0638\u0627\u0626\u0641.</td></tr>'; return; }
        jobsBody.innerHTML = list.map(function (j) {
            var company = profileMap[j.company_id] || {};
            return '<tr>' +
                '<td>' + esc(j.title || "\u2014") + '</td>' +
                '<td>' + esc(company.full_name || "\u2014") + '</td>' +
                '<td>' + esc(j.location || "\u2014") + '</td>' +
                '<td>' + esc(j.job_type || "\u2014") + '</td>' +
                '<td>' + fmtDate(j.created_at) + '</td>' +
                '<td><div class="dashboard-actions">' +
                    '<button class="dashboard-btn dashboard-btn-edit" data-action="edit-job" data-jid="' + esc(j.id) + '" data-title="' + esc(j.title || "") + '">\u062a\u0639\u062f\u064a\u0644</button>' +
                    '<button class="dashboard-btn dashboard-btn-delete" data-action="delete-job" data-jid="' + esc(j.id) + '">\u062d\u0630\u0641</button>' +
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
        appJobFilter.innerHTML = '<option value="">' +
            '\u0643\u0644 \u0627\u0644\u0648\u0638\u0627\u0626\u0641 \u25be</option>';
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
        if (!list.length) { appsBody.innerHTML = '<tr><td colspan="9" class="no-data-msg">\u0644\u0627 \u062a\u0648\u062c\u062f \u0637\u0644\u0628\u0627\u062a.</td></tr>'; return; }
        appsBody.innerHTML = list.map(function (a) {
            var seeker       = profileMap[a.user_id] || {};
            var job          = jobMap[a.job_id] || {};
            var name         = a.full_name      || seeker.full_name      || "\u2014";
            var email        = seeker.email     || "\u2014";
            var phone        = a.phone          || seeker.phone          || "\u2014";
            var specialization = a.specialization || seeker.specialization || "\u2014";
            var jobTitle     = job.title        || "\u2014";
            var cvUrl        = a.cv_url         || seeker.cv_url;
            var cv           = cvUrl ? '<a href="' + esc(cvUrl) + '" target="_blank" class="btn-link">\u0639\u0631\u0636 CV</a>' : "\u2014";
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
                    '<button class="dashboard-btn dashboard-btn-accept" data-action="app-accept" data-aid="' + esc(a.id) + '">\u0642\u0628\u0648\u0644</button>' +
                    '<button class="dashboard-btn dashboard-btn-reject" data-action="app-reject" data-aid="' + esc(a.id) + '">\u0631\u0641\u0636</button>' +
                '</div></td>' +
            '</tr>';
        }).join("");
    }
    if (appFilter)    appFilter.addEventListener("change",    filterApps);
    if (appJobFilter) appJobFilter.addEventListener("change", filterApps);

    /* export applications to CSV */
    var exportBtn = document.getElementById("exportAppsBtn");
    if (exportBtn) {
        exportBtn.addEventListener("click", function () {

            /* determine which rows to export (same filter as table) */
            var statusVal = appFilter    ? appFilter.value    : "";
            var jobVal    = appJobFilter ? appJobFilter.value : "";
            var rows = allApps.filter(function (a) {
                var matchStatus = !statusVal || (a.status || "pending") === statusVal;
                var matchJob    = !jobVal    || a.job_id === jobVal;
                return matchStatus && matchJob;
            });

            if (!rows.length) { alert("\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0644\u0644\u062a\u0635\u062f\u064a\u0631."); return; }

            /* wrap cell in quotes to protect semicolons/newlines inside values */
            function cell(v) {
                var s = String(v == null ? "" : v).trim();
                return '"' + s.replace(/"/g, '""') + '"';
            }

            var statusText = {
                accepted: "\u0645\u0642\u0628\u0648\u0644",
                rejected: "\u0645\u0631\u0641\u0648\u0636",
                pending:  "\u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629"
            };

            /* headers — 8 columns, semicolon separator for Arabic Excel */
            var SEP   = ";";
            var lines = [];
            lines.push([
                "\u0627\u0644\u0627\u0633\u0645",
                "\u0627\u0644\u0628\u0631\u064a\u062f",
                "\u0631\u0642\u0645 \u0627\u0644\u062c\u0648\u0627\u0644",
                "\u0627\u0644\u062a\u062e\u0635\u0635",
                "\u0627\u0644\u0648\u0638\u064a\u0641\u0629",
                "\u0627\u0644\u062d\u0627\u0644\u0629",
                "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0642\u062f\u064a\u0645",
                "\u0631\u0627\u0628\u0637 \u0627\u0644\u0633\u064a\u0631\u0629 \u0627\u0644\u0630\u0627\u062a\u064a\u0629"
            ].map(cell).join(SEP));

            rows.forEach(function (a) {
                var seeker         = profileMap[a.user_id] || {};
                var job            = jobMap[a.job_id]      || {};
                var name           = a.full_name       || seeker.full_name       || "";
                var email          = seeker.email      || "";
                var phone          = a.phone           || seeker.phone           || "";
                var specialization = a.specialization  || seeker.specialization  || "";
                var jobTitle       = job.title         || "";
                var status         = statusText[a.status] || a.status || "";
                var date           = a.created_at ? new Date(a.created_at).toLocaleDateString("ar-SA") : "";
                var cv             = a.cv_url          || seeker.cv_url          || "";
                lines.push([name, email, phone, specialization, jobTitle, status, date, cv].map(cell).join(SEP));
            });

            /* dynamic filename: reflects selected job if filtered */
            var selectedJobTitle = jobVal && jobMap[jobVal] ? jobMap[jobVal].title : "";
            var filename = selectedJobTitle
                ? "\u0645\u062a\u0642\u062f\u0645\u0648_" + selectedJobTitle.replace(/[\\/:*?"<>|]/g, "_") + ".csv"
                : "applications.csv";

            /* UTF-8 BOM (\uFEFF) makes Excel open Arabic correctly */
            var csv  = "\uFEFF" + lines.join("\r\n");
            var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            var url  = URL.createObjectURL(blob);
            var link = document.createElement("a");
            link.href     = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
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
        if (s === "reviewed") return '<span class="badge badge-accepted">\u062a\u0645\u062a \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629</span>';
        if (s === "rejected") return '<span class="badge badge-rejected">\u0645\u0631\u0641\u0648\u0636</span>';
        return '<span class="badge badge-pending-status">\u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629</span>';
    }

    function renderStaffRequests(list) {
        if (!staffReqBody) return;
        if (!list.length) { staffReqBody.innerHTML = '<tr><td colspan="9" class="no-data-msg">\u0644\u0627 \u062a\u0648\u062c\u062f \u0637\u0644\u0628\u0627\u062a.</td></tr>'; return; }
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
                    '<button class="dashboard-btn dashboard-btn-accept" data-action="req-review" data-rid="' + esc(r.id) + '">\u0645\u0631\u0627\u062c\u0639\u0629</button>' +
                    '<button class="dashboard-btn dashboard-btn-reject" data-action="req-reject" data-rid="' + esc(r.id) + '">\u0631\u0641\u0636</button>' +
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

    /* init */
    await loadAll();
});
