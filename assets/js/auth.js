/**
 * auth.js — SINGLE authority for:
 *   - Supabase client creation (falls back to window.supabaseClient from supabaseClient.js)
 *   - User resolution and header update
 *   - Login form wiring
 *   - Register form wiring (auto-login after signup)
 *   - Logout
 *   - Per-page form pages (profile, apply, my-applications, post-job)
 *
 * Rules enforced here:
 *   - Only getUser() — never getSession() or localStorage
 *   - Role always fetched from profiles table
 *   - No redirect inside header logic
 *   - Redirect ONLY after login / after register
 */
(function () {
    "use strict";

    /* ── 1. Supabase client ───────────────────────────────────────── */
    if (typeof window.supabase === "undefined") {
        console.error("Supabase SDK not loaded.");
        return;
    }

    var sb = window.supabaseClient;
    if (!sb) {
        sb = window.supabase.createClient(
            "https://jgvfcievyfkyldryatlk.supabase.co",
            "sb_publishable_ieBSqzdn_nZJk4t-n8cNlw_ZjMwsgjY"
        );
        window.supabaseClient = sb;
    }

    /* ── 2. Helpers ───────────────────────────────────────────────── */
    function page() {
        return window.location.pathname.split("/").pop() || "index.html";
    }

    function role2label(role) {
        if (role === "job_seeker") return "باحث عن عمل";
        if (role === "company")    return "شركة";
        if (role === "super_admin") return "مشرف عام";
        return "";
    }

    function role2home(role) {
        if (role === "job_seeker")  return "profile.html";
        if (role === "company")     return "company-dashboard.html";
        if (role === "super_admin") return "dashboard.html";
        return "index.html";
    }

    function showStatus(form, type, msg) {
        if (!form) return;
        var el = form.querySelector(".form-status");
        if (!el) {
            el = document.createElement("div");
            el.className = "form-status";
            form.appendChild(el);
        }
        el.className = "form-status" + (msg ? " form-status-" + type : "");
        el.textContent = msg || "";
        el.style.display = msg ? "block" : "none";
    }

    function setBtnLoading(btn, loading, text) {
        if (!btn) return;
        if (!btn._origText) btn._origText = btn.textContent;
        btn.disabled = loading;
        btn.textContent = loading ? (text || "جاري المعالجة...") : btn._origText;
    }

    /* ── 3. Get current user + profile (NO getSession, NO localStorage) */
    async function getCurrentUser() {
        try {
            var res = await sb.auth.getUser();
            return (res.data && res.data.user) ? res.data.user : null;
        } catch (e) { return null; }
    }

    async function getProfile(user) {
        if (!user) return null;
        try {
            var res = await sb.from("profiles")
                .select("role, full_name")
                .eq("id", user.id)
                .single();
            return res.data || null;
        } catch (e) { return null; }
    }

    /* ── 4a. Nav links pre-renderer (also used for instant cache render) ── */
    function _renderNavLinks(nav, role) {
        var links;
        if (role === "job_seeker") {
            links = [
                { href: "index.html",           i18n: "nav.home",           text: "الرئيسية" },
                { href: "jobs.html",             i18n: "nav.jobs",           text: "الوظائف" },
                { href: "profile.html",          i18n: "nav.profile",        text: "ملفي" },
                { href: "my-applications.html",  i18n: "nav.myApplications", text: "طلباتي" },
                { href: "courses.html",          i18n: "nav.courses",        text: "الدورات" }
            ];
        } else if (role === "company") {
            links = [
                { href: "index.html",                          i18n: "nav.home",             text: "الرئيسية" },
                { href: "company-dashboard.html",              i18n: "nav.companyDashboard",  text: "لوحة الشركة" },
                { href: "company-dashboard.html?tab=my-jobs",  i18n: "nav.myJobs",           text: "وظائفي" },
                { href: "courses.html",                        i18n: "nav.courses",           text: "الدورات" }
            ];
        } else if (role === "super_admin") {
            links = [
                { href: "dashboard.html", i18n: "nav.adminDashboard", text: "لوحة الأدمن" },
                { href: "jobs.html",      i18n: "nav.jobs",           text: "الوظائف" },
                { href: "index.html",     i18n: "nav.home",           text: "الرئيسية" }
            ];
        } else {
            return;
        }
        var cur = page();
        var curSearch = window.location.search; // e.g. "?tab=my-jobs"
        nav.innerHTML = links.map(function (l) {
            // Match on full href (path + query) or just the path for links without query params
            var hrefPath = l.href.split("?")[0];
            var hrefQuery = l.href.indexOf("?") !== -1 ? l.href.slice(l.href.indexOf("?")) : "";
            var isActive = hrefPath === cur && hrefQuery === curSearch;
            var active = isActive ? " active" : "";
            return '<a href="' + l.href + '" class="nav-link' + active + '" data-i18n="' + l.i18n + '">' + l.text + '</a>';
        }).join("") +
        '<button type="button" id="authLogoutBtnMobile" class="nav-logout-mobile" data-i18n="header.logout">تسجيل الخروج</button>';
        nav.style.visibility = "visible";
        try { sessionStorage.setItem("_uiRole", role); } catch (e) {}
    }

    function _renderUserMenu(fullName, role) {
        if (!role || !fullName) return;
        var headerInner = document.querySelector(".main-header .header-inner");
        if (!headerInner) return;
        // Remove existing before inserting
        var existing = document.getElementById("authUserMenu");
        if (existing) existing.remove();

        var profileHref = role === "company" ? "company-profile.html" : (role === "job_seeker" ? "profile.html" : "");
        var profileBtn = profileHref
            ? '<a href="' + profileHref + '" class="btn btn-settings" title="\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u062d\u0633\u0627\u0628" aria-label="\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u062d\u0633\u0627\u0628">&#9881;</a>'
            : '';

        var roleI18nKey = role === "job_seeker" ? "role.jobSeeker" : (role === "company" ? "role.company" : "role.superAdmin");

        var menu = document.createElement("div");
        menu.id = "authUserMenu";
        menu.className = "user-menu";
        menu.innerHTML =
            '<div class="user-avatar">' + (fullName.trim().charAt(0) || "\u061f").toUpperCase() + '</div>' +
            '<div class="user-info">' +
                '<div class="user-name">' + fullName + '</div>' +
                '<div class="user-role" data-i18n="' + roleI18nKey + '">' + role2label(role) + '</div>' +
            '</div>' +
            profileBtn +
            '<button type="button" id="authLogoutBtn" class="btn btn-outline" data-i18n="header.logout">\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c</button>';
        var langSwitch = headerInner.querySelector(".lang-switch");
        if (langSwitch) {
            headerInner.insertBefore(menu, langSwitch);
        } else {
            headerInner.appendChild(menu);
        }
        try {
            sessionStorage.setItem("_uiName", fullName);
        } catch (e) {}
    }

    /* ── 4. Header update — NO redirect here ─────────────────────── */
    function updateHeader(profile, user) {
        var mainNav = document.getElementById("mainNav");
        if (!mainNav) return;

        var role = (profile && profile.role) ? profile.role : "";

        if (!role) {
            // Guest — clear cache, show default HTML nav links
            try { sessionStorage.removeItem("_uiRole"); sessionStorage.removeItem("_uiName"); } catch (e) {}
            mainNav.style.visibility = "visible";
            return;
        }

        // Render nav links (also saves role to sessionStorage)
        _renderNavLinks(mainNav, role);

        // Role body class for theming
        document.body.className = document.body.className
            .replace(/\brole-\S+/g, "").trim();
        if (role === "job_seeker")  document.body.classList.add("role-job-seeker");
        if (role === "company")     document.body.classList.add("role-company");
        if (role === "super_admin") document.body.classList.add("role-super-admin");

        var fullName = (profile && profile.full_name) ? profile.full_name
                       : (user ? user.email : "");

        // Render user menu (also saves name to sessionStorage)
        _renderUserMenu(fullName, role);

        // Re-apply current language to any newly injected data-i18n elements
        if (typeof window.maherApplyLanguage === "function") {
            window.maherApplyLanguage(localStorage.getItem("maherLang") || "ar");
        }
    }

    /* ── 5. Logout ────────────────────────────────────────────────── */
    async function logout() {
        try { sessionStorage.removeItem("_uiRole"); } catch (e) {}
        try { await sb.auth.signOut(); } catch (e) {}
        window.location.href = "index.html";
    }

    document.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest &&
                  e.target.closest("#authLogoutBtn, #authLogoutBtnMobile, #adminHeaderLogout, [data-logout='true']");
        if (!btn) return;
        e.preventDefault();
        void logout();
    });

    /* ── 6. Login helper (redirect after login) ───────────────────── */
    function _isPhoneInput(val) {
        if (val.indexOf("@") !== -1) return false;
        var stripped = val.replace(/[\s\-().]/g, "");
        return /^[+0-9]{7,15}$/.test(stripped);
    }

    function _normalizePhone(val) {
        var s = val.replace(/[\s\-().]/g, "");
        if (/^05\d{8}$/.test(s))  return "+966" + s.slice(1);   // 05XXXXXXXX → +9665XXXXXXXX
        if (/^5\d{8}$/.test(s))   return "+9665" + s;           // 5XXXXXXXX  → +9665XXXXXXXX
        if (s.charAt(0) !== "+")  return "+" + s;
        return s;
    }

    async function doLogin(emailOrPhone, password) {
        var isPhone = _isPhoneInput(emailOrPhone);
        var credential = isPhone
            ? { phone: _normalizePhone(emailOrPhone), password: password }
            : { email: emailOrPhone, password: password };
        var res = await sb.auth.signInWithPassword(credential);
        if (res.error) return { error: res.error };

        var user = res.data.user;
        var profile = await getProfile(user);
        if (!profile) return { error: new Error("لم يتم العثور على بيانات المستخدم") };

        window.location.href = role2home(profile.role);
        return { error: null };
    }

    /* ── 7. Wire login forms ──────────────────────────────────────── */
    function wireLoginForm(formId, emailId, passwordId) {
        var form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            var loginEl  = document.getElementById(emailId);
            var passEl   = document.getElementById(passwordId);
            var login    = loginEl ? loginEl.value.trim() : "";
            var password = passEl  ? passEl.value : "";
            var btn      = form.querySelector('button[type="submit"]');

            if (!login || !password) {
                showStatus(form, "error", "يرجى إدخال البريد الإلكتروني أو رقم الجوال وكلمة المرور");
                return;
            }

            showStatus(form, null, "");
            setBtnLoading(btn, true, "جاري تسجيل الدخول...");

            var res = await doLogin(login, password);

            if (res.error) {
                var msg = (res.error.message || "").toLowerCase();
                var arabicMsg;
                if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
                    arabicMsg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
                } else if (msg.includes("email not confirmed")) {
                    arabicMsg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
                } else {
                    arabicMsg = res.error.message || "فشل تسجيل الدخول";
                }
                showStatus(form, "error", arabicMsg);
                setBtnLoading(btn, false);
            }
            // On success doLogin already does window.location.href → no need to re-enable btn
        });
    }

    /* ── 8. Wire register forms (auto-login after signup) ────────── */
    function wireRegisterForm(formId, nameId, emailId, passId, confirmId, role) {
        var form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener("submit", async function (e) {
            e.preventDefault();

            var nameEl    = document.getElementById(nameId);
            var emailEl   = document.getElementById(emailId);
            var passEl    = document.getElementById(passId);
            var confirmEl = document.getElementById(confirmId);

            var fullName = nameEl    ? nameEl.value.trim()    : "";
            var email    = emailEl   ? emailEl.value.trim()   : "";
            var password = passEl    ? passEl.value           : "";
            var confirm  = confirmEl ? confirmEl.value        : "";
            var btn      = form.querySelector('button[type="submit"]');

            if (!fullName || !email || !password) {
                showStatus(form, "error", "يرجى تعبئة الحقول المطلوبة");
                return;
            }
            if (password.length < 6) {
                showStatus(form, "error", "كلمة المرور يجب أن تكون 6 أحرف على الأقل");
                return;
            }
            if (password !== confirm) {
                showStatus(form, "error", "تأكيد كلمة المرور غير متطابق");
                return;
            }

            showStatus(form, null, "");
            setBtnLoading(btn, true, "جاري إنشاء الحساب...");

            // Sign up
            var signUpRes = await sb.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: { full_name: fullName, role: role },
                    emailRedirectTo: undefined
                }
            });

            /* Supabase free tier may fail to send confirmation email but the
               account is still created. Treat "Error sending confirmation email"
               as a soft warning — not a blocker. */
            if (signUpRes.error) {
                var errMsg = signUpRes.error.message || "";
                var isEmailErr = errMsg.toLowerCase().includes("confirmation") ||
                                 errMsg.toLowerCase().includes("sending") ||
                                 errMsg.toLowerCase().includes("smtp") ||
                                 errMsg.toLowerCase().includes("email");
                if (!isEmailErr) {
                    showStatus(form, "error", errMsg || "تعذر إنشاء الحساب");
                    setBtnLoading(btn, false);
                    return;
                }
                /* email error only — proceed to login anyway */
            }

            // Auto-login immediately after signup
            var loginRes = await sb.auth.signInWithPassword({ email: email, password: password });

            if (loginRes.error) {
                // Signup succeeded but auto-login failed — send to login page
                showStatus(form, "success", "تم إنشاء الحساب. يرجى تسجيل الدخول.");
                setTimeout(function () {
                    window.location.href = role === "company" ? "employer-login.html" : "seeker-login.html";
                }, 1200);
                return;
            }

            // Create profile row immediately — prevents RLS INSERT error later
            var newUser = loginRes.data.user;
            await sb.from("profiles").upsert(
                { id: newUser.id, email: email, full_name: fullName, role: role },
                { onConflict: "id" }
            );

            // Fetch profile then redirect
            var profile = await getProfile(newUser);
            window.location.href = role2home(profile ? profile.role : role);
        });
    }

    /* ── 9. Profile page (job_seeker) ────────────────────────────── */
    async function initProfilePage(user) {
        var form = document.getElementById("seekerProfileForm");
        if (!form || !user) return;

        var profile = await getProfile(user);
        if (!profile || profile.role !== "job_seeker") return;

        var fullNameEl = document.getElementById("profileFullName");
        var phoneEl    = document.getElementById("profilePhone");
        var specEl     = document.getElementById("profileSpecialization");
        var skillsEl   = document.getElementById("profileSkills");
        var cvInput    = document.getElementById("profileCv");
        var cvContainer= document.getElementById("profileCvLinkContainer");
        var cvLink     = document.getElementById("profileCvLink");

        // Load data
        var dataRes = await sb.from("profiles")
            .select("full_name, phone, specialization, skills, cv_url")
            .eq("id", user.id).single();

        if (dataRes.data) {
            var d = dataRes.data;
            if (fullNameEl) fullNameEl.value = d.full_name || "";
            if (phoneEl)    phoneEl.value    = d.phone || "";
            if (specEl)     specEl.value     = d.specialization || "";
            if (skillsEl)   skillsEl.value   = d.skills || "";
            if (cvContainer && cvLink && d.cv_url) {
                cvLink.href = d.cv_url; cvContainer.style.display = "block";
            }
        }

        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            var btn = form.querySelector('button[type="submit"]');
            setBtnLoading(btn, true, "جاري الحفظ...");
            showStatus(form, null, "");

            try {
                var cvUrl = null;
                var file = cvInput && cvInput.files ? cvInput.files[0] : null;
                if (file) {
                    var safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
                    var path = user.id + "/" + Date.now() + "-" + safeName;
                    var up = await sb.storage.from("cvs").upload(path, file, { upsert: true });
                    if (up.error) throw up.error;
                    var pub = sb.storage.from("cvs").getPublicUrl(path);
                    cvUrl = pub.data ? pub.data.publicUrl : null;
                }

                var payload = {
                    id:             user.id,
                    email:          user.email,
                    role:           "job_seeker",
                    full_name:      fullNameEl ? fullNameEl.value.trim() : null,
                    phone:          phoneEl    ? phoneEl.value.trim()    : null,
                    specialization: specEl     ? specEl.value.trim()     : null,
                    skills:         skillsEl   ? skillsEl.value.trim()   : null
                };
                if (cvUrl) payload.cv_url = cvUrl;

                var res = await sb.from("profiles").upsert(payload, { onConflict: "id" });
                if (res.error) throw res.error;

                if (cvUrl && cvContainer && cvLink) {
                    cvLink.href = cvUrl; cvContainer.style.display = "block";
                }
                showStatus(form, "success", "تم حفظ البيانات بنجاح ✓");
            } catch (err) {
                showStatus(form, "error", err.message || "تعذر حفظ البيانات");
            } finally {
                setBtnLoading(btn, false);
            }
        });
    }

    /* ── 10. My-applications page ────────────────────────────────── */
    async function initMyApplicationsPage(user) {
        var list = document.getElementById("myApplicationsList");
        if (!list || !user) return;

        var profile = await getProfile(user);
        if (!profile || profile.role !== "job_seeker") return;

        var appsRes = await sb.from("applications")
            .select("id, job_id, status, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        var items = appsRes.data || [];
        if (!items.length) { list.innerHTML = "<p>لم تقم بالتقديم على أي وظيفة حتى الآن.</p>"; return; }

        var jobIds = items.map(function (a) { return a.job_id; }).filter(Boolean);
        var jobsRes = await sb.from("jobs").select("id, title").in("id", jobIds);
        var jobMap = new Map();
        (jobsRes.data || []).forEach(function (j) { jobMap.set(j.id, j); });

        list.innerHTML = "";
        items.forEach(function (app) {
            var j = jobMap.get(app.job_id);
            var title = j ? j.title : "وظيفة";
            var date  = app.created_at ? new Date(app.created_at).toLocaleDateString("ar-SA") : "-";
            var el = document.createElement("article");
            el.className = "job-card-modern";
            el.innerHTML = "<h3>" + title + "</h3><p>الحالة: " + (app.status || "pending") + "</p><p>تاريخ التقديم: " + date + "</p>";
            list.appendChild(el);
        });
    }

    /* ── 11. Bootstrap (runs on every page) ──────────────────────── */
    async function bootstrap() {
        var nav = document.getElementById("mainNav");
        // Instant pre-render from cached role + name — avoids all flicker on page navigation
        var cachedRole = "";
        var cachedName = "";
        try {
            cachedRole = sessionStorage.getItem("_uiRole") || "";
            cachedName = sessionStorage.getItem("_uiName") || "";
        } catch (e) {}
        if (nav) {
            if (cachedRole) {
                _renderNavLinks(nav, cachedRole);       // nav links: instant, no hide
                _renderUserMenu(cachedName, cachedRole); // user menu: instant
            } else {
                nav.style.visibility = "hidden";  // first load / logged-out: hide until auth resolves
            }
        }

        // Wire login forms (safe to call on every page — only runs if form exists)
        wireLoginForm("seekerLoginForm",   "seekerEmail",   "seekerPassword");
        wireLoginForm("employerLoginForm", "employerEmail", "employerPassword");
        wireLoginForm("genericLoginForm",  "loginEmail",    "loginPassword");

        // Wire register forms
        wireRegisterForm("registerSeekerForm",   "seekerFullName",       "seekerEmail",   "seekerPassword",   "seekerPasswordConfirm",   "job_seeker");
        wireRegisterForm("registerEmployerForm", "employerCompanyName",  "employerEmail", "employerPassword", "employerPasswordConfirm", "company");
        wireRegisterForm("seekerOnlyRegisterForm",   "seekerFullName",      "seekerEmail",   "seekerPassword",   "seekerPasswordConfirm",   "job_seeker");
        wireRegisterForm("employerOnlyRegisterForm", "employerCompanyName", "employerEmail", "employerPassword", "employerPasswordConfirm", "company");

        // Get current user once
        var user = await getCurrentUser();
        var profile = user ? await getProfile(user) : null;

        // Protected-page redirect — send anonymous users to login
        var PROTECTED = [
            "profile.html", "dashboard.html", "company-dashboard.html",
            "my-applications.html", "post-job.html", "company-profile.html",
            "apply.html", "course-access.html"
        ];
        if (!user && PROTECTED.indexOf(page()) !== -1) {
            window.location.href = "login.html";
            return;
        }

        // Update header (no redirect)
        updateHeader(profile, user);

        // Page-specific form initialisation
        await initProfilePage(user);
        await initMyApplicationsPage(user);
    }

    /* ── 12. Expose minimal API for other scripts ─────────────────── */
    window.authApi = {
        supabase: sb,
        getCurrentUser: getCurrentUser,
        getProfile: getProfile,
        logout: logout
    };

    document.addEventListener("DOMContentLoaded", function () {
        void bootstrap();
    });

})();
