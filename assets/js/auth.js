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

    /** Safe return URL after login/register — same-site .html only (no open redirect). */
    function getSafeNextRedirectUrl() {
        try {
            var u = new URLSearchParams(window.location.search);
            var raw = u.get("next");
            if (!raw) return null;
            var n = decodeURIComponent(raw).trim();
            if (!n || n.length > 800) return null;
            if (/[\u0000-\u001f<>]/.test(n)) return null;
            if (/^https?:\/\//i.test(n)) return null;
            if (n.indexOf("//") === 0) return null;
            if (n.indexOf("..") !== -1) return null;
            var pathPart = n.split("?")[0];
            if (!/^[a-zA-Z0-9._-]+\.html$/.test(pathPart)) return null;
            return n;
        } catch (e) {
            return null;
        }
    }

    function preserveNextInAuthLinks() {
        try {
            var sp = window.location.search;
            if (!sp || sp.indexOf("next=") === -1) return;
            document.querySelectorAll('a[href="register.html"], a[href="seeker-register.html"], a[href="login.html"]').forEach(function (a) {
                var h = a.getAttribute("href");
                if (!h) return;
                var path = h.split("?")[0];
                a.setAttribute("href", path + sp);
            });
        } catch (e2) {}
    }

    function role2label(role) {
        if (role === "job_seeker") return "متدرب";
        if (role === "company")    return "حساب قديم";
        if (role === "super_admin") return "مشرف عام";
        return "";
    }

    function role2home(role) {
        if (role === "job_seeker")  return "profile.html";
        if (role === "company")     return "index.html";
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
                { href: "index.html",             i18n: "nav.home",             text: "الرئيسية" },
                { href: "courses.html",           i18n: "nav.catalog",          text: "الدورات والدبلومات" },
                { href: "profile.html",           i18n: "nav.profile",          text: "ملفي" },
                { href: "my-applications.html",   i18n: "nav.myApplications",   text: "تسجيلاتي" },
                { href: "training-paths.html", i18n: "nav.trainingPaths", text: "المسارات التدريبية" },
            ];
        } else if (role === "company") {
            links = [
                { href: "index.html",     i18n: "nav.home",    text: "الرئيسية" },
                { href: "courses.html",   i18n: "nav.catalog", text: "الدورات والدبلومات" },
                { href: "training-paths.html",   i18n: "nav.trainingPaths", text: "المسارات التدريبية" },
            ];
        } else if (role === "super_admin") {
            links = [
                { href: "dashboard.html", i18n: "nav.adminDashboard", text: "لوحة الأدمن" },
                { href: "courses.html",   i18n: "nav.catalog",        text: "الدورات والدبلومات" },
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

        var profileHref = role === "job_seeker" ? "profile.html" : "";
        var profileBtn = profileHref
            ? '<a href="' + profileHref + '" class="btn-settings" title="\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u062d\u0633\u0627\u0628" aria-label="\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u062d\u0633\u0627\u0628">&#9881;</a>'
            : "";

        var roleI18nKey = role === "job_seeker" ? "role.trainee" : (role === "company" ? "role.legacyCompany" : "role.superAdmin");

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
            '<button type="button" id="authLogoutBtn" class="btn btn-outline header-logout-btn" data-i18n="header.logout">\u062e\u0631\u0648\u062c</button>';
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
        var btn = e.target && e.target.closest && e.target.closest("[data-toggle-password]");
        if (!btn) return;
        var id = btn.getAttribute("data-toggle-password");
        if (!id) return;
        var input = document.getElementById(id);
        if (!input) return;
        var show = input.getAttribute("type") === "password";
        input.setAttribute("type", show ? "text" : "password");
        btn.setAttribute("aria-pressed", show ? "true" : "false");
    });

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

        var nextU = getSafeNextRedirectUrl();
        window.location.href = nextU || role2home(profile.role);
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
                    window.location.href = "login.html";
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
            var nextU = getSafeNextRedirectUrl();
            window.location.href = nextU || role2home(profile ? profile.role : role);
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
        // Load data
        var dataRes = await sb.from("profiles")
            .select("full_name, phone, specialization, skills")
            .eq("id", user.id).single();

        function profileCompletionPct(d) {
            var fields = [d.full_name, d.phone, d.specialization, d.skills];
            var filled = fields.filter(function (v) { return v && String(v).trim(); }).length;
            return Math.round((filled / fields.length) * 100);
        }

        if (dataRes.data) {
            var d = dataRes.data;
            if (fullNameEl) fullNameEl.value = d.full_name || "";
            if (phoneEl)    phoneEl.value    = d.phone || "";
            if (specEl)     specEl.value     = d.specialization || "";
            if (skillsEl)   skillsEl.value   = d.skills || "";

            // Hero name
            var heroName = document.getElementById("prfHeroName");
            if (heroName && d.full_name) heroName.textContent = d.full_name;

            // Avatar initials
            var avatarEl = document.getElementById("prfAvatarCircle");
            if (avatarEl && d.full_name) {
                var parts = d.full_name.trim().split(/\s+/);
                var initials = parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0][0];
                avatarEl.textContent = initials.toUpperCase();
            }

            // Completion bar
            var pct = profileCompletionPct(d);
            var pctEl  = document.getElementById("prfCompletionPct");
            var fillEl = document.getElementById("prfProgressFill");
            if (pctEl)  pctEl.textContent = pct + "%";
            if (fillEl) fillEl.style.width = pct + "%";
        }

        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            var btn = form.querySelector('button[type="submit"]');
            setBtnLoading(btn, true, "جاري الحفظ...");
            showStatus(form, null, "");

            try {
                var payload = {
                    id:             user.id,
                    email:          user.email,
                    role:           "job_seeker",
                    full_name:      fullNameEl ? fullNameEl.value.trim() : null,
                    phone:          phoneEl    ? phoneEl.value.trim()    : null,
                    specialization: specEl     ? specEl.value.trim()     : null,
                    skills:         skillsEl   ? skillsEl.value.trim()   : null
                };

                var res = await sb.from("profiles").upsert(payload, { onConflict: "id" });
                if (res.error) throw res.error;

                var pct2 = profileCompletionPct(payload);
                var pctEl2  = document.getElementById("prfCompletionPct");
                var fillEl2 = document.getElementById("prfProgressFill");
                if (pctEl2)  pctEl2.textContent = pct2 + "%";
                if (fillEl2) fillEl2.style.width = pct2 + "%";

                // Update hero name
                var heroName2 = document.getElementById("prfHeroName");
                if (heroName2 && payload.full_name) heroName2.textContent = payload.full_name;

                showStatus(form, "success", "تم حفظ البيانات بنجاح ✓");
            } catch (err) {
                showStatus(form, "error", err.message || "تعذر حفظ البيانات");
            } finally {
                setBtnLoading(btn, false);
            }
        });
    }

    /* ── 10. My-applications page (تسجيلات الدورات) ─────────────── */
    async function initMyApplicationsPage(user) {
        var list = document.getElementById("myApplicationsList");
        if (!list || !user) return;

        var profile = await getProfile(user);
        if (!profile || profile.role !== "job_seeker") return;

        var enrRes = await sb.from("course_enrollments")
            .select("id, course_id, status, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        var items = enrRes.data || [];

        function rawToUiStatus(st) {
            var s = (st || "enrolled").toLowerCase();
            if (s === "completed") return "approved";
            if (s === "cancelled") return "rejected";
            if (s === "enrolled")  return "pending";
            return "pending";
        }

        var totalEl    = document.getElementById("appsTotal");
        var pendingEl  = document.getElementById("appsPending");
        var approvedEl = document.getElementById("appsApproved");
        var counts = { all: items.length, pending: 0, approved: 0, reviewing: 0, rejected: 0 };
        items.forEach(function (a) {
            var ui = rawToUiStatus(a.status);
            if (counts[ui] !== undefined) counts[ui]++;
            else counts.pending++;
        });
        if (totalEl)    totalEl.textContent    = counts.all;
        if (pendingEl)  pendingEl.textContent  = counts.pending;
        if (approvedEl) approvedEl.textContent = counts.approved;

        var fbAll      = document.getElementById("fbAll");
        var fbPending  = document.getElementById("fbPending");
        var fbApproved = document.getElementById("fbApproved");
        var fbReviewing= document.getElementById("fbReviewing");
        var fbRejected = document.getElementById("fbRejected");
        if (fbAll)       fbAll.textContent       = counts.all;
        if (fbPending)   fbPending.textContent   = counts.pending;
        if (fbApproved)  fbApproved.textContent  = counts.approved;
        if (fbReviewing) fbReviewing.textContent = counts.reviewing;
        if (fbRejected)  fbRejected.textContent  = counts.rejected;

        if (!items.length) {
            list.innerHTML = '<div class="apps-empty">' +
                '<div class="apps-empty-icon">📚</div>' +
                '<h3 class="apps-empty-title">لم تسجّل في أي دورة بعد</h3>' +
                '<p class="apps-empty-sub">استعرض الدورات والدبلومات المتاحة واختر ما يناسبك.</p>' +
                '<a href="courses.html" class="apps-empty-btn">استعراض الدورات</a>' +
                '</div>';
            return;
        }

        var courseIds = items.map(function (a) { return a.course_id; }).filter(Boolean);
        var courseMap = new Map();
        if (courseIds.length) {
            var cr = await sb.from("courses").select("id, title").in("id", courseIds);
            (cr.data || []).forEach(function (c) { courseMap.set(c.id, c); });
        }

        var statusMap = {
            pending:   { cls: "app-status-pending",   label: "مسجّل" },
            approved:  { cls: "app-status-approved",  label: "مكتمل" },
            rejected:  { cls: "app-status-rejected",  label: "ملغى" },
            reviewing: { cls: "app-status-reviewing", label: "تحت المراجعة" }
        };

        list.innerHTML = "";
        function escHtml(v) {
            return String(v || "")
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        }

        items.forEach(function (row) {
            var c = courseMap.get(row.course_id);
            var title  = escHtml(c ? c.title : "دورة");
            var date   = row.created_at ? new Date(row.created_at).toLocaleDateString("ar-SA") : "-";
            var uiSt   = rawToUiStatus(row.status);
            var sm     = statusMap[uiSt] || statusMap.pending;

            var el = document.createElement("article");
            el.className = "app-card";
            el.dataset.status = uiSt;
            el.innerHTML =
                '<div class="app-card-logo">📚</div>' +
                '<div class="app-card-body">' +
                    '<h3 class="app-card-title">' + title + '</h3>' +
                    '<div class="app-card-meta">' +
                        '<span class="app-status ' + sm.cls + '">' + sm.label + '</span>' +
                        '<span class="app-card-date">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
                            date +
                        '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="app-card-actions">' +
                    '<a href="job-details.html?course_id=' + encodeURIComponent(row.course_id) + '" class="app-card-btn">تفاصيل الدورة</a>' +
                '</div>';
            list.appendChild(el);
        });

        var filterBar = document.getElementById("appsFilterBar");
        if (filterBar) {
            filterBar.addEventListener("click", function (e) {
                var btn = e.target.closest(".apps-filter-btn");
                if (!btn) return;
                filterBar.querySelectorAll(".apps-filter-btn").forEach(function (b) { b.classList.remove("active"); });
                btn.classList.add("active");
                var filter = btn.dataset.filter;
                list.querySelectorAll(".app-card").forEach(function (card) {
                    if (filter === "all" || card.dataset.status === filter) {
                        card.style.display = "";
                    } else {
                        card.style.display = "none";
                    }
                });
            });
        }
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
        preserveNextInAuthLinks();
        wireLoginForm("seekerLoginForm",   "seekerEmail",   "seekerPassword");
        wireLoginForm("genericLoginForm",  "loginEmail",    "loginPassword");

        // Wire register forms (متدربون فقط — الدور job_seeker في قاعدة البيانات)
        wireRegisterForm("registerSeekerForm",   "seekerFullName",       "seekerEmail",   "seekerPassword",   "seekerPasswordConfirm",   "job_seeker");
        wireRegisterForm("seekerOnlyRegisterForm",   "seekerFullName",      "seekerEmail",   "seekerPassword",   "seekerPasswordConfirm",   "job_seeker");

        // Get current user once
        var user = await getCurrentUser();
        var profile = user ? await getProfile(user) : null;

        // Protected-page redirect — send anonymous users to login
        var PROTECTED = [
            "profile.html", "dashboard.html",
            "my-applications.html",
            "apply.html"
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
