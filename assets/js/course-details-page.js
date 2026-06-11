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
        if (tEl) tEl.textContent = (title || t("courseDetail.docTitle")) + " | أكاديمية ماهر";
    }

    function findInCatalog(courseId) {
        var c = (window.maherDefaultCourses || []).find(function (x) { return x.id === courseId; }) || null;
        if (c && window.maherCart) {
            var merged = window.maherCart.applyStoredPrices([c]);
            return merged[0] || c;
        }
        return c;
    }

    function isPaidCourse(c) {
        return window.maherCart ? window.maherCart.isPaidCourse(c) : (c && c.price_type === "paid" && Number(c.price_amount) > 0);
    }

    function getCourseObjectives(courseId) {
        var map = window.maherCourseObjectives || {};
        return map[courseId] || null;
    }

    function renderObjectivesSection(courseId, durationText) {
        var obj = getCourseObjectives(courseId);
        if (!obj || (!obj.general && !(obj.detailed && obj.detailed.length))) return "";

        var certBits = [t("courseDetail.certBar")];
        if (durationText) certBits.push(durationText);

        var html = '<div class="cd-cert-bar">' + esc(certBits.join(" | ")) + "</div>";
        html += '<section class="cd-goals" aria-labelledby="cdGoalsHeading">';
        html += '<h2 id="cdGoalsHeading" class="visually-hidden">' + esc(t("courseDetail.detailedGoals")) + "</h2>";
        html += '<div class="cd-goal-general">';
        html += '<h3 class="cd-goal-general-title">' + esc(t("courseDetail.generalGoal")) + "</h3>";
        html += '<p class="cd-goal-general-text">' + esc(obj.general || "") + "</p>";
        html += "</div>";
        if (obj.detailed && obj.detailed.length) {
            html += '<ul class="cd-goal-list">';
            obj.detailed.forEach(function (item) {
                html += "<li>" + esc(item) + "</li>";
            });
            html += "</ul>";
        }
        html += "</section>";
        return html;
    }

    function waitForSupabase(ms) {
        var limit = ms || 2000;
        if (window.supabaseClient) return Promise.resolve(window.supabaseClient);
        return new Promise(function (resolve) {
            var done = false;
            function finish() {
                if (done) return;
                done = true;
                resolve(window.supabaseClient || null);
            }
            document.addEventListener("maherSupabaseReady", finish, { once: true });
            setTimeout(finish, limit);
        });
    }

    function withTimeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise(function (_, reject) {
                setTimeout(function () { reject(new Error("timeout")); }, ms);
            })
        ]);
    }

    function resolvePathName(pathId, sb) {
        var fp = (window.maherDefaultTrainingPaths || []).find(function (x) { return x.id === pathId; });
        var local = fp ? fp.name_ar || "" : "";
        if (!pathId || !sb) return Promise.resolve(local);
        return withTimeout(
            sb.from("training_paths").select("name_ar, is_active").eq("id", pathId).maybeSingle()
                .then(function (tpRes) {
                    if (tpRes.data && tpRes.data.is_active) return tpRes.data.name_ar || local;
                    return local;
                }),
            2500
        ).catch(function () { return local; });
    }

    async function fetchCourseFromDb(courseId, catalog) {
        var sb = await waitForSupabase(2500);
        if (!sb) return { course: catalog, sb: null };
        try {
            var res = await withTimeout(
                sb.from("courses")
                    .select("id, title, description, instructor, duration, category, max_seats, is_active, created_at, training_path_id, content_type, price_type, price_amount")
                    .eq("id", courseId)
                    .single(),
                3500
            );
            var c = res.data;
            if (res.error || !c) c = catalog;
            return { course: c, sb: sb };
        } catch (e) {
            return { course: catalog, sb: sb };
        }
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
            ? withTimeout(sb.auth.getUser(), 2500).catch(function () { return { data: { user: null } }; })
            : Promise.resolve({ data: { user: null } });

        return authPromise.then(function (userRes) {
            var currentUser = userRes.data && userRes.data.user ? userRes.data.user : null;
            var currentRole = "";
            var isEnrolled = false;
            var pathPromise = Promise.resolve("");

            if (c.training_path_id) {
                pathPromise = resolvePathName(c.training_path_id, sb);
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

                var paid = isPaidCourse(c);
                var inCart = window.maherCart && window.maherCart.isInCart(courseId);

                if (!currentUser) {
                    var nextUrl = paid ? "checkout.html" : ("job-details.html?course_id=" + courseId);
                    actionsHtml =
                        "<a class=\"btn btn-primary\" href=\"login.html?next=" + encodeURIComponent(nextUrl) + "\">" +
                        esc(paid ? t("courses.loginToBuy") : t("courses.loginToEnroll")) + "</a>";
                } else if (currentRole !== "job_seeker") {
                    actionsHtml = "<button type=\"button\" class=\"btn btn-outline\" disabled>" + esc(t("paths.enrollSeekerOnly")) + "</button>";
                } else if (isEnrolled) {
                    actionsHtml = "<button type=\"button\" class=\"btn btn-enrolled\" disabled>" + esc(t("courses.enrolled")) + "</button>";
                } else if (paid) {
                    if (inCart) {
                        actionsHtml = "<a class=\"btn btn-primary\" href=\"checkout.html\">" + esc(t("courses.goCheckout")) + "</a>";
                    } else {
                        actionsHtml = "<button type=\"button\" class=\"btn btn-primary\" id=\"cdAddCartBtn\">" + esc(t("courses.addToCart")) + "</button>";
                    }
                } else {
                    actionsHtml = "<button type=\"button\" class=\"btn btn-primary\" id=\"cdEnrollBtn\">" + esc(t("courses.enrollBtn")) + "</button>";
                }

                var coverSrc = typeof window.maherCourseImageUrl === "function"
                    ? window.maherCourseImageUrl(courseId, c.title)
                    : ("assets/images/dorh/stock/stock_001.png");

                var durationText = c.duration ? (t("courseDetail.durationLabel") + ": " + c.duration) : "";
                var objectivesHtml = renderObjectivesSection(courseId, durationText);

                root.innerHTML =
                    "<div class=\"cd-card\">" +
                        "<div class=\"cd-hero\">" +
                            "<img class=\"cd-hero-img\" src=\"" + esc(coverSrc) + "\" alt=\"\" loading=\"lazy\" decoding=\"async\" />" +
                        "</div>" +
                        "<div class=\"cd-card-inner\">" +
                            "<p class=\"cd-kicker\">" + esc(t("courseDetail.kicker")) + "</p>" +
                            "<h1 class=\"cd-title\">" + esc(c.title) + "</h1>" +
                            "<div class=\"cd-meta-row\">" + metaBits.join(" ") + "</div>" +
                            objectivesHtml +
                            (c.description ? "<div class=\"cd-desc\">" + esc(c.description).replace(/\n/g, "<br/>") + "</div>" : "") +
                            "<div class=\"cd-actions\">" + actionsHtml +
                            (function () {
                                var done = window.maherCourseInterest && window.maherCourseInterest.isInterested(courseId);
                                return "<button type=\"button\" class=\"btn btn-interest interest-btn" + (done ? " btn-interest-done" : "") + "\" data-id=\"" + esc(courseId) + "\" data-title=\"" + esc(c.title) + "\"" + (done ? " disabled" : "") + ">" +
                                    esc(done ? t("courses.interest.done") : t("courses.interest.btn")) + "</button>";
                            })() +
                            "</div>" +
                            "<p class=\"cd-footnote\">" + esc(t("courseDetail.footnote")) + "</p>" +
                            "<p style=\"margin-top:1rem;\"><a class=\"btn btn-outline\" href=\"" + backQs.replace(/\"/g, "") + "\">" + esc(t("courses.backToList")) + "</a></p>" +
                        "</div>" +
                    "</div>";

                setPageTitle(c.title);

                var interestBtn = root.querySelector(".interest-btn");
                if (interestBtn && window.maherCourseInterest) {
                    interestBtn.addEventListener("click", function () {
                        if (interestBtn.disabled) return;
                        window.maherCourseInterest.openModal({ id: courseId, title: c.title });
                    });
                }

                var addCartBtn = document.getElementById("cdAddCartBtn");
                if (addCartBtn && window.maherCart) {
                    addCartBtn.addEventListener("click", function () {
                        var res = window.maherCart.addToCart(c);
                        if (res.ok || res.reason === "exists") {
                            addCartBtn.outerHTML = "<a class=\"btn btn-primary\" href=\"checkout.html\">" + esc(t("courses.goCheckout")) + "</a>";
                        }
                    });
                }

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

        var catalog = findInCatalog(courseId);

        function paint(c, sb) {
            if (!c) {
                root.classList.remove("cd-loading");
                root.removeAttribute("aria-busy");
                root.innerHTML = "<p class=\"cd-error\">" + esc(t("courseDetail.notFound")) + "</p>";
                return Promise.resolve();
            }
            if (c.is_active === false) {
                root.classList.remove("cd-loading");
                root.removeAttribute("aria-busy");
                root.innerHTML = "<p class=\"cd-error\">" + esc(t("courseDetail.inactive")) + "</p>";
                return Promise.resolve();
            }
            if (c.title) setPageTitle(c.title);
            return renderCourse(root, c, sb, courseId);
        }

        if (catalog) {
            paint(catalog, null);
            fetchCourseFromDb(courseId, catalog).then(function (result) {
                if (result.sb && result.course) {
                var merged = window.maherCart ? window.maherCart.applyStoredPrices([result.course]) : [result.course];
                paint(merged[0] || result.course || catalog, result.sb);
            }
            });
            return;
        }

        renderLoading(root);
        fetchCourseFromDb(courseId, null).then(function (result) {
            if (!result.course) {
                root.classList.remove("cd-loading");
                root.removeAttribute("aria-busy");
                root.innerHTML = "<p class=\"cd-error\">" + esc(t("courseDetail.notFound")) + "</p>";
                return;
            }
            paint(result.course, result.sb);
        });
    });
})();

