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

async function maherEnsureAuthOrRedirect(redirectPath) {
	if (!supabaseClient) return;
	try {
		const { data } = await supabaseClient.auth.getSession();
		if (!data || !data.session) {
			const target = redirectPath || "login.html";
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
		window.location.href = "jobs.html";
	} else if (role === "company") {
		window.location.href = "dashboard.html";
	} else {
		window.location.href = "index.html";
	}
}

async function maherHandleRegister(email, password, role) {
	if (!supabaseClient) return { error: new Error("Supabase not initialized") };

	const { data, error } = await supabaseClient.auth.signUp({
		email,
		password,
		options: {
			data: {
				role
			}
		}
	});

	if (error) {
		return { error };
	}

	const user = data.user;
	if (user) {
		const { error: insertError } = await supabaseClient.from("profiles").insert({
			id: user.id,
			email: user.email,
			role: role
		});
		if (insertError) {
			console.error("Error inserting profile", insertError);
		}
	}

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

	const user = data.user;
	let role = user && user.user_metadata && user.user_metadata.role;

	if (!role && user) {
		const { data: profile, error: profileError } = await supabaseClient
			.from("profiles")
			.select("role")
			.eq("id", user.id)
			.single();

		if (!profileError && profile) {
			role = profile.role;
		}
	}

	if (role) {
		try {
			window.localStorage.setItem("maherUserRole", role);
		} catch (e) {}
	}

	return { data, role };
}

function maherRenderLogoutButton() {
	if (!supabaseClient) return;
	if (document.getElementById("maherLogoutBtn")) return;

	const headerInner = document.querySelector(".main-header .header-inner");
	if (!headerInner) return;

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

	headerInner.appendChild(btn);
}

document.addEventListener("DOMContentLoaded", function () {
	if (!supabaseClient) return;

	const path = window.location.pathname.split("/").pop() || "index.html";

	// حماية صفحات الدورات
	if (path === "course-access.html" || path === "courses.html") {
		maherEnsureAuthOrRedirect("login.html");
	}

	// نماذج التسجيل المجمّعة
	const seekerRegisterForm = document.getElementById("registerSeekerForm");
	const employerRegisterForm = document.getElementById("registerEmployerForm");

	if (seekerRegisterForm) {
		seekerRegisterForm.addEventListener("submit", function (e) {
			e.preventDefault();
			const email = document.getElementById("seekerEmail").value.trim();
			const password = document.getElementById("seekerPassword").value;
			const confirm = document.getElementById("seekerPasswordConfirm").value;

			if (!email || !password) {
				alert("يرجى إدخال البريد الإلكتروني وكلمة المرور");
				return;
			}
			if (password !== confirm) {
				alert("تأكيد كلمة المرور غير متطابق");
				return;
			}

			maherHandleRegister(email, password, "job_seeker").then(function (res) {
				if (res.error) {
					alert("حدث خطأ أثناء إنشاء الحساب: " + res.error.message);
				} else {
					alert("تم إنشاء الحساب بنجاح، يرجى التحقق من بريدك الإلكتروني إن لزم.");
					maherRedirectAfterLogin("job_seeker");
				}
			});
		});
	}

	if (employerRegisterForm) {
		employerRegisterForm.addEventListener("submit", function (e) {
			e.preventDefault();
			const email = document.getElementById("employerEmail").value.trim();
			const password = document.getElementById("employerPassword").value;
			const confirm = document.getElementById("employerPasswordConfirm").value;

			if (!email || !password) {
				alert("يرجى إدخال البريد الإلكتروني وكلمة المرور");
				return;
			}
			if (password !== confirm) {
				alert("تأكيد كلمة المرور غير متطابق");
				return;
			}

			maherHandleRegister(email, password, "company").then(function (res) {
				if (res.error) {
					alert("حدث خطأ أثناء إنشاء الحساب: " + res.error.message);
				} else {
					alert("تم إنشاء الحساب بنجاح، يرجى التحقق من بريدك الإلكتروني إن لزم.");
					maherRedirectAfterLogin("company");
				}
			});
		});
	}

	// نماذج التسجيل المنفصلة
	const seekerOnlyRegisterForm = document.getElementById("seekerOnlyRegisterForm");
	if (seekerOnlyRegisterForm) {
		seekerOnlyRegisterForm.addEventListener("submit", function (e) {
			e.preventDefault();
			const email = document.getElementById("seekerEmail").value.trim();
			const password = document.getElementById("seekerPassword").value;
			const confirm = document.getElementById("seekerPasswordConfirm").value;

			if (!email || !password) {
				alert("يرجى إدخال البريد الإلكتروني وكلمة المرور");
				return;
			}
			if (password !== confirm) {
				alert("تأكيد كلمة المرور غير متطابق");
				return;
			}

			maherHandleRegister(email, password, "job_seeker").then(function (res) {
				if (res.error) {
					alert("حدث خطأ أثناء إنشاء الحساب: " + res.error.message);
				} else {
					alert("تم إنشاء الحساب بنجاح، يرجى التحقق من بريدك الإلكتروني إن لزم.");
					maherRedirectAfterLogin("job_seeker");
				}
			});
		});
	}

	const employerOnlyRegisterForm = document.getElementById("employerOnlyRegisterForm");
	if (employerOnlyRegisterForm) {
		employerOnlyRegisterForm.addEventListener("submit", function (e) {
			e.preventDefault();
			const email = document.getElementById("employerEmail").value.trim();
			const password = document.getElementById("employerPassword").value;
			const confirm = document.getElementById("employerPasswordConfirm").value;

			if (!email || !password) {
				alert("يرجى إدخال البريد الإلكتروني وكلمة المرور");
				return;
			}
			if (password !== confirm) {
				alert("تأكيد كلمة المرور غير متطابق");
				return;
			}

			maherHandleRegister(email, password, "company").then(function (res) {
				if (res.error) {
					alert("حدث خطأ أثناء إنشاء الحساب: " + res.error.message);
				} else {
					alert("تم إنشاء الحساب بنجاح، يرجى التحقق من بريدك الإلكتروني إن لزم.");
					maherRedirectAfterLogin("company");
				}
			});
		});
	}

	// نماذج تسجيل الدخول
	const seekerLoginForm = document.getElementById("seekerLoginForm") ||
		(path === "seeker-login.html" ? document.querySelector("main.auth-page form") : null);
	const employerLoginForm = document.getElementById("employerLoginForm") ||
		(path === "employer-login.html" ? document.querySelector("main.auth-page form") : null);

	if (seekerLoginForm && path === "seeker-login.html") {
		seekerLoginForm.addEventListener("submit", function (e) {
			e.preventDefault();
			const email = document.getElementById("seekerEmail").value.trim();
			const password = document.getElementById("seekerPassword").value;

			if (!email || !password) {
				alert("يرجى إدخال البريد الإلكتروني وكلمة المرور");
				return;
			}

			maherHandleLogin(email, password).then(function (res) {
				if (res.error) {
					alert("تعذر تسجيل الدخول: " + res.error.message);
				} else {
					maherRedirectAfterLogin(res.role || "job_seeker");
				}
			});
		});
	}

	if (employerLoginForm && path === "employer-login.html") {
		employerLoginForm.addEventListener("submit", function (e) {
			e.preventDefault();
			const email = document.getElementById("employerEmail").value.trim();
			const password = document.getElementById("employerPassword").value;

			if (!email || !password) {
				alert("يرجى إدخال البريد الإلكتروني وكلمة المرور");
				return;
			}

			maherHandleLogin(email, password).then(function (res) {
				if (res.error) {
					alert("تعذر تسجيل الدخول: " + res.error.message);
				} else {
					maherRedirectAfterLogin(res.role || "company");
				}
			});
		});
	}

	// مراقبة حالة الجلسة وإظهار زر تسجيل الخروج
	supabaseClient.auth.getSession().then(function ({ data }) {
		if (data && data.session) {
			const user = data.session.user;
			const role = (user && user.user_metadata && user.user_metadata.role) ||
				(function () {
					try {
						return window.localStorage.getItem("maherUserRole");
					} catch (e) {
						return null;
					}
				})();
			if (role) {
				try {
					window.localStorage.setItem("maherUserRole", role);
				} catch (e) {}
			}
			maherRenderLogoutButton();
		}
	});

	supabaseClient.auth.onAuthStateChange(function (event, session) {
		if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
			const user = session && session.user;
			const role = user && user.user_metadata && user.user_metadata.role;
			if (role) {
				try {
					window.localStorage.setItem("maherUserRole", role);
				} catch (e) {}
			}
			maherRenderLogoutButton();
		}
		if (event === "SIGNED_OUT") {
			try {
				window.localStorage.removeItem("maherUserRole");
			} catch (e) {}

			// بعد تسجيل الخروج نعيد المستخدم للصفحة الرئيسية
			window.location.href = "index.html";
		}
	});
});
