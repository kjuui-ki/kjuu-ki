// تهيئة Supabase عبر CDN (supabase-js v2)
// مشروع: ksu-maher
// ملاحظة: استعمل فقط anon key (ليست secret key)

const SUPABASE_URL = "https://jgvfcievyfkyldryatlk.supabase.co"; // رابط مشروع ksu-maher
const SUPABASE_ANON_KEY = "sb_publishable_ieBSqzdn_nZJk4t-n8cNlw_ZjMwsgjY"; // anon key لمشروع ksu-maher

// يفترض أن سكربت CDN:
// https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
// قد تم تحميله قبل هذا الملف، ويعرّف كائن supabase في الـ window

let supabaseClient = null;

if (typeof supabase !== "undefined") {
	supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		auth: {
			persistSession: true,
			storage: window.localStorage
		}
	});
}

async function maherResolveUserRole(user) {
	if (!user) return null;
	let role = null;

	if (!supabaseClient) return null;
	try {
		const { data: profile, error: profileError } = await supabaseClient
			.from("profiles")
			.select("role")
			.eq("id", user.id)
			.single();

		if (!profileError && profile && profile.role) {
			role = profile.role;
		}
	} catch (e) {
		role = null;
	}

	return role || null;
}

async function maherEnsureAuthOrRedirect(redirectPath) {
	if (!supabaseClient) return;
	try {
		const { data } = await supabaseClient.auth.getSession();
		if (!data || !data.session) {
			const target = redirectPath || "course-access.html";
			const current = window.location.pathname + window.location.search;
			const url = target + "?redirect=" + encodeURIComponent(current);
			window.location.href = url;
		}
	} catch (e) {
		console.error("Auth check failed", e);
	}
}

function maherRedirectAfterLogin(role) {
	if (role === "job_seeker") {
		window.location.href = "profile.html";
	} else if (role === "company") {
		window.location.href = "post-job.html";
	} else if (role === "super_admin") {
		window.location.href = "dashboard.html";
	} else {
		window.location.href = "index.html";
	}
}

async function maherHandleRegister(email, password, fullName, role) {
	if (!supabaseClient) return { error: new Error("Supabase not initialized") };

	const { data, error } = await supabaseClient.auth.signUp({
		email,
		password,
		options: {
			data: {
				full_name: fullName,
				role: role
			}
		}
	});

	if (error) {
		return { error };
	}

	// لا نقوم بأي insert يدوي في جدول profiles
	// التريغر في قاعدة البيانات سيتولى إنشاء الصف

	return { data };
}

async function maherHandleLogin(email, password) {
	if (!supabaseClient) return { error: new Error("Supabase not initialized") };

	const { data, error } = await supabaseClient.auth.signInWithPassword({
		email,
		password
	});

	if (error) {
		return { error };
	}

	const { data: sessionData } = await supabaseClient.auth.getSession();
	const session = sessionData && sessionData.session;
	const user = session && session.user ? session.user : data.user;
	let role = await maherResolveUserRole(user);

	if (role) {
		try {
			window.localStorage.setItem("maherUserRole", role);
		} catch (e) {}
	}

	return { data, role };
}

async function maherHandleForgotPassword(email) {
	if (!supabaseClient) return { error: new Error("Supabase not initialized") };

	const redirectTo = window.location.origin + "/reset-password.html";
	const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
		redirectTo: redirectTo
	});

	if (error) {
		return { error };
	}

	return { error: null };
}

function maherGetLang() {
	try {
		var lang = document.documentElement.lang || "ar";
		return lang === "en" ? "en" : "ar";
	} catch (e) {
		return "ar";
	}
}

