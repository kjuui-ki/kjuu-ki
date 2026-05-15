document.addEventListener("DOMContentLoaded", async function () {
    var form = document.getElementById("jobApplyForm");
    var statusBox = document.getElementById("applyFormStatus");
    var submitBtn = document.getElementById("submitApplicationBtn");
    var summary = document.getElementById("applyJobSummary");

    if (!form || !statusBox || !submitBtn || !summary) return;

    function setStatus(type, message) {
        statusBox.classList.remove("form-status-error", "form-status-success");
        if (!message) {
            statusBox.style.display = "none";
            statusBox.textContent = "";
            return;
        }
        statusBox.textContent = message;
        statusBox.style.display = "block";
        if (type === "error") statusBox.classList.add("form-status-error");
        if (type === "success") statusBox.classList.add("form-status-success");
    }

    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        submitBtn.textContent = isLoading ? "جاري إرسال التسجيل..." : "تأكيد التسجيل";
    }

    function getCourseId() {
        var params = new URLSearchParams(window.location.search);
        return (params.get("course_id") || params.get("job_id") || "").trim();
    }

    function escapeText(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    async function getUserRole(user) {
        if (!user) return null;
        try {
            var res = await supabaseClient
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .single();
            return res.data && res.data.role ? String(res.data.role).trim().toLowerCase() : null;
        } catch (e) {
            return null;
        }
    }

    async function loadCourse(courseId) {
        var res = await supabaseClient
            .from("courses")
            .select("id, title, description, instructor, duration, category")
            .eq("id", courseId)
            .single();
        if (res.error || !res.data) return null;
        return res.data;
    }

    async function loadProfile(userId) {
        try {
            var res = await supabaseClient
                .from("profiles")
                .select("full_name, phone, specialization, skills, cv_url")
                .eq("id", userId)
                .single();
            return res.data || null;
        } catch (e) {
            return null;
        }
    }

    try {
        if (typeof supabaseClient === "undefined" || !supabaseClient) {
            summary.innerHTML = "<h1>التسجيل في دورة</h1><p>تعذر الاتصال بقاعدة البيانات.</p>";
            form.style.display = "none";
            return;
        }

        var courseId = getCourseId();
        if (!courseId) {
            summary.innerHTML = "<h1>التسجيل في دورة</h1><p>رابط الدورة غير صحيح.</p>";
            form.style.display = "none";
            return;
        }

        var userRes = await supabaseClient.auth.getUser();
        var user = userRes.data && userRes.data.user ? userRes.data.user : null;
        if (!user) {
            window.location.href = "login.html?next=" + encodeURIComponent("apply.html?course_id=" + courseId);
            return;
        }

        var role = await getUserRole(user);
        if (role !== "job_seeker") {
            window.location.href = "login.html";
            return;
        }

        var course = await loadCourse(courseId);
        if (!course) {
            summary.innerHTML = "<h1>التسجيل في دورة</h1><p>لم يتم العثور على الدورة المطلوبة.</p>";
            form.style.display = "none";
            return;
        }

        summary.innerHTML =
            "<h1>" + escapeText(course.title) + "</h1>" +
            "<p>" +
            (course.instructor ? "المدرّب: " + escapeText(course.instructor) + " — " : "") +
            (course.duration ? escapeText(course.duration) + " — " : "") +
            (course.description ? escapeText(course.description) : "") +
            "</p>";

        var fullNameInput = document.getElementById("fullName");
        var phoneInput = document.getElementById("phone");
        var specializationInput = document.getElementById("specialization");
        var skillsInput = document.getElementById("skills");
        var cvInput = document.getElementById("cvFile");

        var profileData = await loadProfile(user.id);
        var profileCvUrl = profileData && profileData.cv_url ? profileData.cv_url : "";

        if (fullNameInput) {
            fullNameInput.value =
                (profileData && profileData.full_name) ||
                (user && user.email) ||
                "";
        }
        if (phoneInput) phoneInput.value = (profileData && profileData.phone) || "";
        if (specializationInput) specializationInput.value = (profileData && profileData.specialization) || "";
        if (skillsInput) skillsInput.value = (profileData && profileData.skills) || "";

        if (cvInput) {
            cvInput.required = false;
            cvInput.disabled = true;
            cvInput.title = "السيرة الذاتية اختيارية للتسجيل؛ يمكنك رفعها من ملفك لاحقاً.";
        }

        if (profileCvUrl) {
            var cvNote = document.createElement("p");
            cvNote.className = "page-note";
            cvNote.innerHTML = "السيرة المحفوظة: <a href=\"" + escapeText(profileCvUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\">عرض</a>";
            form.insertBefore(cvNote, form.firstChild);
        }

        var dupRes = await supabaseClient
            .from("course_enrollments")
            .select("id")
            .eq("course_id", courseId)
            .eq("user_id", user.id)
            .limit(1);

        if (!dupRes.error && Array.isArray(dupRes.data) && dupRes.data.length > 0) {
            setStatus("success", "أنت مسجّل في هذه الدورة مسبقاً.");
            setLoading(true);
            submitBtn.textContent = "مسجّل";
            return;
        }

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            setStatus(null, "");

            var fullName = fullNameInput ? fullNameInput.value.trim() : "";
            var phone = phoneInput ? phoneInput.value.trim() : "";
            var specialization = specializationInput ? specializationInput.value.trim() : "";
            var skills = skillsInput ? skillsInput.value.trim() : "";

            if (!fullName || !phone) {
                setStatus("error", "يرجى إدخال الاسم الكامل ورقم الجوال.");
                return;
            }

            setLoading(true);

            try {
                var dup2 = await supabaseClient
                    .from("course_enrollments")
                    .select("id")
                    .eq("course_id", courseId)
                    .eq("user_id", user.id)
                    .limit(1);

                if (!dup2.error && Array.isArray(dup2.data) && dup2.data.length > 0) {
                    setStatus("error", "لقد سجّلت في هذه الدورة مسبقاً.");
                    setLoading(false);
                    return;
                }

                await supabaseClient
                    .from("profiles")
                    .update({
                        full_name: fullName,
                        phone: phone,
                        specialization: specialization || null,
                        skills: skills || null
                    })
                    .eq("id", user.id);

                var ins = await supabaseClient.from("course_enrollments").insert([
                    {
                        course_id: courseId,
                        user_id: user.id,
                        enrolled_by: user.id,
                        status: "enrolled"
                    }
                ]);

                if (ins.error) throw ins.error;

                setStatus("success", "تم تسجيلك في الدورة بنجاح.");
                setTimeout(function () {
                    window.location.href = "my-applications.html";
                }, 1200);
            } catch (error) {
                console.error("course enroll error", error);
                var raw = String(error && error.message ? error.message : "");
                var lower = raw.toLowerCase();
                var message = raw || "حدث خطأ غير معروف";
                if (lower.indexOf("duplicate") !== -1 || lower.indexOf("23505") !== -1) {
                    message = "لقد سجّلت في هذه الدورة مسبقاً.";
                }
                setStatus("error", message);
                setLoading(false);
            }
        });
    } catch (error) {
        console.error("apply page", error);
        setStatus("error", "حدث خطأ غير متوقع.");
        setLoading(false);
    }
});
