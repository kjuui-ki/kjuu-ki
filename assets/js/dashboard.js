document.addEventListener("DOMContentLoaded", async function () {
    const appRoot = document.getElementById("adminDashboardApp");
    if (!appRoot) return;

    if (typeof supabaseClient === "undefined" || !supabaseClient) {
        window.location.href = "login.html";
        return;
    }

    const statSeekers = document.getElementById("statSeekers");
    const statCompanies = document.getElementById("statCompanies");
    const statJobs = document.getElementById("statJobs");
    const statApplications = document.getElementById("statApplications");

    const seekersBody = document.getElementById("seekersTableBody");
    const companiesBody = document.getElementById("companiesTableBody");
    const jobsBody = document.getElementById("jobsTableBody");
    const applicationsBody = document.getElementById("applicationsTableBody");
    const adminIdentityBox = document.getElementById("adminIdentityBox");
    const mainNav = document.getElementById("mainNav");

    function htmlEscape(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatDate(value) {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleDateString(document.documentElement.lang === "en" ? "en-US" : "ar-SA", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    async function resolveRole(user) {
        if (!user) return null;

        try {
            const { data } = await supabaseClient
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .single();
            return data && data.role ? data.role : null;
        } catch (error) {
            return null;
        }
    }

    function setAdminHeader(displayName) {
        if (!mainNav) return;

        mainNav.classList.add("admin-main-nav");
        mainNav.innerHTML =
            '<a href="#adminDashboardApp" class="nav-link">لوحة التحكم</a>' +
            '<a href="#jobs" class="nav-link">الوظائف</a>' +
            '<a href="#seekers" class="nav-link">الباحثين</a>' +
            '<a href="#companies" class="nav-link">الشركات</a>' +
            '<a href="#applications" class="nav-link">المتقدمين</a>' +
            '<span class="admin-nav-name">' + htmlEscape(displayName || "Admin") + '</span>' +
            '<button type="button" class="admin-nav-logout" id="adminHeaderLogout">تسجيل الخروج</button>';

        const logoutBtn = document.getElementById("adminHeaderLogout");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async function () {
                try {
                    await supabaseClient.auth.signOut();
                } catch (error) {}
                window.location.href = "login.html";
            });
        }
    }

    function renderRows(container, rowsHtml, emptyText, colspan) {
        if (!container) return;
        if (!rowsHtml || rowsHtml.length === 0) {
            container.innerHTML = '<tr><td colspan="' + colspan + '">' + emptyText + '</td></tr>';
            return;
        }
        container.innerHTML = rowsHtml.join("");
    }

    async function loadProfilesWithEmail() {
        try {
            const withEmail = await supabaseClient
                .from("profiles")
                .select("id, role, full_name, phone, specialization, skills, cv_url, email")
                .order("created_at", { ascending: false });

            if (!withEmail.error) {
                return withEmail.data || [];
            }
        } catch (error) {}

        const fallback = await supabaseClient
            .from("profiles")
            .select("id, role, full_name, phone, specialization, skills, cv_url")
            .order("created_at", { ascending: false });

        return fallback.data || [];
    }

    async function loadApplications() {
        try {
            const rich = await supabaseClient
                .from("applications")
                .select("id, user_id, seeker_id, job_id, status, created_at, cv_url, full_name")
                .order("created_at", { ascending: false });
            if (!rich.error) return rich.data || [];
        } catch (error) {}

        const basic = await supabaseClient
            .from("applications")
            .select("id, user_id, seeker_id, job_id, status, created_at")
            .order("created_at", { ascending: false });
        return basic.data || [];
    }

    async function refreshDashboardData() {
        const profiles = await loadProfilesWithEmail();
        const jobsResult = await supabaseClient
            .from("jobs")
            .select("id, title, description, company_id, created_at")
            .order("created_at", { ascending: false });
        const jobs = jobsResult.data || [];

        const applications = await loadApplications();

        const seekers = profiles.filter(function (profile) { return profile.role === "job_seeker"; });
        const companies = profiles.filter(function (profile) { return profile.role === "company"; });

        if (statSeekers) statSeekers.textContent = String(seekers.length);
        if (statCompanies) statCompanies.textContent = String(companies.length);
        if (statJobs) statJobs.textContent = String(jobs.length);
        if (statApplications) statApplications.textContent = String(applications.length);

        const profileMap = new Map();
        profiles.forEach(function (profile) {
            profileMap.set(profile.id, profile);
        });

        const companyMap = new Map();
        companies.forEach(function (company) {
            companyMap.set(company.id, company);
        });

        const jobsMap = new Map();
        jobs.forEach(function (job) {
            jobsMap.set(job.id, job);
        });

        const seekerRows = seekers.map(function (seeker) {
            const email = seeker.email || "-";
            const cv = seeker.cv_url
                ? '<a href="' + htmlEscape(seeker.cv_url) + '" target="_blank" rel="noopener noreferrer">عرض CV</a>'
                : "-";
            return '<tr>' +
                '<td>' + htmlEscape(seeker.full_name || "-") + '</td>' +
                '<td>' + htmlEscape(email) + '</td>' +
                '<td>' + htmlEscape(seeker.phone || "-") + '</td>' +
                '<td>' + htmlEscape(seeker.specialization || "-") + '</td>' +
                '<td>' + cv + '</td>' +
            '</tr>';
        });
        renderRows(seekersBody, seekerRows, "لا يوجد باحثون لعرضهم.", 5);

        const companyRows = companies.map(function (company) {
            const email = company.email || "-";
            return '<tr>' +
                '<td>' + htmlEscape(company.full_name || "-") + '</td>' +
                '<td>' + htmlEscape(email) + '</td>' +
                '<td>' + htmlEscape(company.phone || "-") + '</td>' +
                '<td>' + htmlEscape(company.skills || company.specialization || "-") + '</td>' +
            '</tr>';
        });
        renderRows(companiesBody, companyRows, "لا توجد شركات لعرضها.", 4);

        const jobsRows = jobs.map(function (job) {
            const company = companyMap.get(job.company_id);
            const companyName = company && company.full_name ? company.full_name : "-";
            return '<tr data-job-id="' + htmlEscape(job.id) + '">' +
                '<td>' + htmlEscape(job.title || "-") + '</td>' +
                '<td>' + htmlEscape(companyName) + '</td>' +
                '<td>' + htmlEscape(formatDate(job.created_at)) + '</td>' +
                '<td>' +
                    '<div class="dashboard-actions">' +
                        '<button type="button" class="dashboard-btn dashboard-btn-edit" data-action="edit" data-id="' + htmlEscape(job.id) + '">تعديل</button>' +
                        '<button type="button" class="dashboard-btn dashboard-btn-delete" data-action="delete" data-id="' + htmlEscape(job.id) + '">حذف</button>' +
                    '</div>' +
                '</td>' +
            '</tr>';
        });
        renderRows(jobsBody, jobsRows, "لا توجد وظائف منشورة.", 4);

        const applicationRows = applications.map(function (application) {
            const applicantId = application.user_id || application.seeker_id;
            const seeker = profileMap.get(applicantId);
            const job = jobsMap.get(application.job_id);
            const seekerName =
                application.full_name ||
                (seeker && seeker.full_name) ||
                "-";
            const jobTitle = (job && job.title) || "-";
            const cvUrl =
                application.cv_url ||
                (seeker && seeker.cv_url) ||
                "";
            const cvHtml = cvUrl
                ? '<a href="' + htmlEscape(cvUrl) + '" target="_blank" rel="noopener noreferrer">عرض CV</a>'
                : "-";

            return '<tr>' +
                '<td>' + htmlEscape(seekerName) + '</td>' +
                '<td>' + htmlEscape(jobTitle) + '</td>' +
                '<td>' + htmlEscape(formatDate(application.created_at)) + '</td>' +
                '<td>' + htmlEscape(application.status || "pending") + '</td>' +
                '<td>' + cvHtml + '</td>' +
            '</tr>';
        });
        renderRows(applicationsBody, applicationRows, "لا يوجد متقدمون حاليًا.", 5);
    }

    if (jobsBody) {
        jobsBody.addEventListener("click", async function (event) {
            const target = event.target;
            if (!target || !target.getAttribute) return;

            const action = target.getAttribute("data-action");
            const jobId = target.getAttribute("data-id");
            if (!action || !jobId) return;

            if (action === "delete") {
                const confirmed = window.confirm("هل أنت متأكد من حذف هذه الوظيفة؟");
                if (!confirmed) return;

                const deleteResult = await supabaseClient
                    .from("jobs")
                    .delete()
                    .eq("id", jobId);

                if (deleteResult.error) {
                    window.alert("تعذر حذف الوظيفة.");
                    return;
                }

                await refreshDashboardData();
            }

            if (action === "edit") {
                const currentRow = target.closest("tr");
                const currentTitleCell = currentRow ? currentRow.querySelector("td") : null;
                const currentTitle = currentTitleCell ? currentTitleCell.textContent : "";
                const newTitle = window.prompt("عنوان الوظيفة الجديد", currentTitle || "");
                if (!newTitle || !newTitle.trim()) return;

                const updateResult = await supabaseClient
                    .from("jobs")
                    .update({ title: newTitle.trim() })
                    .eq("id", jobId);

                if (updateResult.error) {
                    window.alert("تعذر تعديل الوظيفة.");
                    return;
                }

                await refreshDashboardData();
            }
        });
    }

    try {
        const userResult = await supabaseClient.auth.getUser();
        const user = userResult && userResult.data ? userResult.data.user : null;

        if (!user) {
            window.location.href = "login.html";
            return;
        }

        const role = await resolveRole(user);

        if (role === "company") {
            window.location.href = "post-job.html";
            return;
        }

        if (role === "job_seeker") {
            window.location.href = "profile.html";
            return;
        }

        if (role !== "super_admin") {
            window.location.href = "login.html";
            return;
        }

        const displayName =
            (user.user_metadata && user.user_metadata.full_name) ||
            user.email ||
            "Admin";

        if (adminIdentityBox) {
            adminIdentityBox.textContent = "الأدمن: " + displayName;
        }

        setAdminHeader(displayName);
        await refreshDashboardData();
    } catch (error) {
        console.error("Dashboard loading error", error);
        window.location.href = "login.html";
    }
});