function maherIsEmailValid(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maherBuildErrorMessage(error) {
	var lang = maherGetLang();
	if (!error) {
		return lang === "ar"
			? "حدث خطأ غير متوقع، حاول مرة أخرى."
			: "Unexpected error, please try again.";
	}
	var msg = (error.message || "").toLowerCase();
	var status = error.status;
	if (status === 429 || msg.indexOf("rate limit") !== -1) {
		return lang === "ar"
			? "تم إرسال طلبات كثيرة خلال فترة قصيرة، يرجى المحاولة بعد قليل."
			: "Too many requests, please try again later.";
	}
	if (msg.indexOf("invalid login credentials") !== -1) {
		return lang === "ar"
			? "بيانات تسجيل الدخول غير صحيحة. تأكد من البريد الإلكتروني وكلمة المرور."
			: "Invalid login credentials. Please check your email and password.";
	}
	if (msg.indexOf("user already registered") !== -1 || msg.indexOf("already exists") !== -1) {
		return lang === "ar"
			? "هذا البريد الإلكتروني مسجّل بالفعل. جرّب تسجيل الدخول أو استخدم بريدًا آخر."
			: "This email is already registered. Try logging in or use another email.";
	}
	if (msg.indexOf("email") !== -1 && msg.indexOf("invalid") !== -1) {
		return lang === "ar"
			? "صيغة البريد الإلكتروني غير صحيحة."
			: "Email format is invalid.";
	}
	return (lang === "ar" ? "حدث خطأ: " : "Error: ") + (error.message || "");
}

function maherShowFormStatus(form, type, message) {
	if (!form) return;
	var el = form.querySelector(".form-status");
	if (!el) {
		el = document.createElement("div");
		el.className = "form-status";
		form.appendChild(el);
	}
	el.classList.remove("form-status-error", "form-status-success");
	if (!type || !message) {
		el.style.display = "none";
		el.textContent = "";
		return;
	}
	el.style.display = "block";
	el.textContent = message;
	if (type === "error") {
		el.classList.add("form-status-error");
	} else if (type === "success") {
		el.classList.add("form-status-success");
	}
}

function maherSetButtonLoading(btn, isLoading, context) {
	if (!btn) return;
	var lang = maherGetLang();
	if (!btn.dataset.originalText) {
		btn.dataset.originalText = btn.textContent || "";
	}
	if (isLoading) {
		btn.disabled = true;
		btn.classList.add("btn-loading");
		var text;
		if (context === "login") {
			text = lang === "ar" ? "جاري تسجيل الدخول..." : "Signing in...";
		} else {
			text = lang === "ar" ? "جاري إنشاء الحساب..." : "Creating account...";
		}
		btn.textContent = text;
	} else {
		btn.disabled = false;
		btn.classList.remove("btn-loading");
		if (btn.dataset.originalText) {
			btn.textContent = btn.dataset.originalText;
		}
	}
}

function maherRenderUserHeader(displayName, role) {
	if (!supabaseClient) return;
	const headerInner = document.querySelector(".main-header .header-inner");
	if (!headerInner) return;

	let userMenu = document.getElementById("maherUserMenu");
	if (!userMenu) {
		userMenu = document.createElement("div");
		userMenu.id = "maherUserMenu";
		userMenu.className = "user-menu";

		const langSwitch = document.querySelector(".lang-switch");
		if (langSwitch && langSwitch.parentElement === headerInner) {
			headerInner.insertBefore(userMenu, langSwitch);
		} else {
			headerInner.appendChild(userMenu);
		}
	}

	userMenu.innerHTML = "";
	maherRenderMainNav(role);

	const name = displayName || "";
	const firstChar = name.trim().charAt(0) || "?";
	const avatar = document.createElement("div");
	avatar.className = "user-avatar";
	avatar.textContent = firstChar.toUpperCase();

	const info = document.createElement("div");
	info.className = "user-info";

	const nameSpan = document.createElement("div");
	nameSpan.className = "user-name";
	nameSpan.textContent = name || "";

	const roleSpan = document.createElement("div");
	roleSpan.className = "user-role";
	if (role === "company") {
		roleSpan.textContent = "شركة";
	} else if (role === "job_seeker") {
		roleSpan.textContent = "باحث عن عمل";
	} else if (role === "super_admin") {
		roleSpan.textContent = "مشرف عام";
	} else {
		roleSpan.textContent = "";
	}

	info.appendChild(nameSpan);
	if (roleSpan.textContent) {
		info.appendChild(roleSpan);
	}

	// زر إجراء رئيسي حسب الدور
	const actions = document.createElement("div");
	actions.className = "user-actions";
	if (role === "company") {
		const postJobLink = document.createElement("a");
		postJobLink.href = "post-job.html";
		postJobLink.className = "btn btn-secondary user-action-btn";
		postJobLink.textContent = "نشر وظيفة";
		actions.appendChild(postJobLink);
	} else if (role === "job_seeker") {
		const profileLink = document.createElement("a");
		profileLink.href = "profile.html";
		profileLink.className = "btn btn-secondary user-action-btn";
		profileLink.textContent = "ملفي";
		actions.appendChild(profileLink);
	} else if (role === "super_admin") {
		const dashboardLink = document.createElement("a");
		dashboardLink.href = "dashboard.html";
		dashboardLink.className = "btn btn-secondary user-action-btn";
		dashboardLink.textContent = "لوحة التحكم";
		actions.appendChild(dashboardLink);
	}

	const btn = document.createElement("button");
	btn.id = "maherLogoutBtn";
	btn.className = "btn btn-outline";
	btn.textContent = "تسجيل الخروج";

	btn.addEventListener("click", async function () {
		try {
			await supabaseClient.auth.signOut();
		} catch (e) {
			console.error("Error signing out", e);
		}
	});

	userMenu.appendChild(avatar);
	userMenu.appendChild(info);
	if (actions.childNodes.length > 0) {
		userMenu.appendChild(actions);
	}
	userMenu.appendChild(btn);

	try {
		if (name) window.localStorage.setItem("maherUserName", name);
		if (role) window.localStorage.setItem("maherUserRole", role);
	} catch (e) {}
}

function maherRenderMainNav(role) {
	const mainNav = document.getElementById("mainNav");
	if (!mainNav) return;

	const lang = maherCurrentLang();
	const currentPath = window.location.pathname.split("/").pop() || "index.html";
	const guestLinks = [
		{ href: "index.html", textAr: "الرئيسية", textEn: "Home" },
		{ href: "seeker-login.html", textAr: "الباحثون عن العمل", textEn: "Job Seekers" },
		{ href: "employer-login.html", textAr: "أصحاب الأعمال والشركات", textEn: "Employers & Companies" },
		{ href: "jobs.html", textAr: "الوظائف", textEn: "Jobs" },
		{ href: "course-access.html", textAr: "الدورات", textEn: "Courses" }
	];

	const seekerLinks = [
		{ href: "index.html", textAr: "الرئيسية", textEn: "Home" },
		{ href: "jobs.html", textAr: "الوظائف", textEn: "Jobs" },
		{ href: "profile.html", textAr: "ملفي", textEn: "My Profile" },
		{ href: "course-access.html", textAr: "الدورات", textEn: "Courses" },
		{ href: "my-applications.html", textAr: "طلباتي", textEn: "My Applications" }
	];

	const companyLinks = [
		{ href: "index.html", textAr: "الرئيسية", textEn: "Home" },
		{ href: "post-job.html", textAr: "نشر وظيفة", textEn: "Post Job" },
		{ href: "jobs.html#posted-jobs", textAr: "وظائفي المنشورة", textEn: "Published Jobs" },
		{ href: "company-profile.html", textAr: "ملف الشركة", textEn: "Company Profile" },
		{ href: "course-access.html", textAr: "الدورات", textEn: "Courses" },
		{ href: "dashboard.html#reports", textAr: "التقارير", textEn: "Reports" }
	];

	const adminLinks = [
		{ href: "dashboard.html", textAr: "لوحة التحكم", textEn: "Dashboard" },
		{ href: "dashboard.html#seekers", textAr: "الباحثين", textEn: "Job Seekers" },
		{ href: "dashboard.html#companies", textAr: "الشركات", textEn: "Companies" },
		{ href: "dashboard.html#jobs", textAr: "الوظائف", textEn: "Jobs" },
		{ href: "dashboard.html#applications", textAr: "الطلبات", textEn: "Applications" },
		{ href: "dashboard.html#stats", textAr: "الإحصائيات", textEn: "Statistics" }
	];

	let links = guestLinks;
	if (role === "job_seeker") links = seekerLinks;
	if (role === "company") links = companyLinks;
	if (role === "super_admin") links = adminLinks;

	let html = "";
	for (let i = 0; i < links.length; i += 1) {
		const item = links[i];
		const text = lang === "en" ? item.textEn : item.textAr;
		const hrefPath = item.href.split("#")[0];
		const isActive = currentPath === hrefPath || (currentPath === "" && hrefPath === "index.html");
		html += '<a href="' + item.href + '" class="nav-link' + (isActive ? ' active' : '') + '">' + text + '</a>';
	}

	mainNav.innerHTML = html;
}

function maherClearUserHeader() {
	const userMenu = document.getElementById("maherUserMenu");
	if (userMenu && userMenu.parentElement) {
		userMenu.parentElement.removeChild(userMenu);
	}
}

// تحديث روابط الهيدر حسب حالة الجلسة والدور
function maherUpdateHeaderLinks(isLoggedIn, role) {
	const mainNav = document.getElementById("mainNav");
	if (!mainNav) return;

	if (!isLoggedIn) {
		maherRenderMainNav(null);
		return;
	}

	maherRenderMainNav(role || null);
}

// إظهار/إخفاء زر نشر وظيفة جديدة في صفحة الوظائف
function maherShowAddJobButton(role) {
	const addJobBtn = document.getElementById("addJobBtn");
	if (!addJobBtn) return;

	// إظهار الزر فقط للشركات
	if (role === "company") {
		addJobBtn.style.display = "inline-block";
	} else {
		addJobBtn.style.display = "none";
	}
}

function maherCurrentLang() {
	return document.documentElement.lang === "en" ? "en" : "ar";
}

function maherApplyRoleBodyClass(role) {
	if (!document.body) return;
	document.body.classList.remove("role-job-seeker", "role-company", "role-super-admin");
	if (role === "job_seeker") {
		document.body.classList.add("role-job-seeker");
	}
	if (role === "company") {
		document.body.classList.add("role-company");
	}
	if (role === "super_admin") {
		document.body.classList.add("role-super-admin");
	}
}

function maherRenderRoleQuickNav(role) {
	if (role !== "job_seeker" && role !== "company") return;

	const header = document.querySelector(".main-header");
	if (!header || !header.parentElement) return;

	const lang = maherCurrentLang();
	let roleNav = document.getElementById("maherRoleNav");
	if (!roleNav) {
		roleNav = document.createElement("section");
		roleNav.id = "maherRoleNav";
		roleNav.className = "role-quick-nav";
		header.parentElement.insertBefore(roleNav, header.nextSibling);
	}

	const seekerLinks = [
		{ href: "profile.html", textAr: "ملفي الشخصي", textEn: "My Profile" },
		{ href: "profile.html#cv", textAr: "السيرة الذاتية", textEn: "CV" },
		{ href: "jobs.html", textAr: "الوظائف", textEn: "Jobs" },
		{ href: "course-access.html", textAr: "الدورات", textEn: "Courses" },
		{ href: "my-applications.html", textAr: "طلباتي", textEn: "My Applications" }
	];

	const companyLinks = [
		{ href: "post-job.html", textAr: "نشر وظيفة", textEn: "Post Job" },
		{ href: "jobs.html#posted-jobs", textAr: "وظائفي المنشورة", textEn: "Published Jobs" },
		{ href: "company-profile.html", textAr: "ملف الشركة", textEn: "Company Profile" },
		{ href: "course-access.html", textAr: "الدورات", textEn: "Courses" },
		{ href: "dashboard.html#reports", textAr: "التقارير", textEn: "Reports" }
	];

	const links = role === "company" ? companyLinks : seekerLinks;
	const title = role === "company"
		? (lang === "en" ? "Company Workspace" : "مساحة الشركة")
		: (lang === "en" ? "Job Seeker Workspace" : "مساحة الباحث عن عمل");

	let linksHtml = "";
	for (let i = 0; i < links.length; i += 1) {
		const item = links[i];
		const text = lang === "en" ? item.textEn : item.textAr;
		linksHtml += '<a class="role-quick-link" href="' + item.href + '">' + text + '</a>';
	}

	roleNav.innerHTML =
		'<div class="container role-quick-inner">' +
		'<div class="role-quick-title">' + title + '</div>' +
		'<div class="role-quick-links">' + linksHtml + '</div>' +
		"</div>";
}

function maherRenderRoleHome(role, displayName) {
	const path = window.location.pathname.split("/").pop() || "index.html";
	if (path !== "index.html") return;
	if (role !== "job_seeker" && role !== "company") return;

	const main = document.querySelector("main");
	if (!main) return;

	const lang = maherCurrentLang();
	const name = displayName || (lang === "en" ? "User" : "المستخدم");

	const seekerContent = {
		title: lang === "en" ? "Your Career Dashboard" : "لوحة الباحث المهنية",
		subtitle: lang === "en"
			? "Track your profile, applications, and opportunities from one place."
			: "تابع ملفك، طلباتك، والفرص المناسبة لك من مكان واحد.",
		cards: [
			{ href: "profile.html", titleAr: "ملفي الشخصي", titleEn: "My Profile", textAr: "تحديث بياناتك المهنية", textEn: "Update your professional details" },
			{ href: "profile.html#cv", titleAr: "السيرة الذاتية", titleEn: "CV", textAr: "إدارة السيرة الذاتية ورفع نسخة جديدة", textEn: "Manage and upload your CV" },
			{ href: "jobs.html", titleAr: "الوظائف", titleEn: "Jobs", textAr: "استعراض فرص العمل والتقديم", textEn: "Browse and apply to jobs" },
			{ href: "course-access.html", titleAr: "الدورات", titleEn: "Courses", textAr: "تطوير المهارات عبر الدورات", textEn: "Improve skills with training" },
			{ href: "my-applications.html", titleAr: "طلباتي", titleEn: "My Applications", textAr: "متابعة الوظائف المتقدم عليها", textEn: "Track your submitted applications" }
		]
	};

	const companyContent = {
		title: lang === "en" ? "Company Control Hub" : "لوحة تحكم الشركة",
		subtitle: lang === "en"
			? "Publish jobs, manage your company profile, and monitor hiring progress."
			: "انشر الوظائف، أدِر ملف شركتك، وتابع مؤشرات التوظيف.",
		cards: [
			{ href: "post-job.html", titleAr: "نشر وظيفة", titleEn: "Post Job", textAr: "أضف وظيفة جديدة مباشرة", textEn: "Publish a new opening now" },
			{ href: "jobs.html#posted-jobs", titleAr: "وظائفي المنشورة", titleEn: "Published Jobs", textAr: "مراجعة الوظائف المنشورة", textEn: "Review your active listings" },
			{ href: "company-profile.html", titleAr: "ملف الشركة", titleEn: "Company Profile", textAr: "تحديث معلومات الشركة", textEn: "Update company information" },
			{ href: "course-access.html", titleAr: "الدورات", titleEn: "Courses", textAr: "تدريب فريق العمل", textEn: "Train your internal team" },
			{ href: "dashboard.html#reports", titleAr: "التقارير", titleEn: "Reports", textAr: "مؤشرات أولية للأداء", textEn: "Early hiring performance insights" }
		]
	};

	const content = role === "company" ? companyContent : seekerContent;
	let cardsHtml = "";
	for (let i = 0; i < content.cards.length; i += 1) {
		const card = content.cards[i];
		const title = lang === "en" ? card.titleEn : card.titleAr;
		const text = lang === "en" ? card.textEn : card.textAr;
		cardsHtml +=
			'<a class="role-home-card" href="' + card.href + '">' +
			'<h3>' + title + "</h3>" +
			'<p>' + text + "</p>" +
			"</a>";
	}

	const welcomePrefix = lang === "en" ? "Welcome" : "مرحبًا";
	main.innerHTML =
		'<section class="role-home">' +
		'<div class="container">' +
		'<div class="role-home-hero">' +
		'<p class="role-home-welcome">' + welcomePrefix + " " + name + "</p>" +
		"<h1>" + content.title + "</h1>" +
		"<p>" + content.subtitle + "</p>" +
		"</div>" +
		'<div class="role-home-grid">' + cardsHtml + "</div>" +
		"</div>" +
		"</section>";
}

function maherRenderAdminDashboard(displayName) {
	const path = window.location.pathname.split("/").pop() || "index.html";
	if (path !== "dashboard.html") return;
	if (document.getElementById("adminDashboardApp")) return;
	const main = document.querySelector("main");
	if (!main) return;

	const lang = maherCurrentLang();
	const title = lang === "en" ? "Administration Dashboard" : "لوحة الإدارة";
	const greeting = lang === "en" ? "Welcome back" : "مرحبًا بعودتك";
	const name = displayName || (lang === "en" ? "Admin" : "المشرف");
	const items = [
		{ href: "dashboard.html#seekers", textAr: "الباحثون عن العمل", textEn: "Job Seekers", descAr: "إدارة الحسابات الفردية", descEn: "Manage seeker accounts" },
		{ href: "dashboard.html#companies", textAr: "الشركات", textEn: "Companies", descAr: "مراجعة الحسابات المؤسسية", descEn: "Review company accounts" },
		{ href: "dashboard.html#jobs", textAr: "الوظائف", textEn: "Jobs", descAr: "متابعة الإعلانات المنشورة", descEn: "Track published listings" },
		{ href: "dashboard.html#applications", textAr: "الطلبات", textEn: "Applications", descAr: "مراقبة الطلبات الواردة", descEn: "Monitor incoming applications" },
		{ href: "dashboard.html#stats", textAr: "الإحصائيات", textEn: "Statistics", descAr: "مؤشرات عامة للمنصة", descEn: "Platform-wide metrics" },
		{ href: "index.html", textAr: "عرض الموقع", textEn: "View site", descAr: "الانتقال للموقع العام", descEn: "Return to public site" }
	];

	let cards = "";
	for (let i = 0; i < items.length; i += 1) {
		const item = items[i];
		cards += '<a class="role-home-card" href="' + item.href + '">' +
			'<h3>' + (lang === "en" ? item.textEn : item.textAr) + '</h3>' +
			'<p>' + (lang === "en" ? item.descEn : item.descAr) + '</p>' +
			'</a>';
	}

	main.innerHTML =
		'<section class="role-home role-home-admin">' +
		'<div class="container">' +
		'<div class="role-home-hero role-home-hero-admin">' +
		'<p class="role-home-welcome">' + greeting + ' ' + name + '</p>' +
		'<h1>' + title + '</h1>' +
		'<p>' + (lang === "en"
			? "Control the platform from one place, with focused access to users, jobs, applications, and analytics."
			: "أدر المنصة من مكان واحد مع وصول واضح إلى المستخدمين والوظائف والطلبات والإحصائيات.") + '</p>' +
		'</div>' +
		'<div class="role-home-grid role-home-grid-admin">' + cards + '</div>' +
		'</div>' +
		'</section>';
}

function maherApplyRoleExperience(role, displayName) {
	maherClearRoleExperience();
	maherApplyRoleBodyClass(role);
	maherRenderRoleHome(role, displayName);
	maherRenderAdminDashboard(displayName);
}

function maherClearRoleExperience() {
	maherApplyRoleBodyClass(null);
	const roleNav = document.getElementById("maherRoleNav");
	if (roleNav && roleNav.parentElement) {
		roleNav.parentElement.removeChild(roleNav);
	}
}

// تهيئة صفحة ملف الباحث عن عمل
function maherInitSeekerProfilePage(user) {
	const form = document.getElementById("seekerProfileForm");
	if (!form || !user) return;
	if (form.dataset.initialized === "true") return;
	form.dataset.initialized = "true";

	const fullNameInput = document.getElementById("profileFullName");
	const phoneInput = document.getElementById("profilePhone");
	const specInput = document.getElementById("profileSpecialization");
	const skillsInput = document.getElementById("profileSkills");
	const cvInput = document.getElementById("profileCv");
	const cvLinkContainer = document.getElementById("profileCvLinkContainer");
	const cvLink = document.getElementById("profileCvLink");

	let currentCvUrl = null;

	// تحميل البيانات الحالية من جدول profiles
	supabaseClient
		.from("profiles")
		.select("full_name, phone, specialization, skills, cv_url")
		.eq("id", user.id)
		.single()
		.then(function ({ data, error }) {
			if (error) {
				console.error("Error loading seeker profile", error);
				return;
			}
			if (!data) return;
			if (fullNameInput && data.full_name) fullNameInput.value = data.full_name;
			if (phoneInput && data.phone) phoneInput.value = data.phone;
			if (specInput && data.specialization) specInput.value = data.specialization;
			if (skillsInput && data.skills) skillsInput.value = data.skills;
			if (data.cv_url) {
				currentCvUrl = data.cv_url;
				if (cvLink && cvLinkContainer) {
					cvLink.href = data.cv_url;
					cvLinkContainer.style.display = "block";
				}
			}
		})
		.catch(function (e) {
			console.error("Error loading seeker profile", e);
		});

	form.addEventListener("submit", async function (e) {
		e.preventDefault();
		maherShowFormStatus(form, null, "");

		const fullName = fullNameInput ? fullNameInput.value.trim() : "";
		const phone = phoneInput ? phoneInput.value.trim() : "";
		const specialization = specInput ? specInput.value.trim() : "";
		const skills = skillsInput ? skillsInput.value.trim() : "";

		let cvUrl = currentCvUrl;
		const file = cvInput && cvInput.files && cvInput.files[0];

		if (file) {
			try {
				const filePath = "user-" + user.id + "/" + Date.now() + "-" + file.name;
				const { data: uploadData, error: uploadError } = await supabaseClient
					.storage
					.from("cvs")
					.upload(filePath, file, { upsert: true });
				if (uploadError) {
					maherShowFormStatus(form, "error", maherBuildErrorMessage(uploadError));
					return;
				}
				const publicUrlRes = supabaseClient.storage.from("cvs").getPublicUrl(uploadData.path || filePath);
				if (publicUrlRes && publicUrlRes.data && publicUrlRes.data.publicUrl) {
					cvUrl = publicUrlRes.data.publicUrl;
				}
			} catch (err) {
				console.error("CV upload error", err);
				maherShowFormStatus(form, "error", "تعذر رفع السيرة الذاتية، حاول مرة أخرى.");
				return;
			}
		}

	const { error: upsertError } = await supabaseClient
		.from("profiles")
		.upsert(
			{
				id: user.id,
				full_name: fullName || null,
				phone: phone || null,
				specialization: specialization || null,
				skills: skills || null,
				cv_url: cvUrl || null
			},
			{ onConflict: "id" }
		);

	if (upsertError) {
		maherShowFormStatus(form, "error", maherBuildErrorMessage(upsertError));
		return;
	}

	currentCvUrl = cvUrl;
	if (cvUrl && cvLink && cvLinkContainer) {
		cvLink.href = cvUrl;
		cvLinkContainer.style.display = "block";
	}
	maherShowFormStatus(form, "success", "تم حفظ الملف الشخصي بنجاح.");
	});
}

// تهيئة صفحة ملف الشركة
function maherInitCompanyProfilePage(user) {
	const form = document.getElementById("companyProfileForm");
	if (!form || !user) return;
	if (form.dataset.initialized === "true") return;
	form.dataset.initialized = "true";

	const nameInput = document.getElementById("companyName");
	const phoneInput = document.getElementById("companyPhone");
	const specInput = document.getElementById("companySpecialization");
	const skillsInput = document.getElementById("companyServices");

	supabaseClient
		.from("profiles")
		.select("full_name, phone, specialization, skills")
		.eq("id", user.id)
		.single()
		.then(function ({ data, error }) {
			if (error) {
				console.error("Error loading company profile", error);
				return;
			}
			if (!data) return;
			if (nameInput && data.full_name) nameInput.value = data.full_name;
			if (phoneInput && data.phone) phoneInput.value = data.phone;
			if (specInput && data.specialization) specInput.value = data.specialization;
			if (skillsInput && data.skills) skillsInput.value = data.skills;
		})
		.catch(function (e) {
			console.error("Error loading company profile", e);
		});

	form.addEventListener("submit", async function (e) {
		e.preventDefault();
		maherShowFormStatus(form, null, "");

		const companyName = nameInput ? nameInput.value.trim() : "";
		const phone = phoneInput ? phoneInput.value.trim() : "";
		const specialization = specInput ? specInput.value.trim() : "";
		const services = skillsInput ? skillsInput.value.trim() : "";

	const { error: upsertError } = await supabaseClient
		.from("profiles")
		.upsert(
			{
				id: user.id,
				full_name: companyName || null,
				phone: phone || null,
				specialization: specialization || null,
				skills: services || null
			},
			{ onConflict: "id" }
		);

	if (upsertError) {
		maherShowFormStatus(form, "error", maherBuildErrorMessage(upsertError));
		return;
	}

	maherShowFormStatus(form, "success", "تم حفظ بيانات الشركة بنجاح.");
	});
}

document.addEventListener("DOMContentLoaded", function () {
	if (!supabaseClient) return;

	const path = window.location.pathname.split("/").pop() || "index.html";

	// في البداية نضبط روابط الهيدر على حالة الزائر
	maherUpdateHeaderLinks(false, null);

	// حماية بسيطة: بعض الصفحات تحتاج تسجيل دخول
	if (path === "courses.html") {
		maherEnsureAuthOrRedirect("course-access.html");
	}
	if (path === "dashboard.html") {
		maherEnsureAuthOrRedirect("login.html");
	}

	// نماذج التسجيل المجمّعة
	const seekerRegisterForm = document.getElementById("registerSeekerForm");
	const employerRegisterForm = document.getElementById("registerEmployerForm");

	if (seekerRegisterForm) {
		seekerRegisterForm.addEventListener("submit", async function (e) {
			e.preventDefault();
			const fullName = document.getElementById("seekerFullName").value.trim();
			const email = document.getElementById("seekerEmail").value.trim();
			const password = document.getElementById("seekerPassword").value;
			const confirm = document.getElementById("seekerPasswordConfirm").value;
			const submitBtn = seekerRegisterForm.querySelector('button[type="submit"]');
			maherShowFormStatus(seekerRegisterForm, null, "");

			if (!fullName || !email || !password) {
				maherShowFormStatus(
					seekerRegisterForm,
					"error",
					"يرجى إدخال الاسم الكامل والبريد الإلكتروني وكلمة المرور"
				);
				return;
			}
			if (!maherIsEmailValid(email)) {
				maherShowFormStatus(seekerRegisterForm, "error", "صيغة البريد الإلكتروني غير صحيحة.");
				return;
			}
			if (!password || password.length < 6) {
				maherShowFormStatus(
					seekerRegisterForm,
					"error",
					"يجب أن تكون كلمة المرور 6 أحرف على الأقل."
				);
				return;
			}
			if (password !== confirm) {
				maherShowFormStatus(
					seekerRegisterForm,
					"error",
					"تأكيد كلمة المرور غير متطابق."
				);
				return;
			}

			maherSetButtonLoading(submitBtn, true, "register");
			try {
				const res = await maherHandleRegister(email, password, fullName, "job_seeker");
				if (res.error) {
					maherShowFormStatus(seekerRegisterForm, "error", maherBuildErrorMessage(res.error));
				} else {
					maherShowFormStatus(
						seekerRegisterForm,
						"success",
						"تم إنشاء الحساب بنجاح، يمكنك المتابعة إلى الوظائف."
					);
					maherRedirectAfterLogin("job_seeker");
				}
			} finally {
				maherSetButtonLoading(submitBtn, false, "register");
			}
		});
	}

	if (employerRegisterForm) {
		employerRegisterForm.addEventListener("submit", async function (e) {
			e.preventDefault();
			const companyName = document.getElementById("employerCompanyName").value.trim();
			const email = document.getElementById("employerEmail").value.trim();
			const password = document.getElementById("employerPassword").value;
			const confirm = document.getElementById("employerPasswordConfirm").value;
			const submitBtn = employerRegisterForm.querySelector('button[type="submit"]');
			maherShowFormStatus(employerRegisterForm, null, "");

			if (!companyName || !email || !password) {
				maherShowFormStatus(
					employerRegisterForm,
					"error",
					"يرجى إدخال اسم الشركة والبريد الإلكتروني وكلمة المرور"
				);
				return;
			}
			if (!maherIsEmailValid(email)) {
				maherShowFormStatus(employerRegisterForm, "error", "صيغة البريد الإلكتروني غير صحيحة.");
				return;
			}
			if (!password || password.length < 6) {
				maherShowFormStatus(
					employerRegisterForm,
					"error",
					"يجب أن تكون كلمة المرور 6 أحرف على الأقل."
				);
				return;
			}
			if (password !== confirm) {
				maherShowFormStatus(
					employerRegisterForm,
					"error",
					"تأكيد كلمة المرور غير متطابق."
				);
				return;
			}

			maherSetButtonLoading(submitBtn, true, "register");
			try {
				const res = await maherHandleRegister(email, password, companyName, "company");
				if (res.error) {
					maherShowFormStatus(employerRegisterForm, "error", maherBuildErrorMessage(res.error));
				} else {
					maherShowFormStatus(
						employerRegisterForm,
						"success",
						"تم إنشاء الحساب بنجاح، يمكنك المتابعة إلى لوحة التحكم."
					);
					maherRedirectAfterLogin("company");
				}
			} finally {
				maherSetButtonLoading(submitBtn, false, "register");
			}
		});
	}

	// نماذج التسجيل المنفصلة
	const seekerOnlyRegisterForm = document.getElementById("seekerOnlyRegisterForm");
	if (seekerOnlyRegisterForm) {
		seekerOnlyRegisterForm.addEventListener("submit", async function (e) {
			e.preventDefault();
			const fullName = document.getElementById("seekerFullName").value.trim();
			const email = document.getElementById("seekerEmail").value.trim();
			const password = document.getElementById("seekerPassword").value;
			const confirm = document.getElementById("seekerPasswordConfirm").value;
			const submitBtn = seekerOnlyRegisterForm.querySelector('button[type="submit"]');
			maherShowFormStatus(seekerOnlyRegisterForm, null, "");

			if (!fullName || !email || !password) {
				maherShowFormStatus(
					seekerOnlyRegisterForm,
					"error",
					"يرجى إدخال الاسم الكامل والبريد الإلكتروني وكلمة المرور"
				);
				return;
			}
			if (!maherIsEmailValid(email)) {
				maherShowFormStatus(seekerOnlyRegisterForm, "error", "صيغة البريد الإلكتروني غير صحيحة.");
				return;
			}
			if (!password || password.length < 6) {
				maherShowFormStatus(
					seekerOnlyRegisterForm,
					"error",
					"يجب أن تكون كلمة المرور 6 أحرف على الأقل."
				);
				return;
			}
			if (password !== confirm) {
				maherShowFormStatus(
					seekerOnlyRegisterForm,
					"error",
					"تأكيد كلمة المرور غير متطابق."
				);
				return;
			}

			maherSetButtonLoading(submitBtn, true, "register");
			try {
				const res = await maherHandleRegister(email, password, fullName, "job_seeker");
				if (res.error) {
					maherShowFormStatus(seekerOnlyRegisterForm, "error", maherBuildErrorMessage(res.error));
				} else {
					maherShowFormStatus(
						seekerOnlyRegisterForm,
						"success",
						"تم إنشاء الحساب بنجاح، يمكنك المتابعة إلى الوظائف."
					);
					maherRedirectAfterLogin("job_seeker");
				}
			} finally {
				maherSetButtonLoading(submitBtn, false, "register");
			}
		});
	}

	const employerOnlyRegisterForm = document.getElementById("employerOnlyRegisterForm");
	if (employerOnlyRegisterForm) {
		employerOnlyRegisterForm.addEventListener("submit", async function (e) {
			e.preventDefault();
			const companyName = document.getElementById("employerCompanyName").value.trim();
			const email = document.getElementById("employerEmail").value.trim();
			const password = document.getElementById("employerPassword").value;
			const confirm = document.getElementById("employerPasswordConfirm").value;
			const submitBtn = employerOnlyRegisterForm.querySelector('button[type="submit"]');
			maherShowFormStatus(employerOnlyRegisterForm, null, "");

			if (!companyName || !email || !password) {
				maherShowFormStatus(
					employerOnlyRegisterForm,
					"error",
					"يرجى إدخال اسم الشركة والبريد الإلكتروني وكلمة المرور"
				);
				return;
			}
			if (!maherIsEmailValid(email)) {
				maherShowFormStatus(employerOnlyRegisterForm, "error", "صيغة البريد الإلكتروني غير صحيحة.");
				return;
			}
			if (!password || password.length < 6) {
				maherShowFormStatus(
					employerOnlyRegisterForm,
					"error",
					"يجب أن تكون كلمة المرور 6 أحرف على الأقل."
				);
				return;
			}
			if (password !== confirm) {
				maherShowFormStatus(
					employerOnlyRegisterForm,
					"error",
					"تأكيد كلمة المرور غير متطابق."
				);
				return;
			}

			maherSetButtonLoading(submitBtn, true, "register");
			try {
				const res = await maherHandleRegister(email, password, companyName, "company");
				if (res.error) {
					maherShowFormStatus(employerOnlyRegisterForm, "error", maherBuildErrorMessage(res.error));
				} else {
					maherShowFormStatus(
						employerOnlyRegisterForm,
						"success",
						"تم إنشاء الحساب بنجاح، يمكنك المتابعة إلى لوحة التحكم."
					);
					maherRedirectAfterLogin("company");
				}
			} finally {
				maherSetButtonLoading(submitBtn, false, "register");
			}
		});
	}

	// نماذج تسجيل الدخول
	const seekerLoginForm = document.getElementById("seekerLoginForm") ||
		(path === "seeker-login.html" ? document.querySelector("main.auth-page form") : null);
	const employerLoginForm = document.getElementById("employerLoginForm") ||
		(path === "employer-login.html" ? document.querySelector("main.auth-page form") : null);

	if (seekerLoginForm && path === "seeker-login.html") {
		const seekerForgotBtn = seekerLoginForm.querySelector(".auth-forgot");
		if (seekerForgotBtn) {
			seekerForgotBtn.addEventListener("click", async function (event) {
				event.preventDefault();
				const typedEmail = window.prompt("أدخل بريدك الإلكتروني لاستعادة كلمة المرور") || "";
				const email = typedEmail.trim();
				if (!email) {
					window.alert("يرجى إدخال البريد الإلكتروني.");
					return;
				}
				if (!maherIsEmailValid(email)) {
					window.alert("صيغة البريد الإلكتروني غير صحيحة.");
					return;
				}

				const result = await maherHandleForgotPassword(email);
				if (result.error) {
					window.alert(maherBuildErrorMessage(result.error));
					return;
				}

				window.alert("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.");
			});
		}

		seekerLoginForm.addEventListener("submit", async function (e) {
			e.preventDefault();
			const email = document.getElementById("seekerEmail").value.trim();
			const password = document.getElementById("seekerPassword").value;
			const submitBtn = seekerLoginForm.querySelector('button[type="submit"]');
			maherShowFormStatus(seekerLoginForm, null, "");

			if (!email || !password) {
				maherShowFormStatus(
					seekerLoginForm,
					"error",
					"يرجى إدخال البريد الإلكتروني وكلمة المرور"
				);
				return;
			}
			if (!maherIsEmailValid(email)) {
				maherShowFormStatus(seekerLoginForm, "error", "صيغة البريد الإلكتروني غير صحيحة.");
				return;
			}

			maherSetButtonLoading(submitBtn, true, "login");
			try {
				const res = await maherHandleLogin(email, password);
				if (res.error) {
					maherShowFormStatus(seekerLoginForm, "error", maherBuildErrorMessage(res.error));
				} else {
					if (!res.role) {
						maherShowFormStatus(seekerLoginForm, "error", "تعذر تحديد نوع الحساب. تواصل مع الدعم.");
						return;
					}
					maherRedirectAfterLogin(res.role);
				}
			} finally {
				maherSetButtonLoading(submitBtn, false, "login");
			}
		});
	}

	if (employerLoginForm && path === "employer-login.html") {
		const employerForgotBtn = employerLoginForm.querySelector(".auth-forgot");
		if (employerForgotBtn) {
			employerForgotBtn.addEventListener("click", async function (event) {
				event.preventDefault();
				const typedEmail = window.prompt("أدخل بريدك الإلكتروني لاستعادة كلمة المرور") || "";
				const email = typedEmail.trim();
				if (!email) {
					window.alert("يرجى إدخال البريد الإلكتروني.");
					return;
				}
				if (!maherIsEmailValid(email)) {
					window.alert("صيغة البريد الإلكتروني غير صحيحة.");
					return;
				}

				const result = await maherHandleForgotPassword(email);
				if (result.error) {
					window.alert(maherBuildErrorMessage(result.error));
					return;
				}

				window.alert("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.");
			});
		}

		employerLoginForm.addEventListener("submit", async function (e) {
			e.preventDefault();
			const email = document.getElementById("employerEmail").value.trim();
			const password = document.getElementById("employerPassword").value;
			const submitBtn = employerLoginForm.querySelector('button[type="submit"]');
			maherShowFormStatus(employerLoginForm, null, "");

			if (!email || !password) {
				maherShowFormStatus(
					employerLoginForm,
					"error",
					"يرجى إدخال البريد الإلكتروني وكلمة المرور"
				);
				return;
			}
			if (!maherIsEmailValid(email)) {
				maherShowFormStatus(employerLoginForm, "error", "صيغة البريد الإلكتروني غير صحيحة.");
				return;
			}

			maherSetButtonLoading(submitBtn, true, "login");
			try {
				const res = await maherHandleLogin(email, password);
				if (res.error) {
					maherShowFormStatus(employerLoginForm, "error", maherBuildErrorMessage(res.error));
				} else {
					if (!res.role) {
						maherShowFormStatus(employerLoginForm, "error", "تعذر تحديد نوع الحساب. تواصل مع الدعم.");
						return;
					}
					maherRedirectAfterLogin(res.role);
				}
			} finally {
				maherSetButtonLoading(submitBtn, false, "login");
			}
		});
	}

	// مراقبة حالة الجلسة وتحديث الهيدر
	supabaseClient.auth.getSession().then(async function ({ data }) {
		const session = data && data.session;
		if (session && session.user) {
			const user = session.user;
			let role = await maherResolveUserRole(user);

			if (role) {
				try {
					window.localStorage.setItem("maherUserRole", role);
				} catch (e) {}
			}
			const displayName = (user && user.user_metadata && user.user_metadata.full_name) || user.email;
			if (path === "profile.html" && role === "job_seeker") {
				maherInitSeekerProfilePage(user);
			}
			if (path === "company-profile.html" && role === "company") {
				maherInitCompanyProfilePage(user);
			}
			maherRenderUserHeader(displayName, role || null);
			try {
				window.localStorage.setItem("maherIsLoggedIn", "true");
			} catch (e) {}
			maherUpdateHeaderLinks(true, role || null);
			maherShowAddJobButton(role || null);
			maherApplyRoleExperience(role || null, displayName);

			const authPages = [
				"login.html",
				"seeker-login.html",
				"employer-login.html",
				"register.html",
				"seeker-register.html",
				"employer-register.html"
			];
			if (authPages.indexOf(path) !== -1) {
				if (role) {
					maherRedirectAfterLogin(role);
				} else {
					window.location.href = "course-access.html";
				}
			}

			// لوحة التحكم متاحة فقط للسوبر أدمن
			if (path === "dashboard.html" && role !== "super_admin") {
				window.location.href = "index.html";
			}
		} else {
			// لا توجد جلسة: نعامل المستخدم كزائر
			if (path === "dashboard.html") {
				window.location.href = "login.html";
				return;
			}
			try {
				window.localStorage.setItem("maherIsLoggedIn", "false");
			} catch (e) {}
			maherUpdateHeaderLinks(false, null);
			maherClearRoleExperience();
		}
	});

	supabaseClient.auth.onAuthStateChange(async function (event, session) {
		if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
			const user = session && session.user;
			let role = await maherResolveUserRole(user);
			if (role) {
				try {
					window.localStorage.setItem("maherUserRole", role);
				} catch (e) {}
			}
			const displayName = (user && user.user_metadata && user.user_metadata.full_name) || (user && user.email) || "";
			const currentPath = window.location.pathname.split("/").pop() || "index.html";
			if (currentPath === "profile.html" && role === "job_seeker") {
				maherInitSeekerProfilePage(user);
			}
			if (currentPath === "company-profile.html" && role === "company") {
				maherInitCompanyProfilePage(user);
			}
			maherRenderUserHeader(displayName, role || null);
			try {
				window.localStorage.setItem("maherIsLoggedIn", "true");
			} catch (e) {}
			maherUpdateHeaderLinks(true, role || null);
			maherShowAddJobButton(role || null);
			maherApplyRoleExperience(role || null, displayName);

			const authPages = [
				"login.html",
				"seeker-login.html",
				"employer-login.html",
				"register.html",
				"seeker-register.html",
				"employer-register.html"
			];
			const authPath = window.location.pathname.split("/").pop() || "index.html";
			if (authPages.indexOf(authPath) !== -1) {
				if (role) {
					maherRedirectAfterLogin(role);
				} else {
					window.location.href = "course-access.html";
				}
			}
			if (authPath === "dashboard.html" && role !== "super_admin") {
				window.location.href = "index.html";
			}
		}
		if (event === "SIGNED_OUT") {
			try {
				window.localStorage.removeItem("maherUserRole");
				window.localStorage.setItem("maherIsLoggedIn", "false");
			} catch (e) {}
			maherClearUserHeader();
			maherUpdateHeaderLinks(false, null);
			maherShowAddJobButton(null);
			maherClearRoleExperience();
			// بعد تسجيل الخروج نعيد المستخدم للصفحة الرئيسية
			window.location.href = "index.html";
		}
	});
});

