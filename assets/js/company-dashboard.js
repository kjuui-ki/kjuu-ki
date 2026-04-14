document.addEventListener("DOMContentLoaded", async function () {
    "use strict";

    var sb = window.supabaseClient;
    if (!sb) return;

    // ── Auth check ────────────────────────────────────────────────
    var userResp = await sb.auth.getUser();
    var user = userResp.data && userResp.data.user ? userResp.data.user : null;
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    var profileResp = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
    var profile = profileResp.data;
    if (!profile || profile.role !== "company") {
        window.location.href = "login.html";
        return;
    }

    // Set company name in hero
    var nameEl = document.getElementById("companyDashName");
    if (nameEl) nameEl.textContent = profile.full_name || "شركتك";

    // ── Tab management ────────────────────────────────────────────
    var tabs = document.querySelectorAll(".dash-tab");
    var contents = document.querySelectorAll(".dash-tab-content");

    function activateTab(tabKey) {
        tabs.forEach(function (t) { t.classList.remove("active"); });
        contents.forEach(function (c) { c.style.display = "none"; });
        var targetTab = document.querySelector('.dash-tab[data-tab="' + tabKey + '"]');
        var targetPanel = document.getElementById("tab-" + tabKey);
        if (targetTab) targetTab.classList.add("active");
        if (targetPanel) targetPanel.style.display = "block";
        if (tabKey === "my-jobs") loadMyJobs();
        if (tabKey === "request-staff")  loadMyStaffRequests();
        if (tabKey === "request-course") loadMyCourseRequests();
    }

    tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            activateTab(tab.dataset.tab);
        });
    });

    // Auto-activate tab from URL param ?tab=my-jobs
    var urlTab = new URLSearchParams(window.location.search).get("tab");
    if (urlTab) {
        activateTab(urlTab);
    }

    // "نشر وظيفة جديدة" button in my-jobs tab
    var btnGoPost = document.getElementById("btnGoPostJob");
    if (btnGoPost) {
        btnGoPost.addEventListener("click", function () { activateTab("post-job"); });
    }

    // ── Load dashboard stats ──────────────────────────────────────
    async function loadStats() {
        var jobsResp = await sb.from("jobs")
            .select("id", { count: "exact", head: true })
            .eq("company_id", user.id);
        var statJobEl = document.getElementById("statJobCount");
        if (statJobEl) statJobEl.textContent = jobsResp.count || 0;
    }

    async function getCompanyJobIds() {
        var r = await sb.from("jobs").select("id").eq("company_id", user.id);
        return (r.data || []).map(function (j) { return j.id; });
    }

    loadStats();

    // ── HTML escape helper ────────────────────────────────────────
    function esc(v) {
        return String(v || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // ── Utility: show form status ─────────────────────────────────
    function setStatus(el, type, msg) {
        if (!el) return;
        el.textContent = msg;
        el.className = "form-status" + (msg ? " form-status-" + type : "");
        el.style.display = msg ? "block" : "none";
    }

    // ── Post Job Form ─────────────────────────────────────────────
    var postJobForm = document.getElementById("companyPostJobForm");
    var postJobStatus = document.getElementById("postJobStatus");

    if (postJobForm) {
        postJobForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            var btn = postJobForm.querySelector('button[type="submit"]');

            var title       = document.getElementById("cdJobTitle").value.trim();
            var description = document.getElementById("cdJobDescription").value.trim();
            var requirements= document.getElementById("cdJobRequirements").value.trim();
            var salary      = document.getElementById("cdJobSalary").value.trim();
            var location    = document.getElementById("cdJobLocation").value.trim();
            var jobType     = document.getElementById("cdJobType").value.trim();
            var category    = document.getElementById("cdJobCategory").value.trim();
            var deadline    = document.getElementById("cdJobDeadline").value || null;

            if (!title || !description || !requirements || !location || !jobType || !category) {
                setStatus(postJobStatus, "error", "يرجى تعبئة جميع الحقول المطلوبة (*)");
                return;
            }

            if (btn) { btn.disabled = true; btn.textContent = "جاري النشر..."; }
            setStatus(postJobStatus, null, "");

            var resp = await sb.from("jobs").insert([{
                company_id: user.id,
                title: title,
                description: description,
                requirements: requirements,
                salary: salary || null,
                location: location,
                job_type: jobType,
                category: category,
                application_deadline: deadline,
                status: "active"
            }]);

            if (btn) { btn.disabled = false; btn.textContent = "نشر الوظيفة"; }

            if (resp.error) {
                setStatus(postJobStatus, "error", "تعذر نشر الوظيفة: " + (resp.error.message || ""));
            } else {
                setStatus(postJobStatus, "success", "تم نشر الوظيفة بنجاح ✓");
                postJobForm.reset();
            }
        });
    }

    // ── My Jobs ───────────────────────────────────────────────────
    var jobsListEl = document.getElementById("companyJobsList");

    async function loadMyJobs() {
        if (!jobsListEl) return;
        jobsListEl.innerHTML = '<p class="no-data-msg">جاري التحميل...</p>';

        var resp = await sb.from("jobs")
            .select("id, title, location, job_type, category, created_at")
            .eq("company_id", user.id)
            .order("created_at", { ascending: false });

        if (resp.error || !resp.data || resp.data.length === 0) {
            jobsListEl.innerHTML = '<p class="no-data-msg">لم تقم بنشر أي وظائف حتى الآن.</p>';
            return;
        }

        jobsListEl.innerHTML = resp.data.map(function (job) {
            var date = job.created_at ? new Date(job.created_at).toLocaleDateString("ar-SA") : "-";
            return '<div class="company-job-item" data-job-id="' + esc(job.id) + '">' +
                '<div class="company-job-info">' +
                    '<h3>' + esc(job.title) + '</h3>' +
                    '<div class="company-job-meta">' +
                        (job.location ? '<span class="badge badge-free">' + esc(job.location) + '</span>' : '') +
                        (job.job_type ? '<span class="badge badge-paid">' + esc(job.job_type) + '</span>' : '') +
                        (job.category ? '<span class="badge badge-cat">' + esc(job.category) + '</span>' : '') +
                        '<span class="company-job-date">' + date + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="company-job-actions">' +
                    '<button type="button" class="dashboard-btn dashboard-btn-delete" data-action="delete">حذف</button>' +
                '</div>' +
            '</div>';
        }).join("");
    }

    // Job list event delegation (delete)
    if (jobsListEl) {
        jobsListEl.addEventListener("click", async function (e) {
            var btn = e.target.closest("[data-action]");
            if (!btn) return;
            var action = btn.getAttribute("data-action");
            var item = btn.closest("[data-job-id]");
            if (!item) return;
            var jobId = item.getAttribute("data-job-id");

            if (action === "delete") {
                if (!window.confirm("هل أنت متأكد من حذف هذه الوظيفة؟")) return;
                var del = await sb.from("jobs").delete().eq("id", jobId).eq("company_id", user.id);
                if (del.error) {
                    window.alert("تعذر حذف الوظيفة.");
                } else {
                    loadMyJobs();
                }
            }
        });
    }

    // ── Request Staff Form ────────────────────────────────────────
    var requestStaffForm   = document.getElementById("requestStaffForm");
    var requestStaffStatus = document.getElementById("requestStaffStatus");
    var myStaffRequestsList = document.getElementById("myStaffRequestsList");

    function fmtDateSimple(v) {
        if (!v) return "—";
        return new Date(v).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
    }

    function staffStatusLabel(s) {
        if (s === "reviewed")  return '<span class="badge badge-accepted">تمت المراجعة</span>';
        if (s === "rejected")  return '<span class="badge badge-rejected">مرفوض</span>';
        return '<span class="badge badge-pending-status">قيد المراجعة</span>';
    }

    async function loadMyStaffRequests() {
        if (!myStaffRequestsList) return;
        myStaffRequestsList.innerHTML = '<p class="no-data-msg">جاري التحميل...</p>';
        var resp = await sb.from("employee_requests")
            .select("id, job_title, count, specialization, work_type, salary, deadline, skills, notes, status, created_at")
            .eq("company_id", user.id)
            .order("created_at", { ascending: false });
        var items = resp.data || [];
        if (!items.length) { myStaffRequestsList.innerHTML = '<p class="no-data-msg">لم ترسل أي طلبات حتى الآن.</p>'; return; }
        myStaffRequestsList.innerHTML = items.map(function (r) {
            return '<div class="company-job-item">' +
                '<div class="company-job-info">' +
                    '<h3>' + esc(r.job_title) + ' <small style="font-weight:400;font-size:0.85rem;">(' + esc(String(r.count || 1)) + ' موظف)</small></h3>' +
                    '<div class="company-job-meta">' +
                        (r.specialization ? '<span class="badge badge-free">' + esc(r.specialization) + '</span>' : '') +
                        (r.work_type      ? '<span class="badge badge-paid">' + esc(r.work_type) + '</span>' : '') +
                        staffStatusLabel(r.status) +
                        '<span class="company-job-date">' + fmtDateSimple(r.created_at) + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="company-job-actions">' +
                    '<button type="button" class="dashboard-btn dashboard-btn-delete" data-action="delete-req" data-rid="' + esc(r.id) + '">حذف</button>' +
                '</div>' +
            '</div>';
        }).join("");
    }

    if (myStaffRequestsList) {
        myStaffRequestsList.addEventListener("click", async function (e) {
            var btn = e.target.closest("[data-action='delete-req']");
            if (!btn) return;
            if (!confirm("هل أنت متأكد من حذف هذا الطلب؟")) return;
            var rid = btn.dataset.rid;
            var del = await sb.from("employee_requests").delete().eq("id", rid).eq("company_id", user.id);
            if (del.error) { alert("تعذر حذف الطلب."); return; }
            loadMyStaffRequests();
        });
    }

    if (requestStaffForm) {
        requestStaffForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            var btn = requestStaffForm.querySelector('button[type="submit"]');
            var jobTitle      = document.getElementById("rsJobTitle").value.trim();
            var count         = parseInt(document.getElementById("rsCount").value) || 1;
            var specialization= document.getElementById("rsSpecialization").value.trim();
            var workType      = document.getElementById("rsWorkType").value;
            var salary        = document.getElementById("rsSalary").value.trim();
            var deadline      = document.getElementById("rsDeadline").value || null;
            var skills        = document.getElementById("rsSkills").value.trim();
            var notes         = document.getElementById("rsNotes").value.trim();

            if (!jobTitle || !specialization || !skills) {
                setStatus(requestStaffStatus, "error", "يرجى تعبئة الحقول المطلوبة (*)");
                return;
            }
            if (btn) { btn.disabled = true; btn.textContent = "جاري الإرسال..."; }
            setStatus(requestStaffStatus, null, "");

            var resp = await sb.from("employee_requests").insert([{
                company_id:     user.id,
                job_title:      jobTitle,
                count:          count,
                specialization: specialization,
                work_type:      workType || null,
                salary:         salary || null,
                deadline:       deadline,
                skills:         skills,
                notes:          notes || null,
                status:         "pending"
            }]);

            if (btn) { btn.disabled = false; btn.textContent = "إرسال الطلب"; }

            if (resp.error) {
                setStatus(requestStaffStatus, "error", "تعذر إرسال الطلب: " + (resp.error.message || ""));
            } else {
                setStatus(requestStaffStatus, "success", "تم إرسال طلبك للإدارة بنجاح ✓");
                requestStaffForm.reset();
                loadMyStaffRequests();
            }
        });
    }

    // ── Company Info Form ─────────────────────────────────────────
    var profileForm = document.getElementById("companyDashProfileForm");
    var profileStatus = document.getElementById("profileStatus");

    if (profileForm) {
        // Pre-fill
        var pResp = await sb.from("profiles")
            .select("full_name, phone, specialization, skills")
            .eq("id", user.id)
            .single();

        if (pResp.data) {
            var fn = document.getElementById("cdCompanyName");
            var pp = document.getElementById("cdCompanyPhone");
            var sp = document.getElementById("cdCompanySpec");
            var sv = document.getElementById("cdCompanyServices");
            if (fn) fn.value = pResp.data.full_name || "";
            if (pp) pp.value = pResp.data.phone || "";
            if (sp) sp.value = pResp.data.specialization || "";
            if (sv) sv.value = pResp.data.skills || "";
        }

        profileForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            var btn = profileForm.querySelector('button[type="submit"]');
            var full_name      = document.getElementById("cdCompanyName").value.trim();
            var phone          = document.getElementById("cdCompanyPhone").value.trim();
            var specialization = document.getElementById("cdCompanySpec").value.trim();
            var skills         = document.getElementById("cdCompanyServices").value.trim();

            if (btn) { btn.disabled = true; btn.textContent = "جاري الحفظ..."; }
            setStatus(profileStatus, null, "");

            var upResp = await sb.from("profiles").upsert(
                { id: user.id, full_name: full_name, phone: phone, specialization: specialization, skills: skills },
                { onConflict: "id" }
            );

            if (btn) { btn.disabled = false; btn.textContent = "حفظ البيانات"; }

            if (upResp.error) {
                setStatus(profileStatus, "error", "تعذر حفظ البيانات");
            } else {
                setStatus(profileStatus, "success", "تم حفظ بيانات الشركة بنجاح ✓");
                if (nameEl) nameEl.textContent = full_name || "شركتك";
            }
        });
    }

    // ── Course Request Form ──────────────────────────────────
    var requestCourseForm   = document.getElementById("requestCourseForm");
    var requestCourseStatus = document.getElementById("requestCourseStatus");
    var myCourseRequestsList = document.getElementById("myCourseRequestsList");

    function courseReqStatusHtml(s) {
        if (s === "approved") return '<span class="badge badge-accepted">موافق عليه</span>';
        if (s === "rejected") return '<span class="badge badge-rejected">مرفوض</span>';
        return '<span class="badge badge-pending-status">قيد المراجعة</span>';
    }

    async function loadMyCourseRequests() {
        if (!myCourseRequestsList) return;
        myCourseRequestsList.innerHTML = '<p class="no-data-msg">جاري التحميل...</p>';
        var res = await sb.from("course_requests")
            .select("id, course_name, category, seats, duration, expected_date, status, created_at")
            .eq("company_id", user.id)
            .order("created_at", { ascending: false });
        var items = res.data || [];
        if (!items.length) { myCourseRequestsList.innerHTML = '<p class="no-data-msg">لم ترسل أي طلبات حتى الآن.</p>'; return; }
        myCourseRequestsList.innerHTML = items.map(function (r) {
            return '<div class="staff-request-card">' +
                '<div class="src-row"><strong>' + esc(r.course_name) + '</strong>' + courseReqStatusHtml(r.status) + '</div>' +
                '<div class="src-meta">' +
                    (r.category     ? '<span>🏷 '     + esc(r.category) + '</span>' : '') +
                    (r.seats        ? '<span>👥 '       + esc(String(r.seats)) + ' مقعد</span>' : '') +
                    (r.duration     ? '<span>⏱ '          + esc(r.duration) + '</span>' : '') +
                    (r.expected_date? '<span>📅 '       + esc(r.expected_date) + '</span>' : '') +
                '</div>' +
                (r.status === 'pending' ? '<button class="dashboard-btn dashboard-btn-delete" data-action="delete-cr" data-id="' + esc(r.id) + '">حذف</button>' : '') +
            '</div>';
        }).join("");
    }

    if (myCourseRequestsList) {
        myCourseRequestsList.addEventListener("click", async function (e) {
            var btn = e.target.closest("[data-action='delete-cr']");
            if (!btn) return;
            if (!confirm("حذف هذا الطلب؟")) return;
            await sb.from("course_requests").delete().eq("id", btn.dataset.id);
            loadMyCourseRequests();
        });
    }

    if (requestCourseForm) {
        requestCourseForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            var btn       = requestCourseForm.querySelector('button[type="submit"]');
            var name      = (document.getElementById("rcCourseName")    || {}).value || "";
            var category  = (document.getElementById("rcCategory")       || {}).value || "";
            var seats     = parseInt((document.getElementById("rcSeats")  || {}).value || "1", 10);
            var duration  = (document.getElementById("rcDuration")       || {}).value || "";
            var expDate   = (document.getElementById("rcExpectedDate")   || {}).value || "";
            var audience  = (document.getElementById("rcAudience")       || {}).value || "";
            var desc      = (document.getElementById("rcDescription")    || {}).value || "";
            var notes     = (document.getElementById("rcNotes")          || {}).value || "";

            if (!name.trim() || !desc.trim()) {
                setStatus(requestCourseStatus, "error", "يرجى تعبئة الحقول المطلوبة (*)");
                return;
            }
            setStatus(requestCourseStatus, null, "");
            if (btn) { btn.disabled = true; btn.textContent = "جاري الإرسال..."; }

            var resp = await sb.from("course_requests").insert([{
                company_id:     user.id,
                course_name:    name.trim(),
                category:       category.trim() || null,
                seats:          isNaN(seats) ? 1 : seats,
                duration:       duration.trim() || null,
                expected_date:  expDate || null,
                target_audience: audience.trim() || null,
                description:    desc.trim(),
                notes:          notes.trim() || null,
                status:         "pending"
            }]);

            if (btn) { btn.disabled = false; btn.textContent = "إرسال الطلب"; }

            if (resp.error) {
                setStatus(requestCourseStatus, "error", "تعذر إرسال الطلب: " + (resp.error.message || ""));
            } else {
                setStatus(requestCourseStatus, "success", "تم إرسال طلبك للإدارة بنجاح ✓");
                requestCourseForm.reset();
                loadMyCourseRequests();
            }
        });
    }
});
