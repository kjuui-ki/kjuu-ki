(function () {
    "use strict";

    var SUPABASE_URL = "https://jgvfcievyfkyldryatlk.supabase.co";
    var SUPABASE_ANON_KEY = "sb_publishable_ieBSqzdn_nZJk4t-n8cNlw_ZjMwsgjY";

    if (typeof window.supabase === "undefined") {
        console.error("Supabase SDK is not available.");
        return;
    }

    var supabase = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = supabase;

    function currentPage() {
        return window.location.pathname.split("/").pop() || "index.html";
    }

    function normalizeRole(role) {
        return String(role || "").trim().toLowerCase();
    }

    function roleLabel(role) {
        role = normalizeRole(role);
        if (role === "job_seeker") return "باحث عن عمل";
        if (role === "company") return "شركة";
        if (role === "super_admin") return "مشرف عام";
        return "-";
    }

    function applyRoleHeaderNav(role) {
        role = normalizeRole(role);
        var mainNav = document.getElementById("mainNav");
        if (!mainNav) return;

        var links = null;

        if (role === "job_seeker") {
            links = [
                { href: "index.html", text: "الرئيسية" },
                { href: "jobs.html", text: "الوظائف" },
                { href: "profile.html", text: "ملفي" },
                { href: "my-applications.html", text: "طلباتي" },
                { href: "course-access.html", text: "الدورات" }
            ];
        } else if (role === "company") {
            links = [
                { href: "index.html", text: "الرئيسية" },
                { href: "company-dashboard.html", text: "لوحة الشركة" },
                { href: "company-profile.html", text: "ملف الشركة" },
                { href: "jobs.html", text: "الوظائف" },
                { href: "course-access.html", text: "الدورات" }
            ];
        } else if (role === "super_admin") {
            links = [
                { href: "dashboard.html", text: "لوحة التحكم" },
                { href: "jobs.html", text: "الوظائف" },
                { href: "index.html", text: "الرئيسية" }
            ];
        }

        if (!links) return;

        var page = currentPage();
        var html = links.map(function (item) {
            var active = item.href === page ? " active" : "";
            return '<a href="' + item.href + '" class="nav-link' + active + '">' + item.text + "</a>";
        }).join("");

        mainNav.innerHTML = html;
    }

    function showFormStatus(form, type, message) {
        if (!form) return;

        var status = form.querySelector(".form-status");
        if (!status) {
            status = document.createElement("div");
            status.className = "form-status";
            form.appendChild(status);
        }

        status.classList.remove("form-status-error", "form-status-success");

        if (!message) {
            status.textContent = "";
            status.style.display = "none";
            return;
        }

        status.textContent = message;
        status.style.display = "block";

        if (type === "error") status.classList.add("form-status-error");
        if (type === "success") status.classList.add("form-status-success");
    }

    function setButtonLoading(button, loading, loadingText) {
        if (!button) return;

        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent || "";
        }

        button.disabled = !!loading;
        button.textContent = loading ? (loadingText || "جاري المعالجة...") : (button.dataset.originalText || "");
    }

    async function getCurrentUser() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            return user || null;
        } catch (error) {
            console.error("getCurrentUser failed", error);
            return null;
        }
    }

    async function getUserRole(user) {
        try {
            var currentUser = user || (await getCurrentUser());
            if (!currentUser) return null;

            const { data: profile, error } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", currentUser.id)
                .single();

            if (error || !profile) return null;
            return normalizeRole(profile.role);
        } catch (error) {
            console.error("getUserRole failed", error);
            return null;
        }
    }

    async function getUserProfile(user) {
        try {
            var currentUser = user || (await getCurrentUser());
            if (!currentUser) return null;

            const { data: profile, error } = await supabase
                .from("profiles")
                .select("full_name, role")
                .eq("id", currentUser.id)
                .single();

            if (error || !profile) return null;
            return {
                full_name: profile.full_name || "",
                role: normalizeRole(profile.role)
            };
        } catch (error) {
            console.error("getUserProfile failed", error);
            return null;
        }
    }

    async function handleLogin(email, password) {
        var loginResponse = null;
        try {
            loginResponse = await supabase.auth.signInWithPassword({
                email,
                password
            });
        } catch (networkError) {
            console.error("Supabase login network error", networkError);
            alert("تعذر الاتصال بخدمة تسجيل الدخول. تحقق من الإنترنت وإعدادات Supabase.");
            return { error: networkError };
        }

        const data = loginResponse.data;
        const error = loginResponse.error;

        if (error) {
            alert(error.message);
            return { error: error };
        }

        const user = data.user;

        if (!user) {
            alert("تعذر جلب بيانات المستخدم بعد تسجيل الدخول");
            return { error: new Error("Missing user") };
        }

        return {
            error: null,
            data: data,
            user: user
        };
    }

    async function logout() {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("logout failed", error);
        }

        var currentMenu = document.getElementById("authUserMenu");
        if (currentMenu && currentMenu.parentElement) {
            currentMenu.parentElement.removeChild(currentMenu);
        }
    }

    function addHeaderUserMenu(fullName, role) {
        var headerInner = document.querySelector(".main-header .header-inner");
        if (!headerInner) return;

        var existing = document.getElementById("authUserMenu");
        if (existing) existing.remove();

        var menu = document.createElement("div");
        menu.id = "authUserMenu";
        menu.className = "user-menu";

        var avatar = document.createElement("div");
        avatar.className = "user-avatar";
        var firstChar = (fullName || "?").trim().charAt(0) || "?";
        avatar.textContent = firstChar.toUpperCase();

        var info = document.createElement("div");
        info.className = "user-info";

        var nameNode = document.createElement("div");
        nameNode.className = "user-name";
        nameNode.textContent = fullName || "-";

        var roleNode = document.createElement("div");
        roleNode.className = "user-role";
        roleNode.textContent = roleLabel(role);

        var logoutBtn = document.createElement("button");
        logoutBtn.type = "button";
        logoutBtn.id = "authLogoutBtn";
        logoutBtn.className = "btn btn-outline";
        logoutBtn.textContent = "تسجيل الخروج";

        info.appendChild(nameNode);
        info.appendChild(roleNode);
        menu.appendChild(avatar);
        menu.appendChild(info);
        menu.appendChild(logoutBtn);

        var langSwitch = headerInner.querySelector(".lang-switch");
        if (langSwitch) {
            headerInner.insertBefore(menu, langSwitch);
        } else {
            headerInner.appendChild(menu);
        }
    }

    function bindGlobalLogout() {
        document.addEventListener("click", function (event) {
            var target = event.target;
            if (!target || !target.closest) return;

            var logoutTrigger = target.closest("#authLogoutBtn, #adminHeaderLogout, [data-logout='true']");
            if (!logoutTrigger) return;

            event.preventDefault();
            void logout();
        });
    }

    function bindHeaderNavClicks() {
        var mainNav = document.getElementById("mainNav");
        if (!mainNav) return;
        if (mainNav.dataset.navBound === "true") return;

        mainNav.dataset.navBound = "true";
        mainNav.addEventListener("click", function (event) {
            var target = event.target;
            if (!target || !target.closest) return;

            var link = target.closest("a.nav-link[href]");
            if (!link) return;

            var href = link.getAttribute("href") || "";
            if (!href || href.charAt(0) === "#") return;

            // Force stable header navigation and avoid accidental click swallowing.
            event.preventDefault();
            event.stopPropagation();

            if (href === currentPage()) return;
            if (mainNav.classList.contains("open")) {
                mainNav.classList.remove("open");
            }
            window.location.href = href;
        });
    }

    async function initLoginForms() {
        var page = currentPage();

        function wireForgotPassword(form, emailInputId) {
            var link = form ? form.querySelector(".auth-forgot") : null;
            if (!link) return;

            link.addEventListener("click", async function (event) {
                event.preventDefault();
                var emailInput = document.getElementById(emailInputId);
                var email = emailInput ? emailInput.value.trim() : "";

                if (!email) {
                    alert("أدخل البريد الإلكتروني أولاً");
                    return;
                }

                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + "/reset-password.html"
                });

                if (error) {
                    alert(error.message || "تعذر إرسال رابط إعادة التعيين");
                    return;
                }

                alert("تم إرسال رابط إعادة تعيين كلمة المرور");
            });
        }

        var seekerForm = document.getElementById("seekerLoginForm");
        if (seekerForm && page === "seeker-login.html") {
            wireForgotPassword(seekerForm, "seekerEmail");
            seekerForm.addEventListener("submit", async function (event) {
                event.preventDefault();

                var email = ((document.getElementById("seekerEmail") || {}).value || "").trim();
                var password = (document.getElementById("seekerPassword") || {}).value || "";
                var submitBtn = seekerForm.querySelector('button[type="submit"]');

                if (!email || !password) {
                    showFormStatus(seekerForm, "error", "يرجى إدخال البريد الإلكتروني وكلمة المرور");
                    return;
                }

                showFormStatus(seekerForm, null, "");
                setButtonLoading(submitBtn, true, "جاري تسجيل الدخول...");
                try {
                    var result = await handleLogin(email, password);
                    if (result && result.error) {
                        showFormStatus(seekerForm, "error", result.error.message || "فشل تسجيل الدخول");
                    } else {
                        showFormStatus(seekerForm, "success", "تم تسجيل الدخول");
                    }
                } catch (error) {
                    showFormStatus(seekerForm, "error", "حدث خطأ أثناء تسجيل الدخول");
                } finally {
                    setButtonLoading(submitBtn, false);
                }
            });
        }

        var employerForm = document.getElementById("employerLoginForm");
        if (employerForm && page === "employer-login.html") {
            wireForgotPassword(employerForm, "employerEmail");
            employerForm.addEventListener("submit", async function (event) {
                event.preventDefault();

                var email = ((document.getElementById("employerEmail") || {}).value || "").trim();
                var password = (document.getElementById("employerPassword") || {}).value || "";
                var submitBtn = employerForm.querySelector('button[type="submit"]');

                if (!email || !password) {
                    showFormStatus(employerForm, "error", "يرجى إدخال البريد الإلكتروني وكلمة المرور");
                    return;
                }

                showFormStatus(employerForm, null, "");
                setButtonLoading(submitBtn, true, "جاري تسجيل الدخول...");
                try {
                    var result = await handleLogin(email, password);
                    if (result && result.error) {
                        showFormStatus(employerForm, "error", result.error.message || "فشل تسجيل الدخول");
                    } else {
                        showFormStatus(employerForm, "success", "تم تسجيل الدخول");
                    }
                } catch (error) {
                    showFormStatus(employerForm, "error", "حدث خطأ أثناء تسجيل الدخول");
                } finally {
                    setButtonLoading(submitBtn, false);
                }
            });
        }

        var genericForm = document.getElementById("genericLoginForm");
        if (genericForm && page === "login.html") {
            genericForm.addEventListener("submit", async function (event) {
                event.preventDefault();

                var email = ((document.getElementById("loginEmail") || {}).value || "").trim();
                var password = (document.getElementById("loginPassword") || {}).value || "";
                var submitBtn = genericForm.querySelector('button[type="submit"]');

                if (!email || !password) {
                    showFormStatus(genericForm, "error", "يرجى إدخال البريد الإلكتروني وكلمة المرور");
                    return;
                }

                showFormStatus(genericForm, null, "");
                setButtonLoading(submitBtn, true, "جاري تسجيل الدخول...");
                try {
                    var result = await handleLogin(email, password);
                    if (result && result.error) {
                        showFormStatus(genericForm, "error", result.error.message || "فشل تسجيل الدخول");
                    } else {
                        showFormStatus(genericForm, "success", "تم تسجيل الدخول");
                    }
                } catch (error) {
                    showFormStatus(genericForm, "error", "حدث خطأ أثناء تسجيل الدخول");
                } finally {
                    setButtonLoading(submitBtn, false);
                }
            });
        }
    }

    async function initRegisterForms() {
        function wireRegisterForm(form, fullNameInputId, emailInputId, passwordInputId, confirmInputId, role) {
            if (!form) return;

            form.addEventListener("submit", async function (event) {
                event.preventDefault();
                var fullName = ((document.getElementById(fullNameInputId) || {}).value || "").trim();
                var email = ((document.getElementById(emailInputId) || {}).value || "").trim();
                var password = (document.getElementById(passwordInputId) || {}).value || "";
                var confirmPassword = (document.getElementById(confirmInputId) || {}).value || "";
                var submitBtn = form.querySelector('button[type="submit"]');

                if (!fullName || !email || !password) {
                    showFormStatus(form, "error", "يرجى تعبئة الحقول المطلوبة");
                    return;
                }

                if (password.length < 6) {
                    showFormStatus(form, "error", "كلمة المرور يجب أن تكون 6 أحرف على الأقل");
                    return;
                }

                if (confirmInputId && password !== confirmPassword) {
                    showFormStatus(form, "error", "تأكيد كلمة المرور غير متطابق");
                    return;
                }

                showFormStatus(form, null, "");
                setButtonLoading(submitBtn, true, "جاري إنشاء الحساب...");

                try {
                    const { error } = await supabase.auth.signUp({
                        email: email,
                        password: password,
                        options: {
                            data: {
                                full_name: fullName,
                                role: role
                            }
                        }
                    });

                    if (error) {
                        showFormStatus(form, "error", error.message || "تعذر إنشاء الحساب");
                        return;
                    }

                    showFormStatus(form, "success", "تم إنشاء الحساب بنجاح، يمكنك تسجيل الدخول الآن");
                } catch (error) {
                    showFormStatus(form, "error", "حدث خطأ أثناء إنشاء الحساب");
                } finally {
                    setButtonLoading(submitBtn, false);
                }
            });
        }

        wireRegisterForm(document.getElementById("registerSeekerForm"), "seekerFullName", "seekerEmail", "seekerPassword", "seekerPasswordConfirm", "job_seeker");
        wireRegisterForm(document.getElementById("registerEmployerForm"), "employerCompanyName", "employerEmail", "employerPassword", "employerPasswordConfirm", "company");
        wireRegisterForm(document.getElementById("seekerOnlyRegisterForm"), "seekerFullName", "seekerEmail", "seekerPassword", "seekerPasswordConfirm", "job_seeker");
        wireRegisterForm(document.getElementById("employerOnlyRegisterForm"), "employerCompanyName", "employerEmail", "employerPassword", "employerPasswordConfirm", "company");
    }

    async function initSeekerProfilePage(state) {
        var form = document.getElementById("seekerProfileForm");
        if (!form) return;

        var user = state.user;
        if (!user || state.role !== "job_seeker") return;

        var fullNameInput = document.getElementById("profileFullName");
        var phoneInput = document.getElementById("profilePhone");
        var specializationInput = document.getElementById("profileSpecialization");
        var skillsInput = document.getElementById("profileSkills");
        var cvInput = document.getElementById("profileCv");
        var cvLinkContainer = document.getElementById("profileCvLinkContainer");
        var cvLink = document.getElementById("profileCvLink");

        try {
            const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, phone, specialization, skills, cv_url")
                .eq("id", user.id)
                .single();

            if (profile) {
                if (fullNameInput) fullNameInput.value = profile.full_name || "";
                if (phoneInput) phoneInput.value = profile.phone || "";
                if (specializationInput) specializationInput.value = profile.specialization || "";
                if (skillsInput) skillsInput.value = profile.skills || "";

                if (cvLinkContainer && cvLink && profile.cv_url) {
                    cvLink.href = profile.cv_url;
                    cvLinkContainer.style.display = "block";
                }
            }
        } catch (error) {
            console.error("Failed to load seeker profile", error);
        }

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var submitBtn = form.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true, "جاري الحفظ...");
            showFormStatus(form, null, "");

            try {
                var cvUrl = null;
                var file = cvInput && cvInput.files ? cvInput.files[0] : null;

                if (file) {
                    var safeName = String(file.name || "cv").replace(/[^a-zA-Z0-9._-]+/g, "_");
                    var path = user.id + "/" + Date.now() + "-" + safeName;

                    const { error: uploadError } = await supabase.storage
                        .from("cvs")
                        .upload(path, file, { upsert: true });

                    if (uploadError) throw uploadError;

                    var publicUrlResult = supabase.storage.from("cvs").getPublicUrl(path);
                    cvUrl = publicUrlResult && publicUrlResult.data ? publicUrlResult.data.publicUrl : null;
                }

                var payload = {
                    id: user.id,
                    full_name: fullNameInput ? fullNameInput.value.trim() : null,
                    phone: phoneInput ? phoneInput.value.trim() : null,
                    specialization: specializationInput ? specializationInput.value.trim() : null,
                    skills: skillsInput ? skillsInput.value.trim() : null
                };

                if (cvUrl) payload.cv_url = cvUrl;

                const { error: upsertError } = await supabase
                    .from("profiles")
                    .upsert(payload, { onConflict: "id" });

                if (upsertError) throw upsertError;

                if (cvUrl && cvLinkContainer && cvLink) {
                    cvLink.href = cvUrl;
                    cvLinkContainer.style.display = "block";
                }

                showFormStatus(form, "success", "تم حفظ البيانات بنجاح");
            } catch (error) {
                showFormStatus(form, "error", error.message || "تعذر حفظ البيانات");
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

    async function initCompanyProfilePage(state) {
        var form = document.getElementById("companyProfileForm");
        if (!form) return;

        var user = state.user;
        if (!user || state.role !== "company") return;

        var nameInput = document.getElementById("companyName");
        var phoneInput = document.getElementById("companyPhone");
        var specInput = document.getElementById("companySpecialization");
        var servicesInput = document.getElementById("companyServices");

        try {
            const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, phone, specialization, skills")
                .eq("id", user.id)
                .single();

            if (profile) {
                if (nameInput) nameInput.value = profile.full_name || "";
                if (phoneInput) phoneInput.value = profile.phone || "";
                if (specInput) specInput.value = profile.specialization || "";
                if (servicesInput) servicesInput.value = profile.skills || "";
            }
        } catch (error) {
            console.error("Failed to load company profile", error);
        }

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var submitBtn = form.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true, "جاري الحفظ...");
            showFormStatus(form, null, "");

            try {
                const { error } = await supabase
                    .from("profiles")
                    .upsert({
                        id: user.id,
                        full_name: nameInput ? nameInput.value.trim() : null,
                        phone: phoneInput ? phoneInput.value.trim() : null,
                        specialization: specInput ? specInput.value.trim() : null,
                        skills: servicesInput ? servicesInput.value.trim() : null
                    }, { onConflict: "id" });

                if (error) throw error;
                showFormStatus(form, "success", "تم حفظ بيانات الشركة");
            } catch (error) {
                showFormStatus(form, "error", error.message || "تعذر حفظ البيانات");
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

    async function initPostJobForm(state) {
        var form = document.getElementById("postJobForm");
        if (!form) return;

        var user = state.user;
        if (!user || state.role !== "company") return;

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var submitBtn = form.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true, "جاري نشر الوظيفة...");
            showFormStatus(form, null, "");

            try {
                var payload = {
                    company_id: user.id,
                    title: ((document.getElementById("jobTitle") || {}).value || "").trim(),
                    description: ((document.getElementById("jobDescription") || {}).value || "").trim(),
                    requirements: ((document.getElementById("jobRequirements") || {}).value || "").trim(),
                    salary: ((document.getElementById("jobSalary") || {}).value || "").trim() || null,
                    location: ((document.getElementById("jobLocation") || {}).value || "").trim(),
                    job_type: ((document.getElementById("jobType") || {}).value || "").trim(),
                    category: ((document.getElementById("jobCategory") || {}).value || "").trim(),
                    application_deadline: ((document.getElementById("jobDeadline") || {}).value || "").trim() || null,
                    status: "active"
                };

                if (!payload.title || !payload.description || !payload.requirements || !payload.location || !payload.job_type || !payload.category) {
                    showFormStatus(form, "error", "يرجى تعبئة جميع الحقول المطلوبة");
                    return;
                }

                const { error } = await supabase.from("jobs").insert([payload]);
                if (error) throw error;

                showFormStatus(form, "success", "تم نشر الوظيفة بنجاح");
                form.reset();
            } catch (error) {
                showFormStatus(form, "error", error.message || "تعذر نشر الوظيفة");
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

    async function initMyApplicationsPage(state) {
        var list = document.getElementById("myApplicationsList");
        if (!list) return;

        var user = state.user;
        if (!user || state.role !== "job_seeker") return;

        try {
            const { data: applications, error: applicationsError } = await supabase
                .from("applications")
                .select("id, job_id, status, created_at")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (applicationsError) throw applicationsError;

            var items = Array.isArray(applications) ? applications : [];
            if (items.length === 0) {
                list.innerHTML = "<p>لم تقم بالتقديم على أي وظيفة حتى الآن.</p>";
                return;
            }

            var jobIds = items.map(function (item) { return item.job_id; }).filter(Boolean);
            const { data: jobs } = await supabase
                .from("jobs")
                .select("id, title")
                .in("id", jobIds);

            var jobMap = new Map();
            (Array.isArray(jobs) ? jobs : []).forEach(function (job) {
                jobMap.set(job.id, job);
            });

            list.innerHTML = "";
            items.forEach(function (application) {
                var card = document.createElement("article");
                card.className = "job-card-modern";
                var job = jobMap.get(application.job_id);
                var title = job && job.title ? job.title : "وظيفة";
                var dateText = application.created_at ? new Date(application.created_at).toLocaleDateString("ar-SA") : "-";

                card.innerHTML =
                    "<h3>" + title + "</h3>" +
                    "<p>الحالة: " + (application.status || "pending") + "</p>" +
                    "<p>تاريخ التقديم: " + dateText + "</p>";

                list.appendChild(card);
            });
        } catch (error) {
            console.error("Failed to load applications", error);
            list.innerHTML = "<p>حدث خطأ أثناء تحميل الطلبات.</p>";
        }
    }

    async function refreshHeader(state) {
        if (!state || !state.user) return;

        var profile = state.profile || (await getUserProfile(state.user));
        var role = normalizeRole(state.role || (profile ? profile.role : null));
        var fullName = profile && profile.full_name ? profile.full_name : (state.user.email || "User");

        applyRoleHeaderNav(role);
        addHeaderUserMenu(fullName, role);
    }

    async function bootstrap() {
        try {
            bindGlobalLogout();
            bindHeaderNavClicks();
            await initRegisterForms();

            var user = await getCurrentUser();
            var profile = user ? await getUserProfile(user) : null;
            var role = normalizeRole(profile && profile.role ? profile.role : null);
            var state = {
                blocked: false,
                user: user,
                role: role,
                profile: profile
            };

            await refreshHeader(state);
            await initSeekerProfilePage(state);
            await initCompanyProfilePage(state);
            await initPostJobForm(state);
            await initMyApplicationsPage(state);
        } catch (error) {
            console.error("Auth bootstrap failed", error);
        }
    }

    window.authApi = {
        supabase: supabase,
        handleLogin: handleLogin,
        logout: logout,
        getCurrentUser: getCurrentUser,
        getUserRole: getUserRole
    };

    window.handleLogin = handleLogin;

    document.addEventListener("DOMContentLoaded", function () {
        void bootstrap();
    });
})();
