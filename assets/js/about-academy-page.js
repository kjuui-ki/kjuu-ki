(function () {
    "use strict";

    var VALID = ["chairman", "vision", "mission", "values", "strategic", "admin", "training", "advisory"];
    var nav = document.getElementById("aaNav");
    var content = document.getElementById("aaContent");
    if (!nav || !content) return;

    var navItems = nav.querySelectorAll(".aa-nav-item");
    var panels = content.querySelectorAll(".aa-panel");
    var switching = false;

    function panelBySection(id) {
        return content.querySelector('.aa-panel[data-section="' + id + '"]');
    }

    function setActiveNav(id) {
        navItems.forEach(function (btn) {
            var on = btn.getAttribute("data-section") === id;
            btn.classList.toggle("is-active", on);
            btn.setAttribute("aria-current", on ? "true" : "false");
        });
    }

    function showSection(id, opts) {
        opts = opts || {};
        if (VALID.indexOf(id) === -1) id = "chairman";
        var next = panelBySection(id);
        var current = content.querySelector(".aa-panel.is-active");
        if (!next || (current === next && !opts.force)) return;

        if (switching) return;
        switching = true;
        setActiveNav(id);

        if (current && current !== next) {
            current.classList.add("is-leaving");
            current.classList.remove("is-active");
            setTimeout(function () {
                current.classList.remove("is-leaving");
                current.hidden = true;
                revealPanel(next);
                switching = false;
            }, 260);
        } else {
            panels.forEach(function (p) {
                p.classList.remove("is-active", "is-leaving");
                p.hidden = true;
            });
            revealPanel(next);
            switching = false;
        }

        if (opts.updateHash !== false) {
            var hash = "#" + id;
            if (window.location.hash !== hash) {
                history.replaceState(null, "", hash);
            }
        }
    }

    function revealPanel(panel) {
        panel.hidden = false;
        panel.classList.add("is-active");
        void panel.offsetWidth;
    }

    function sectionFromHash() {
        var h = (window.location.hash || "").replace(/^#/, "");
        return VALID.indexOf(h) !== -1 ? h : "chairman";
    }

    navItems.forEach(function (btn) {
        btn.addEventListener("click", function () {
            showSection(btn.getAttribute("data-section"));
        });
    });

    window.addEventListener("hashchange", function () {
        showSection(sectionFromHash(), { updateHash: false });
    });

    function init() {
        showSection(sectionFromHash(), { force: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
