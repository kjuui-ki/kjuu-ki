document.addEventListener("DOMContentLoaded", async function () {
    const jobsGrid = document.getElementById("jobsCardsGrid");
    if (!jobsGrid) return;

    if (typeof supabaseClient === "undefined" || !supabaseClient) {
        jobsGrid.innerHTML = "<p>تعذر الاتصال بقاعدة البيانات.</p>";
        return;
    }

    async function getProfileRole(user) {
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

    function escapeText(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatSnippet(text) {
        const raw = String(text || "").trim();
        if (!raw) return "";
        return raw.length > 160 ? raw.slice(0, 160).trim() + "..." : raw;
    }

    try {
        const { data: userData } = await supabaseClient.auth.getUser();
        const user = userData && userData.user ? userData.user : null;
        const role = await getProfileRole(user);

        const { data: jobs, error: jobsError } = await supabaseClient
            .from("jobs")
            .select("id, title, description, requirements, location, job_type, company_id, created_at")
            .order("created_at", { ascending: false });

        if (jobsError) {
            jobsGrid.innerHTML = "<p>حدث خطأ أثناء جلب الوظائف.</p>";
            return;
        }

        if (!jobs || jobs.length === 0) {
            jobsGrid.innerHTML = "<p>لا توجد وظائف متاحة حاليًا.</p>";
            return;
        }

        const companyIds = [];
        jobs.forEach(function (job) {
            if (job && job.company_id && companyIds.indexOf(job.company_id) === -1) {
                companyIds.push(job.company_id);
            }
        });

        const companyMap = new Map();
        if (companyIds.length > 0) {
            const { data: companies } = await supabaseClient
                .from("profiles")
                .select("id, full_name")
                .in("id", companyIds);

            if (Array.isArray(companies)) {
                companies.forEach(function (company) {
                    if (company && company.id) {
                        companyMap.set(company.id, company.full_name || "");
                    }
                });
            }
        }

        const appliedJobIds = new Set();
        if (role === "job_seeker" && user) {
            const { data: applications } = await supabaseClient
                .from("applications")
                .select("job_id")
                .eq("user_id", user.id);

            if (Array.isArray(applications)) {
                applications.forEach(function (application) {
                    if (application && application.job_id) {
                        appliedJobIds.add(application.job_id);
                    }
                });
            }
        }

        jobsGrid.innerHTML = "";

        jobs.forEach(function (job) {
            const card = document.createElement("article");
            card.className = "job-card-modern";

            const companyName = companyMap.get(job.company_id) || "شركة";
            const location = job.location || "";
            const jobType = job.job_type || "";
            const snippet = formatSnippet(job.description || job.requirements || "");
            const applyHref = "apply.html?job_id=" + encodeURIComponent(job.id);

            const isApplied = role === "job_seeker" && appliedJobIds.has(job.id);

            card.innerHTML =
                '<div class="job-card-topline">' +
                    '<div>' +
                        '<h3>' + escapeText(job.title || "بدون عنوان") + '</h3>' +
                        '<div class="job-company">' + escapeText(companyName) + '</div>' +
                    '</div>' +
                '</div>' +
                '<p class="job-excerpt">' + escapeText(snippet) + '</p>' +
                '<div class="job-card-meta">' +
                    (location ? '<span class="badge badge-free">' + escapeText(location) + '</span>' : '') +
                    (jobType ? '<span class="badge badge-paid">' + escapeText(jobType) + '</span>' : '') +
                '</div>' +
                '<div class="job-card-actions"></div>';

            const actions = card.querySelector(".job-card-actions");
            const link = document.createElement("a");
            link.href = applyHref;
            link.className = "btn job-apply-link" + (isApplied ? " is-disabled" : "");
            link.textContent = isApplied ? "تم التقديم" : "تقديم";

            if (isApplied) {
                link.setAttribute("aria-disabled", "true");
            }

            actions.appendChild(link);
            jobsGrid.appendChild(card);
        });
    } catch (error) {
        console.error("Error loading jobs", error);
        jobsGrid.innerHTML = "<p>حدث خطأ غير متوقع.</p>";
    }
});
