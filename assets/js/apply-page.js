document.addEventListener("DOMContentLoaded", async function () {
    const form = document.getElementById("jobApplyForm");
    const statusBox = document.getElementById("applyFormStatus");
    const submitBtn = document.getElementById("submitApplicationBtn");
    const summary = document.getElementById("applyJobSummary");

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
        if (type === "error") {
            statusBox.classList.add("form-status-error");
        }
        if (type === "success") {
            statusBox.classList.add("form-status-success");
        }
    }

    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        submitBtn.textContent = isLoading ? "جاري إرسال الطلب..." : "إرسال الطلب";
    }

    function getJobId() {
        const params = new URLSearchParams(window.location.search);
        return params.get("job_id") || "";
    }

    function sanitizeFileName(name) {
        return String(name || "cv").replace(/[^a-zA-Z0-9._-]+/g, "_");
    }

    function escapeText(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    async function getUserRole(user) {
        const metadataRole = user && user.user_metadata && user.user_metadata.role;
        if (metadataRole) return metadataRole;
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

    async function loadJobDetails(jobId) {
        const { data, error } = await supabaseClient
            .from("jobs")
            .select("id, title, description, company_id")
            .eq("id", jobId)
            .single();

        if (error || !data) {
            return null;
        }

        let companyName = "";
        if (data.company_id) {
            const { data: profile } = await supabaseClient
                .from("profiles")
                .select("full_name")
                .eq("id", data.company_id)
                .single();
            companyName = profile && profile.full_name ? profile.full_name : "";
        }

        return {
            id: data.id,
            title: data.title || "",
            description: data.description || "",
            companyName: companyName
        };
    }

    try {
        if (typeof supabaseClient === "undefined" || !supabaseClient) {
            summary.innerHTML = '<h1>التقديم على وظيفة</h1><p>تعذر الاتصال بقاعدة البيانات.</p>';
            form.style.display = "none";
            return;
        }

        const jobId = getJobId();
        if (!jobId) {
            summary.innerHTML = '<h1>التقديم على وظيفة</h1><p>رابط الوظيفة غير صحيح.</p>';
            form.style.display = "none";
            return;
        }

        const { data: sessionData } = await supabaseClient.auth.getSession();
        const session = sessionData && sessionData.session;
        if (!session || !session.user) {
            window.location.href = "course-access.html";
            return;
        }

        const user = session.user;
        const role = await getUserRole(user);

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

        const job = await loadJobDetails(jobId);
        if (!job) {
            summary.innerHTML = '<h1>التقديم على وظيفة</h1><p>لم يتم العثور على الوظيفة المطلوبة.</p>';
            form.style.display = "none";
            return;
        }

        summary.innerHTML =
            '<h1>' + escapeText(job.title) + '</h1>' +
            '<p>' + escapeText(job.companyName || 'شركة') + (job.description ? ' - ' + escapeText(job.description) : '') + '</p>';

        const fullNameInput = document.getElementById("fullName");
        const phoneInput = document.getElementById("phone");
        const specializationInput = document.getElementById("specialization");
        const skillsInput = document.getElementById("skills");
        const cvInput = document.getElementById("cvFile");

        if (fullNameInput && user.user_metadata && user.user_metadata.full_name) {
            fullNameInput.value = user.user_metadata.full_name;
        }

        const duplicateCheck = await supabaseClient
            .from("applications")
            .select("id, status")
            .eq("job_id", jobId)
            .eq("user_id", user.id)
            .limit(1);

        if (!duplicateCheck.error && Array.isArray(duplicateCheck.data) && duplicateCheck.data.length > 0) {
            setStatus("success", "تم التقديم على هذه الوظيفة مسبقاً.");
            setLoading(true);
            submitBtn.textContent = "تم التقديم";
            return;
        }

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            setStatus(null, "");

            const fullName = fullNameInput ? fullNameInput.value.trim() : "";
            const phone = phoneInput ? phoneInput.value.trim() : "";
            const specialization = specializationInput ? specializationInput.value.trim() : "";
            const skills = skillsInput ? skillsInput.value.trim() : "";
            const file = cvInput && cvInput.files ? cvInput.files[0] : null;

            if (!fullName || !phone || !specialization || !skills || !file) {
                setStatus("error", "يرجى تعبئة جميع الحقول وإرفاق ملف CV.");
                return;
            }

            setLoading(true);

            try {
                const beforeInsert = await supabaseClient
                    .from("applications")
                    .select("id")
                    .eq("job_id", jobId)
                    .eq("user_id", user.id)
                    .limit(1);

                if (!beforeInsert.error && Array.isArray(beforeInsert.data) && beforeInsert.data.length > 0) {
                    setStatus("error", "لقد قدّمت على هذه الوظيفة مسبقاً.");
                    setLoading(false);
                    return;
                }

                const fileName = sanitizeFileName(file.name);
                const storagePath = user.id + "/" + Date.now() + "-" + fileName;
                const uploadResult = await supabaseClient.storage
                    .from("cvs")
                    .upload(storagePath, file, {
                        contentType: file.type || "application/octet-stream",
                        upsert: false
                    });

                if (uploadResult.error) {
                    throw uploadResult.error;
                }

                const publicUrlData = supabaseClient.storage.from("cvs").getPublicUrl(storagePath);
                const cvUrl = publicUrlData && publicUrlData.data ? publicUrlData.data.publicUrl : storagePath;

                const insertResult = await supabaseClient.from("applications").insert([
                    {
                        user_id: user.id,
                        job_id: jobId,
                        full_name: fullName,
                        phone: phone,
                        specialization: specialization,
                        skills: skills,
                        cv_url: cvUrl,
                        status: "pending",
                        created_at: new Date().toISOString()
                    }
                ]);

                if (insertResult.error) {
                    throw insertResult.error;
                }

                setStatus("success", "تم إرسال طلبك بنجاح");
                setTimeout(function () {
                    window.location.href = "my-applications.html";
                }, 1400);
            } catch (error) {
                console.error("Error submitting application", error);
                let message = "حدث خطأ أثناء إرسال الطلب. حاول مرة أخرى.";
                const rawMessage = String(error && error.message ? error.message : "").toLowerCase();
                if (rawMessage.indexOf("already exists") !== -1 || rawMessage.indexOf("duplicate") !== -1) {
                    message = "لقد قدّمت على هذه الوظيفة مسبقاً.";
                }
                if (rawMessage.indexOf("storage") !== -1) {
                    message = "تعذر رفع ملف CV. تأكد من أن bucket cvs موجود ومتاح للرفع.";
                }
                setStatus("error", message);
                setLoading(false);
            }
        });
    } catch (error) {
        console.error("Error loading application page", error);
        setStatus("error", "حدث خطأ غير متوقع.");
        setLoading(false);
    }
});
