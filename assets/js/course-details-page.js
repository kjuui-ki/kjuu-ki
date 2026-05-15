/**
 * ØµÙØ­Ø© ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø¯ÙˆØ±Ø© â€” job-details.html?course_id=
 */
(function () {
    "use strict";

    function esc(v) {
        return String(v || "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function t(key) {
        var lang = localStorage.getItem("maherLang") || "ar";
        var dict = (window.maherTranslations || {})[lang] || (window.maherTranslations || {}).ar || {};
        return dict[key] !== undefined ? dict[key] : key;
    }

    function renderLoading(root) {
        root.classList.add("cd-loading");
        root.setAttribute("aria-busy", "true");
        root.innerHTML =
            '<div class="cd-loading-card">' +
                '<p class="cd-loading-label">' + esc(t("courseDetail.loading")) + "</p>" +
                '<div class="cd-skeleton-line w55"></div>' +
                '<div class="cd-skeleton-line w100"></div>' +
                '<div class="cd-skeleton-line w70"></div>' +
                '<div class="cd-skeleton-line w85"></div>' +
                '<div class="cd-skeleton-line w40"></div>' +
            "</div>";
    }

    function setPageTitle(title) {
        var tEl = document.getElementById("courseDetailPageTitle");
        if (tEl) tEl.textContent = (title || t("courseDetail.docTitle")) + " | ماهر";
    }

    function findInCatalog(courseId) {
        return (window.maherDefaultCourses || []).find(function (x) { return x.id === courseId; }) || null;
    }

    function waitForSupabase() {
        if (window.supabaseClient) return Promise.resolve(window.supabaseClient);
        return new Promise(function (resolve) {
            var done = false;
            function finish() {
                if (done) return;
                done = true;
                resolve(window.supabaseClient || null);
            }
            document.addEventListener("maherSupabaseReady", finish, { once: true });
            setTimeout(finish, 5000);
        });
    }

    async function loadCourse(courseId) {
        var catalog = findInCatalog(courseId);
        if (catalog && catalog.title) setPageTitle(catalog.title);

        var sb = await waitForSupabase();
        if (!sb) return { error: "no_db", catalog: catalog };

        var res = await sb
            .from("courses")
            .select("id, title, description, instructor, duration, category, max_seats, is_active, created_at, training_path_id, content_type, price_type, price_amount")
            .eq("id", courseId)
            .single();

        var c = res.data;
        if (res.error || !c) c = catalog;
        return { course: c, sb: sb, dbError: res.error };
    }

    function renderCourse(root, c, sb, courseId) {
        root.classList.remove("cd-loading");
        root.removeAttribute("aria-busy");

        var metaBits = [];
        var pathName = "";

        function buildMetaAndActions(pathNameResolved) {
            if (pathNameResolved) metaBits.push("<span class=\"cd-chip\">" + esc(t("courseDetail.pathLabel")) + ": " + esc(pathNameResolved) + "</span>");
            if (c.category) metaBits.push("<span class=\"cd-chip\">" + esc(c.category) + "</span>");
            if (c.instructor) metaBits.push("<span class=\"cd-meta\">" + esc(t("courses.meta.instructor")) + ": " + esc(c.instructor) + "</span>");
            if (c.duration) metaBits.push("<span class=\"cd-meta\">" + esc(t("courseDetail.durationLabel")) + ": " + esc(c.duration) + "</span>");
            if (c.max_seats > 0) metaBits.push("<span class=\"cd-meta\">" + esc(t("courses.seatsLabel")) + esc(String(c.max_seats)) + "</span>");
            if (c.content_type === "diploma") metaBits.push("<span class=\"cd-chip\">" + esc(t("paths.diploma")) + "</span>");
            if (c.price_type === "paid" && Number(c.price_amount) > 0) {
                metaBits.push("<span class=\"cd-chip\">" + esc(String(c.price_amount)) + " " + esc(t("paths.sar")) + "</span>");
            } else {
                metaBits.push("<span class=\"cd-chip\">" + esc(t("paths.free")) + "</span>");
            }
        }

        var authPromise = sb
            ? sb.auth.getUser()
            : Promise.resolve({ data: { user: null } });

        return authPromise.then(function (userRes) {
            var currentUser = userRes.data && userRes.data.user ? userRes.data.user : null;
            var currentRole = "";
            var isEnrolled = false;
            var pathPromise = Promise.resolve("");

            if (c.training_path_id) {
                if (sb) {
                pathPromise = sb.from("training_paths").select("name_ar, is_active").eq("id", c.training_path_id).maybeSingle()
                    .then(function (tpRes) {
                        if (tpRes.data && tpRes.data.is_active) return tpRes.data.name_ar || "";
                        var fp = (window.maherDefaultTrainingPaths || []).find(function (x) { return x.id === c.training_path_id; });
                        return fp ? fp.name_ar || "" : "";
                    });
                } else {
                    var fpOnly = (window.maherDefaultTrainingPaths || []).find(function (x) { return x.id === c.training_path_id; });
                    pathPromise = Promise.resolve(fpOnly ? fpOnly.name_ar || "" : "");
                }
            }

            var userChain = Promise.resolve();
            if (currentUser && sb) {
                userChain = sb.from("profiles").select("role").eq("id", currentUser.id).maybeSingle()
                    .then(function (profRes) {
                        currentRole = profRes.data ? profRes.data.role : "";
                        return sb.from("course_enrollments").select("id").eq("course_id", courseId).eq("user_id", currentUser.id).maybeSingle();
                    })
                    .then(function (enrRes) {
                        isEnrolled = !!(enrRes.data && enrRes.data.id);
                    });
            }

            return Promise.all([pathPromise, userChain]).then(function (parts) {
                pathName = parts[0] || "";
                buildMetaAndActions(pathName);

                var actionsHtml = "";
                var backQs = c.training_path_id ? ("courses.html?path=" + encodeURIComponent(c.training_path_id)) : "courses.html";

                if (!currentUser) {
                    actionsHtml =
                        "<a class=\"btn btn-primary\" href=\"login.html?next=" + encodeURIComponent("job-details.html?course_id=" + courseId) + "\">" +
                        esc(t("courses.loginToEnroll")) + "</a>";
                } else if (currentRole !== "job_seeker") {
                    actionsHtml = "<button type=\"button\" class=\"btn btn-outline\" disabled>" + esc(t("paths.enrollSeekerOnly")) + "</button>";
                } else if (isEnrolled) {
                    actionsHtml = "<button type=\"button\" class=\"btn btn-enrolled\" disabled>" + esc(t("courses.enrolled")) + "</button>";
                } else {
                    actionsHtml = "<button type=\"button\" class=\"btn btn-primary\" id=\"cdEnrollBtn\">" + esc(t("courses.enrollBtn")) + "</button>";
                }

                root.innerHTML =
                    "<div class=\"cd-card\">" +
                        "<div class=\"cd-card-inner\">" +
                            "<p class=\"cd-kicker\">" + esc(t("courseDetail.kicker")) + "</p>" +
                            "<h1 class=\"cd-title\">" + esc(c.title) + "</h1>" +
                            "<div class=\"cd-meta-row\">" + metaBits.join(" ") + "</div>" +
                            (c.description ? "<div class=\"cd-desc\">" + esc(c.description).replace(/\n/g, "<br/>") + "</div>" : "") +
                            "<div class=\"cd-actions\">" + actionsHtml + "</div>" +
                            "<p class=\"cd-footnote\">" + esc(t("courseDetail.footnote")) + "</p>" +
                            "<p style=\"margin-top:1rem;\"><a class=\"btn btn-outline\" href=\"" + backQs.replace(/\"/g, "") + "\">" + esc(t("courses.backToList")) + "</a></p>" +
                        "</div>" +
                    "</div>";

                setPageTitle(c.title);

                var enrollBtn = document.getElementById("cdEnrollBtn");
                if (enrollBtn && currentUser) {
                    enrollBtn.addEventListener("click", async function () {
                        enrollBtn.disabled = true;
                        enrollBtn.textContent = t("courses.enrolling");
                        var ins = await sb.from("course_enrollments").insert({
                            course_id: courseId,
                            user_id: currentUser.id,
                            enrolled_by: currentUser.id
                        });
                        enrollBtn.disabled = false;
                        enrollBtn.textContent = t("courses.enrollBtn");
                        if (ins.error && ins.error.code !== "23505") {
                            alert(t("courses.enrollError") + ": " + (ins.error.message || ""));
                            return;
                        }
                        enrollBtn.outerHTML = "<button type=\"button\" class=\"btn btn-enrolled\" disabled>" + esc(t("courses.enrolled")) + "</button>";
                    });
                }
            });
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        var root = document.getElementById("courseDetailRoot");
        if (!root) return;

        var params = new URLSearchParams(window.location.search);
        var courseId = (params.get("course_id") || "").trim();

        if (!courseId) {
            root.classList.remove("cd-loading");
            root.removeAttribute("aria-busy");
            root.innerHTML = "<p class=\"cd-error\">" + esc(t("courseDetail.noId")) + "</p>";
            return;
        }

        renderLoading(root);

        loadCourse(courseId).then(function (result) {
            if (result.error === "no_db") {
                var fallback = result.catalog;
                if (fallback) {
                    renderCourse(root, fallback, null, courseId).catch(function () {});
                    return;
                }
                root.classList.remove("cd-loading");
                root.removeAttribute("aria-busy");
                root.innerHTML = "<p class=\"cd-error\">" + esc(t("courseDetail.noDb")) + "</p>";
                return;
            }

            var c = result.course;
            if (!c) {
                root.classList.remove("cd-loading");
                root.removeAttribute("aria-busy");
                root.innerHTML = "<p class=\"cd-error\">" + esc(t("courseDetail.notFound")) + "</p>";
                return;
            }
            if (c.is_active === false) {
                root.classList.remove("cd-loading");
                root.removeAttribute("aria-busy");
                root.innerHTML = "<p class=\"cd-error\">" + esc(t("courseDetail.inactive")) + "</p>";
                return;
            }

            renderCourse(root, c, result.sb, courseId);
        });
    });
})();

