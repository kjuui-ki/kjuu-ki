/**
 * سجّل اهتمامك بالدورة — مشترك بين courses.html و job-details
 */
(function (global) {
    "use strict";

    var GUEST_KEY = "maherGuestInterests";
    var modalBuilt = false;
    var pendingCourse = null;
    var interestedCache = [];

    function t(key) {
        var lang = localStorage.getItem("maherLang") || "ar";
        var dict = (global.maherTranslations || {})[lang] || (global.maherTranslations || {}).ar || {};
        return dict[key] !== undefined ? dict[key] : key;
    }

    function esc(v) {
        return String(v || "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function waitForSupabase(ms) {
        if (global.supabaseClient) return Promise.resolve(global.supabaseClient);
        return new Promise(function (resolve) {
            var done = false;
            function finish() {
                if (done) return;
                done = true;
                resolve(global.supabaseClient || null);
            }
            document.addEventListener("maherSupabaseReady", finish, { once: true });
            setTimeout(finish, ms || 4000);
        });
    }

    function readGuestInterests() {
        try {
            return JSON.parse(localStorage.getItem(GUEST_KEY) || "[]");
        } catch (e) {
            return [];
        }
    }

    function saveGuestInterest(courseId) {
        var ids = readGuestInterests();
        if (ids.indexOf(courseId) === -1) ids.push(courseId);
        localStorage.setItem(GUEST_KEY, JSON.stringify(ids));
    }

    function isInterested(courseId) {
        if (interestedCache.indexOf(courseId) !== -1) return true;
        return readGuestInterests().indexOf(courseId) !== -1;
    }

    function buildModal() {
        if (modalBuilt) return;
        modalBuilt = true;
        var html =
            '<div id="interestModal" class="modal-overlay" style="display:none;" role="dialog" aria-modal="true">' +
                '<div class="modal-box modal-box-premium interest-modal-box">' +
                    '<span class="modal-icon">📋</span>' +
                    '<h3 id="interestModalTitle" class="modal-title"></h3>' +
                    '<p id="interestModalSub" class="modal-body"></p>' +
                    '<div id="interestCourseChip" class="interest-course-chip"></div>' +
                    '<form id="interestForm" class="interest-form">' +
                        '<div class="auth-form-group interest-field" id="interestNameGroup">' +
                            '<label for="interestFullName">' + esc(t("courses.interest.name")) + "</label>" +
                            '<input type="text" id="interestFullName" class="interest-input" required autocomplete="name" />' +
                            '<span id="interestNameHint" class="interest-field-hint"></span>' +
                        "</div>" +
                        '<div class="auth-form-group interest-field">' +
                            '<label for="interestPhone">' + esc(t("courses.interest.phone")) + "</label>" +
                            '<input type="tel" id="interestPhone" class="interest-input interest-input--phone" required dir="ltr" inputmode="tel" placeholder="05XXXXXXXX" autocomplete="tel" />' +
                        "</div>" +
                        '<p id="interestFormMsg" class="interest-form-msg"></p>' +
                        '<div class="modal-actions">' +
                            '<button type="submit" id="interestSubmitBtn" class="btn btn-primary">' + esc(t("courses.interest.submit")) + "</button>" +
                            '<button type="button" id="interestCancelBtn" class="btn btn-outline">' + esc(t("courses.modal.cancel")) + "</button>" +
                        "</div>" +
                    "</form>" +
                "</div>" +
            "</div>";
        document.body.insertAdjacentHTML("beforeend", html);

        document.getElementById("interestCancelBtn").addEventListener("click", closeModal);
        document.getElementById("interestForm").addEventListener("submit", function (e) {
            e.preventDefault();
            void submitInterest();
        });
        document.getElementById("interestModal").addEventListener("click", function (e) {
            if (e.target.id === "interestModal") closeModal();
        });
    }

    function closeModal() {
        var m = document.getElementById("interestModal");
        if (m) m.style.display = "none";
        pendingCourse = null;
    }

    function setMsg(text, ok) {
        var el = document.getElementById("interestFormMsg");
        if (!el) return;
        el.textContent = text || "";
        el.style.color = ok ? "#4ade80" : "#f87171";
    }

    function markInterestButtons(courseId) {
        document.querySelectorAll('.interest-btn[data-id="' + courseId + '"]').forEach(function (btn) {
            btn.textContent = t("courses.interest.done");
            btn.classList.add("btn-interest-done");
            btn.disabled = true;
        });
    }

    async function submitInterest() {
        if (!pendingCourse) return;
        var nameEl = document.getElementById("interestFullName");
        var phoneEl = document.getElementById("interestPhone");
        var submitBtn = document.getElementById("interestSubmitBtn");
        var fullName = (nameEl.value || "").trim();
        var phone = (phoneEl.value || "").trim().replace(/\s+/g, "");

        if (!fullName) {
            setMsg(t("courses.interest.nameRequired"), false);
            return;
        }
        if (!phone || phone.length < 9) {
            setMsg(t("courses.interest.phoneRequired"), false);
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = t("courses.interest.saving");
        setMsg("", true);

        var sb = await waitForSupabase();
        if (!sb) {
            setMsg(t("courses.noDb"), false);
            submitBtn.disabled = false;
            submitBtn.textContent = t("courses.interest.submit");
            return;
        }

        var userId = null;
        try {
            var userRes = await sb.auth.getUser();
            if (userRes.data && userRes.data.user) userId = userRes.data.user.id;
        } catch (e) { /* guest */ }

        var row = {
            user_id: userId,
            full_name: fullName,
            phone: phone,
            course_id: pendingCourse.id,
            course_title: pendingCourse.title
        };

        var res = await sb.from("course_interests").insert(row);
        submitBtn.disabled = false;
        submitBtn.textContent = t("courses.interest.submit");

        if (res.error) {
            if (res.error.code === "23505") {
                setMsg(t("courses.interest.already"), false);
                interestedCache.push(pendingCourse.id);
                if (!userId) saveGuestInterest(pendingCourse.id);
                markInterestButtons(pendingCourse.id);
                setTimeout(closeModal, 1400);
                return;
            }
            setMsg(t("courses.interest.error") + ": " + (res.error.message || ""), false);
            return;
        }

        interestedCache.push(pendingCourse.id);
        if (!userId) saveGuestInterest(pendingCourse.id);
        markInterestButtons(pendingCourse.id);
        setMsg(t("courses.interest.success"), true);
        document.dispatchEvent(new CustomEvent("maherInterestRegistered", { detail: { courseId: pendingCourse.id } }));
        setTimeout(closeModal, 1600);
    }

    async function openModal(course) {
        if (!course || !course.id) return;
        if (isInterested(course.id)) return;

        buildModal();
        pendingCourse = { id: course.id, title: course.title || "" };

        var titleEl = document.getElementById("interestModalTitle");
        var subEl = document.getElementById("interestModalSub");
        var nameEl = document.getElementById("interestFullName");
        var phoneEl = document.getElementById("interestPhone");
        var nameHint = document.getElementById("interestNameHint");
        var courseChip = document.getElementById("interestCourseChip");

        if (titleEl) titleEl.textContent = t("courses.interest.modalTitle");
        if (subEl) subEl.textContent = t("courses.interest.modalSub");
        if (courseChip) courseChip.textContent = pendingCourse.title;
        setMsg("", true);

        nameEl.value = "";
        phoneEl.value = "";
        if (nameHint) nameHint.textContent = "";

        var sb = await waitForSupabase(2500);
        if (sb) {
            try {
                var userRes = await sb.auth.getUser();
                var user = userRes.data && userRes.data.user ? userRes.data.user : null;
                if (user) {
                    var prof = await sb.from("profiles").select("full_name, phone, role").eq("id", user.id).maybeSingle();
                    var p = prof.data || {};
                    if (p.full_name) {
                        nameEl.value = p.full_name;
                        if (nameHint) nameHint.textContent = t("courses.interest.fromProfile");
                    }
                    if (p.phone) phoneEl.value = p.phone;
                }
            } catch (e) { /* ignore */ }
        }

        document.getElementById("interestModal").style.display = "flex";
        if (!nameEl.value) nameEl.focus();
        else if (!phoneEl.value) phoneEl.focus();
        else nameEl.focus();
    }

    function bindClickDelegation(root) {
        if (!root || root.__interestBound) return;
        root.__interestBound = true;
        root.addEventListener("click", function (e) {
            var btn = e.target.closest(".interest-btn");
            if (!btn || btn.disabled) return;
            openModal({
                id: btn.getAttribute("data-id"),
                title: btn.getAttribute("data-title")
            });
        });
    }

    async function loadUserInterests() {
        var sb = await waitForSupabase(3000);
        if (!sb) return;
        try {
            var userRes = await sb.auth.getUser();
            var user = userRes.data && userRes.data.user ? userRes.data.user : null;
            if (!user) return;
            var res = await sb.from("course_interests").select("course_id").eq("user_id", user.id);
            interestedCache = (res.data || []).map(function (r) { return r.course_id; });
            interestedCache.forEach(markInterestButtons);
        } catch (e) { /* ignore */ }
    }

    function interestButtonHtml(courseId, courseTitle, extraClass) {
        var done = isInterested(courseId);
        var cls = "btn btn-interest btn-full interest-btn" + (extraClass ? " " + extraClass : "");
        if (done) cls += " btn-interest-done";
        return '<button type="button" class="' + cls + '" data-id="' + esc(courseId) + '" data-title="' + esc(courseTitle) + '"' +
            (done ? " disabled" : "") + ">" +
            esc(done ? t("courses.interest.done") : t("courses.interest.btn")) +
            "</button>";
    }

    global.maherCourseInterest = {
        openModal: openModal,
        isInterested: isInterested,
        bindClickDelegation: bindClickDelegation,
        loadUserInterests: loadUserInterests,
        interestButtonHtml: interestButtonHtml,
        markInterestButtons: markInterestButtons
    };

    document.addEventListener("DOMContentLoaded", function () {
        loadUserInterests();
    });
})(window);