// معالجة نموذج نشر الوظائف
document.addEventListener("DOMContentLoaded", async function () {
	const postJobForm = document.getElementById("postJobForm");
	if (!postJobForm) return;

	postJobForm.addEventListener("submit", async function (e) {
		e.preventDefault();

		if (!supabaseClient) {
			maherShowFormStatus(postJobForm, "error", "لم تتمكن من الاتصال ببيانات المنصة");
			return;
		}

		// التحقق من أن المستخدم مسجل دخول وأنه شركة
		try {
			const { data } = await supabaseClient.auth.getSession();
			if (!data || !data.session) {
				window.location.href = "employer-login.html";
				return;
			}

			const user = data.session.user;
			let role = await maherResolveUserRole(user);

			// السماح فقط للشركات بنشر الوظائف
			if (role !== "company") {
				maherShowFormStatus(postJobForm, "error", "فقط الشركات يمكنها نشر الوظائف");
				return;
			}

			// جمع بيانات النموذج
			const jobTitle = postJobForm.querySelector("#jobTitle").value.trim();
			const jobDescription = postJobForm.querySelector("#jobDescription").value.trim();
			const jobRequirements = postJobForm.querySelector("#jobRequirements").value.trim();
			const jobSalary = postJobForm.querySelector("#jobSalary").value.trim();
			const jobLocation = postJobForm.querySelector("#jobLocation").value.trim();
			const jobType = postJobForm.querySelector("#jobType").value;
			const jobCategory = postJobForm.querySelector("#jobCategory").value;
			const jobDeadline = postJobForm.querySelector("#jobDeadline").value;

			if (!jobTitle || !jobDescription || !jobRequirements || !jobLocation || !jobType || !jobCategory) {
				maherShowFormStatus(postJobForm, "error", "يرجى ملء جميع الحقول المطلوبة");
				return;
			}

			// إظهار حالة التحميل
			const submitBtn = postJobForm.querySelector("button[type='submit']");
			const originalBtnText = submitBtn.textContent;
			submitBtn.disabled = true;
			submitBtn.textContent = "جاري نشر الوظيفة...";

			// محاولة إدراج الوظيفة في جدول jobs
			const { data: jobData, error: jobError } = await supabaseClient.from("jobs").insert([
				{
					company_id: user.id,
					title: jobTitle,
					description: jobDescription,
					requirements: jobRequirements,
					salary: jobSalary || null,
					location: jobLocation,
					job_type: jobType,
					category: jobCategory,
					application_deadline: jobDeadline || null,
					status: "active",
					created_at: new Date().toISOString()
				}
			]).select("id");

			submitBtn.disabled = false;
			submitBtn.textContent = originalBtnText;

			if (jobError) {
				console.error("Error posting job:", jobError);
				maherShowFormStatus(postJobForm, "error", "حدث خطأ عند نشر الوظيفة. جرب مرة أخرى.");
				return;
			}

			maherShowFormStatus(postJobForm, "success", "تم نشر الوظيفة بنجاح!");
			postJobForm.reset();

			// إعادة توجيه بعد ثانيتين
			setTimeout(function () {
				window.location.href = "jobs.html";
			}, 2000);
		} catch (e) {
			console.error("Error in post job form:", e);
			maherShowFormStatus(postJobForm, "error", "حدث خطأ غير متوقع. جرب مرة أخرى.");
			const submitBtn = postJobForm.querySelector("button[type='submit']");
			if (submitBtn) {
				submitBtn.disabled = false;
				submitBtn.textContent = "نشر الوظيفة";
			}
		}
	});
});

// عرض الوظائف + التقديم عليها (للباحث عن عمل فقط)
document.addEventListener("DOMContentLoaded", async function () {
	const jobsList = document.getElementById("jobsList");
	if (!jobsList) return;

	if (!supabaseClient) {
		jobsList.innerHTML = "<p>تعذر الاتصال بقاعدة البيانات.</p>";
		return;
	}

	async function maherGetUserRole(user) {
		return await maherResolveUserRole(user);
	}

	async function maherHasApplied(jobId, userId) {
		const byUserId = await supabaseClient
			.from("applications")
			.select("id")
			.eq("job_id", jobId)
			.eq("user_id", userId)
			.limit(1);

		if (!byUserId.error) {
			return Array.isArray(byUserId.data) && byUserId.data.length > 0;
		}

		const bySeekerId = await supabaseClient
			.from("applications")
			.select("id")
			.eq("job_id", jobId)
			.eq("seeker_id", userId)
			.limit(1);

		if (bySeekerId.error) return false;
		return Array.isArray(bySeekerId.data) && bySeekerId.data.length > 0;
	}

	async function maherCreateApplication(jobId, userId) {
		const payload = {
			job_id: jobId,
			user_id: userId,
			status: "pending",
			created_at: new Date().toISOString()
		};

		const insertByUserId = await supabaseClient.from("applications").insert([payload]);
		if (!insertByUserId.error) return { error: null };

		return { error: insertByUserId.error };
	}

	try {
		const { data: sessionData } = await supabaseClient.auth.getSession();
		const session = sessionData && sessionData.session;

		if (!session || !session.user) {
			window.location.href = "course-access.html";
			return;
		}

		const user = session.user;
		const role = await maherGetUserRole(user);

		if (role === "super_admin") {
			window.location.href = "dashboard.html";
			return;
		}
		if (role !== "job_seeker" && role !== "company") {
			window.location.href = "course-access.html";
			return;
		}

		const { data: jobs, error: jobsError } = await supabaseClient
			.from("jobs")
			.select("id, title, description, requirements")
			.order("created_at", { ascending: false });

		if (jobsError) {
			jobsList.innerHTML = "<p>حدث خطأ أثناء جلب الوظائف.</p>";
			return;
		}

		if (!jobs || jobs.length === 0) {
			jobsList.innerHTML = "<p>لا توجد وظائف متاحة حاليًا.</p>";
			return;
		}

		const canApply = role === "job_seeker";
		const appliedJobIds = new Set();

		if (canApply) {
			const appsByUserId = await supabaseClient
				.from("applications")
				.select("job_id")
				.eq("user_id", user.id);

			if (!appsByUserId.error && Array.isArray(appsByUserId.data)) {
				appsByUserId.data.forEach(function (app) {
					if (app && app.job_id) appliedJobIds.add(app.job_id);
				});
			} else {
				const appsBySeekerId = await supabaseClient
					.from("applications")
					.select("job_id")
					.eq("seeker_id", user.id);
				if (!appsBySeekerId.error && Array.isArray(appsBySeekerId.data)) {
					appsBySeekerId.data.forEach(function (app) {
						if (app && app.job_id) appliedJobIds.add(app.job_id);
					});
				}
			}
		}

		jobsList.innerHTML = "";

		jobs.forEach(function (job) {
			const card = document.createElement("div");
			card.className = "form-box";
			card.style.marginBottom = "1rem";

			const title = document.createElement("h3");
			title.textContent = job.title || "بدون عنوان";

			const description = document.createElement("p");
			description.textContent = job.description || "";

			const requirements = document.createElement("p");
			requirements.textContent = "المتطلبات: " + (job.requirements || "");

			const applyBtn = document.createElement("button");
			applyBtn.className = "btn btn-primary";
			applyBtn.type = "button";

			if (!canApply) {
				applyBtn.textContent = "التقديم متاح للباحثين";
				applyBtn.disabled = true;
			} else if (appliedJobIds.has(job.id)) {
				applyBtn.textContent = "تم التقديم";
				applyBtn.disabled = true;
			} else {
				applyBtn.textContent = "تقديم";
			}

			applyBtn.addEventListener("click", async function () {
				if (applyBtn.disabled) return;

				applyBtn.disabled = true;
				applyBtn.textContent = "جاري التقديم...";

				const alreadyApplied = await maherHasApplied(job.id, user.id);
				if (alreadyApplied) {
					applyBtn.textContent = "تم التقديم";
					return;
				}

				const result = await maherCreateApplication(job.id, user.id);
				if (result.error) {
					console.error("Error applying to job:", result.error);
					applyBtn.disabled = false;
					applyBtn.textContent = "تقديم";
					return;
				}

				applyBtn.textContent = "تم التقديم";
				appliedJobIds.add(job.id);
			});

			card.appendChild(title);
			card.appendChild(description);
			card.appendChild(requirements);
			card.appendChild(applyBtn);
			jobsList.appendChild(card);
		});
	} catch (e) {
		console.error("Error in jobs page:", e);
		jobsList.innerHTML = "<p>حدث خطأ غير متوقع.</p>";
	}
});

	document.addEventListener("DOMContentLoaded", async function () {
		const applicationsList = document.getElementById("myApplicationsList");
		if (!applicationsList) return;

		if (!supabaseClient) {
			applicationsList.innerHTML = "<p>تعذر الاتصال بقاعدة البيانات.</p>";
			return;
		}

		function maherFormatApplicationDate(value) {
			if (!value) return "";
			const date = new Date(value);
			if (Number.isNaN(date.getTime())) return value;
			return date.toLocaleDateString(document.documentElement.lang === "en" ? "en-US" : "ar-SA", {
				year: "numeric",
				month: "long",
				day: "numeric"
			});
		}

		function maherGetStatusLabel(status) {
			const lang = maherCurrentLang();
			if (status === "approved") {
				return {
					text: lang === "en" ? "approved" : "مقبول",
					className: "badge badge-success"
				};
			}
			if (status === "rejected") {
				return {
					text: lang === "en" ? "rejected" : "مرفوض",
					className: "badge badge-danger"
				};
			}
			return {
				text: lang === "en" ? "pending" : "قيد المراجعة",
				className: "badge badge-pending"
			};
		}

		async function maherGetUserRole(user) {
			return await maherResolveUserRole(user);
		}

		try {
			const { data: sessionData } = await supabaseClient.auth.getSession();
			const session = sessionData && sessionData.session;

			if (!session || !session.user) {
				window.location.href = "course-access.html";
				return;
			}

			const user = session.user;
			const role = await maherGetUserRole(user);

			if (role === "company") {
				window.location.href = "index.html";
				return;
			}
			if (role === "super_admin") {
				window.location.href = "dashboard.html";
				return;
			}
			if (role !== "job_seeker") {
				window.location.href = "course-access.html";
				return;
			}

			const userApps = await supabaseClient
				.from("applications")
				.select("id, job_id, user_id, status, created_at")
				.eq("user_id", user.id)
				.order("created_at", { ascending: false });

			const legacyApps = await supabaseClient
				.from("applications")
				.select("id, job_id, user_id, status, created_at")
				.eq("seeker_id", user.id)
				.order("created_at", { ascending: false });

			const applicationMap = new Map();
			[userApps, legacyApps].forEach(function (result) {
				if (!result || !Array.isArray(result.data)) return;
				result.data.forEach(function (application) {
					if (!application) return;
					const key = application.id || application.job_id;
					if (!applicationMap.has(key)) {
						applicationMap.set(key, application);
					}
				});
			});

			const applications = Array.from(applicationMap.values()).sort(function (left, right) {
				return new Date(right.created_at || 0) - new Date(left.created_at || 0);
			});

			if (applications.length === 0) {
				applicationsList.innerHTML = "<p>لم تقم بالتقديم على أي وظيفة حتى الآن.</p>";
				return;
			}

			const jobIds = [];
			applications.forEach(function (application) {
				if (application.job_id && jobIds.indexOf(application.job_id) === -1) {
					jobIds.push(application.job_id);
				}
			});

			const { data: jobs, error: jobsError } = await supabaseClient
				.from("jobs")
				.select("id, title, description, company_id")
				.in("id", jobIds);

			if (jobsError) {
				applicationsList.innerHTML = "<p>حدث خطأ أثناء جلب الوظائف.</p>";
				return;
			}

			const jobMap = new Map();
			const companyIds = [];
			(jobs || []).forEach(function (job) {
				if (!job) return;
				jobMap.set(job.id, job);
				if (job.company_id && companyIds.indexOf(job.company_id) === -1) {
					companyIds.push(job.company_id);
				}
			});

			let companyMap = new Map();
			if (companyIds.length > 0) {
				const { data: companyProfiles } = await supabaseClient
					.from("profiles")
					.select("id, full_name")
					.in("id", companyIds);
				if (Array.isArray(companyProfiles)) {
					companyProfiles.forEach(function (profile) {
						if (profile && profile.id) {
							companyMap.set(profile.id, profile.full_name || "");
						}
					});
				}
			}

			applicationsList.innerHTML = "";

			applications.forEach(function (application) {
				const job = jobMap.get(application.job_id) || {};
				const statusInfo = maherGetStatusLabel(application.status || "pending");

				const card = document.createElement("div");
				card.className = "job-card application-card";

				const title = document.createElement("h3");
				title.textContent = job.title || "وظيفة غير متاحة";

				const summary = document.createElement("p");
				summary.textContent = companyMap.get(job.company_id) || job.description || "";

				const meta = document.createElement("div");
				meta.className = "application-meta";

				const date = document.createElement("span");
				date.className = "application-date";
				date.textContent = maherFormatApplicationDate(application.created_at);

				const status = document.createElement("span");
				status.className = statusInfo.className;
				status.textContent = statusInfo.text;

				meta.appendChild(date);
				meta.appendChild(status);
				card.appendChild(title);
				card.appendChild(summary);
				card.appendChild(meta);
				applicationsList.appendChild(card);
			});
		} catch (e) {
			console.error("Error in applications page:", e);
			applicationsList.innerHTML = "<p>حدث خطأ غير متوقع.</p>";
		}
	});
