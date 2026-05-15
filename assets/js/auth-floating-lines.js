/**
 * Maher — FloatingLines-style backgrounds (viewport + reusable card surfaces).
 * Vanilla canvas, single RAF, IntersectionObserver visibility, prefers-reduced-motion.
 * Not React: same visual intent as gradient strokes + parallax (parallaxStrength up to 0.7 on viewport).
 */
(function () {
    "use strict";

    if (window.__maherFloatingLinesEngine) return;
    window.__maherFloatingLinesEngine = true;

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var GRAD_LIGHT = ["#dddbe5", "#6f6f6f", "#6a6a6a"];
    var GRAD_DARK = ["rgba(200, 215, 255, 0.14)", "rgba(79, 209, 255, 0.55)", "rgba(147, 197, 253, 0.32)"];

    var HOST_SELECTOR = [
        ".auth-card",
        ".auth-split-card",
        ".auth-split-quote",
        ".auth-split-brand",
        ".register-card",
        ".course-card",
        ".job-card-modern",
        ".feature-card",
        ".modal-box",
        ".modal-box-premium",
        ".hero-card",
        ".step-card",
        ".apply-card",
        ".home-course-card",
        ".jcat-card",
        ".lpath-card",
        ".application-card",
        ".staff-request-card",
        ".dash-card",
        ".dashboard-stat-card",
        ".req-card",
        ".role-home-card",
        ".course-access-card",
        ".prf-completion-card",
        ".prf-section-card",
        ".prf-stat-card",
        ".prf-tips-card",
        ".prf-link-card",
        ".cdash-card",
        ".app-card",
        ".prq-card"
    ].join(",");

    var surfaces = [];
    var rafOn = false;
    var tGlobal = 0;

    var mouse = { tx: 0, ty: 0, vx: 0, vy: 0 };

    function isDarkHost(el) {
        return !!el.closest(
            ".course-card, .modal-box, .modal-box-premium, .auth-split-brand, .auth-split-quote, " +
                ".job-card-modern, .dash-card, .req-card, .prq-card, .cdash-card, .application-card"
        );
    }

    function pickLineCount(w, h) {
        var a = Math.max(80, Math.sqrt(Math.max(1, w * h)));
        var n = Math.round(a / 55);
        return Math.max(5, Math.min(26, n));
    }

    function buildLines(surface) {
        var w = surface.w;
        var h = surface.h;
        var lines = [];
        var n = pickLineCount(w, h);
        var seed = 0.37 + (surface.seedOffset || 0);
        for (var i = 0; i < n; i++) {
            seed = ((seed * 9301 + 49297) % 233280) / 233280;
            var angle = -0.35 + seed * 0.7 + (i / n) * 0.15;
            var thickness = surface.preset === "dark" ? 0.65 + (seed % 1) * 1.25 : 0.5 + (seed % 1) * 1.05;
            var phase = seed * Math.PI * 2;
            var speed = 0.1 + (seed % 1) * 0.2;
            var amp = Math.max(6, Math.min(48, (Math.min(w, h) / 18) * (0.55 + (seed % 1) * 0.9)));
            var offsetY = (i / n - 0.5) * h * 1.35;
            lines.push({
                angle: angle,
                thickness: thickness,
                phase: phase,
                speed: speed,
                amp: amp,
                offsetY: offsetY,
                seed: seed
            });
        }
        surface.lines = lines;
    }

    function lineStrokeStyle(ctx, grad, x0, y0, x1, y1) {
        var g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, grad[0]);
        g.addColorStop(0.5, grad[1]);
        g.addColorStop(1, grad[2]);
        return g;
    }

    function drawLine(surface, L) {
        var ctx = surface.ctx;
        var w = surface.w;
        var h = surface.h;
        var grad = surface.preset === "dark" ? GRAD_DARK : GRAD_LIGHT;
        var par = surface.parallaxStrength;
        var bendRadius = 8;
        var bendStrength = -2;
        var animationSpeed = 1;

        var cx = w * 0.5 + mouse.vx * w * par * 0.5;
        var cy = h * 0.5 + mouse.vy * h * par * 0.5;

        var len = Math.sqrt(w * w + h * h) * 0.95;
        var cos = Math.cos(L.angle);
        var sin = Math.sin(L.angle);
        var steps = w < 200 ? 28 : 42;
        var t = surface.t;

        ctx.beginPath();
        for (var s = 0; s <= steps; s++) {
            var u = s / steps - 0.5;
            var base = u * len;

            var wx = cx + cos * base;
            var wy = cy + sin * base + L.offsetY;

            var wave =
                Math.sin(u * bendRadius + t * L.speed * animationSpeed + L.phase) * L.amp +
                Math.sin(u * 3.2 + L.phase * 2 + t * 0.4 * animationSpeed) * (L.amp * 0.22);

            var bend =
                bendStrength *
                Math.sin(u * 6 + t * 0.35 * animationSpeed + L.seed * 10) *
                (6 + Math.abs(mouse.vx + mouse.vy) * 5);

            var px = -sin * (wave + bend);
            var py = cos * (wave + bend);

            wx += px + mouse.vx * 22 * par;
            wy += py + mouse.vy * 18 * par;

            if (s === 0) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
        }

        ctx.strokeStyle = lineStrokeStyle(
            ctx,
            grad,
            cx - cos * len * 0.5,
            cy - sin * len * 0.5,
            cx + cos * len * 0.5,
            cy + sin * len * 0.5
        );
        ctx.lineWidth = L.thickness;
        ctx.lineCap = "round";

        var baseAlpha = surface.preset === "dark" ? 0.16 + (L.seed % 1) * 0.18 : 0.14 + (L.seed % 1) * 0.12;
        ctx.globalAlpha = baseAlpha;

        if (surface.preset === "dark") {
            ctx.save();
            ctx.shadowBlur = 12;
            ctx.shadowColor = "rgba(79, 209, 255, 0.28)";
            ctx.stroke();
            ctx.restore();
        } else {
            ctx.save();
            ctx.shadowBlur = 8;
            ctx.shadowColor = "rgba(111, 111, 111, 0.15)";
            ctx.stroke();
            ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    function resizeSurface(surface) {
        var canvas = surface.canvas;
        var ctx = surface.ctx;
        if (!ctx) return;

        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w, h;

        if (surface.mode === "viewport") {
            w = window.innerWidth;
            h = window.innerHeight;
        } else if (surface.host) {
            w = Math.max(1, Math.floor(surface.host.clientWidth));
            h = Math.max(1, Math.floor(surface.host.clientHeight));
        } else {
            return;
        }

        surface.dpr = dpr;
        surface.w = w;
        surface.h = h;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        buildLines(surface);
    }

    function drawSurface(surface) {
        if (!surface.visible && surface.mode !== "viewport") return;
        var ctx = surface.ctx;
        if (!ctx || surface.w < 2 || surface.h < 2) return;
        ctx.clearRect(0, 0, surface.w, surface.h);
        for (var i = 0; i < surface.lines.length; i++) {
            drawLine(surface, surface.lines[i]);
        }
    }

    function tick() {
        if (!reduceMotion) {
            mouse.vx += (mouse.tx - mouse.vx) * 0.05;
            mouse.vy += (mouse.ty - mouse.vy) * 0.05;
            tGlobal += 0.016;
        }

        for (var i = 0; i < surfaces.length; i++) {
            surfaces[i].t = tGlobal + (surfaces[i].tPhase || 0);
        }

        for (var j = 0; j < surfaces.length; j++) {
            drawSurface(surfaces[j]);
        }

        if (!reduceMotion) {
            requestAnimationFrame(tick);
        } else {
            rafOn = false;
        }
    }

    function onMove(e) {
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        if (vw <= 0 || vh <= 0) return;
        mouse.tx = (e.clientX / vw - 0.5) * 2;
        mouse.ty = (e.clientY / vh - 0.5) * 2;
    }

    function onLeave() {
        mouse.tx = 0;
        mouse.ty = 0;
    }

    function attachCard(host, seedOffset) {
        if (!host || (host.firstElementChild && host.firstElementChild.classList.contains("maher-fl-wrap"))) return;

        host.classList.add("maher-fl-host");
        var wrap = document.createElement("div");
        wrap.className = "maher-fl-wrap";
        wrap.setAttribute("aria-hidden", "true");
        var canvas = document.createElement("canvas");
        wrap.appendChild(canvas);
        host.insertBefore(wrap, host.firstChild);

        var ctx = canvas.getContext("2d");
        if (!ctx) return;

        var preset = host.getAttribute("data-fl-preset") || (isDarkHost(host) ? "dark" : "light");
        var parallaxStrength = parseFloat(host.getAttribute("data-fl-parallax") || "");
        if (isNaN(parallaxStrength)) {
            parallaxStrength = preset === "dark" ? 0.38 : 0.32;
        }

        var surface = {
            mode: "card",
            canvas: canvas,
            ctx: ctx,
            host: host,
            preset: preset,
            parallaxStrength: parallaxStrength,
            visible: true,
            t: 0,
            tPhase: seedOffset || 0,
            seedOffset: seedOffset || 0,
            lines: [],
            w: 0,
            h: 0
        };

        if (window.ResizeObserver) {
            surface.ro = new ResizeObserver(function () {
                resizeSurface(surface);
                if (reduceMotion) drawSurface(surface);
            });
            surface.ro.observe(host);
        }

        if (window.IntersectionObserver) {
            surface.io = new IntersectionObserver(
                function (entries) {
                    if (entries[0]) surface.visible = entries[0].isIntersecting;
                },
                { root: null, rootMargin: "80px", threshold: 0.01 }
            );
            surface.io.observe(host);
        }

        resizeSurface(surface);
        surfaces.push(surface);

        if (reduceMotion) drawSurface(surface);
    }

    function scanAndAttachCards() {
        var nodes = document.querySelectorAll(HOST_SELECTOR);
        var seed = 0;
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (el.closest(".maher-fl-skip")) continue;
            attachCard(el, seed * 0.01);
            seed++;
        }
    }

    function initViewportCanvas() {
        var canvas = document.getElementById("authFloatingLines");
        if (!canvas) return;

        var ctx = canvas.getContext("2d");
        if (!ctx) return;

        var surface = {
            mode: "viewport",
            canvas: canvas,
            ctx: ctx,
            host: null,
            preset: "light",
            parallaxStrength: 0.7,
            visible: true,
            t: 0,
            tPhase: 0,
            lines: [],
            w: 0,
            h: 0
        };

        resizeSurface(surface);
        surfaces.push(surface);
    }

    function boot() {
        initViewportCanvas();
        scanAndAttachCards();

        window.addEventListener("resize", function () {
            for (var ri = 0; ri < surfaces.length; ri++) {
                resizeSurface(surfaces[ri]);
            }
            if (reduceMotion) {
                for (var rj = 0; rj < surfaces.length; rj++) drawSurface(surfaces[rj]);
            }
        });

        if (!reduceMotion) {
            window.addEventListener("mousemove", onMove, { passive: true });
            window.addEventListener("mouseleave", onLeave);
            if (!rafOn && surfaces.length) {
                rafOn = true;
                requestAnimationFrame(tick);
            }
        } else {
            for (var k = 0; k < surfaces.length; k++) drawSurface(surfaces[k]);
        }

        var scanMoT;
        if (window.MutationObserver) {
            try {
                var mo = new MutationObserver(function () {
                    clearTimeout(scanMoT);
                    scanMoT = setTimeout(function () {
                        scanAndAttachCards();
                        if (!reduceMotion && !rafOn && surfaces.length) {
                            rafOn = true;
                            requestAnimationFrame(tick);
                        }
                        if (reduceMotion) {
                            for (var mi = 0; mi < surfaces.length; mi++) drawSurface(surfaces[mi]);
                        }
                    }, 300);
                });
                mo.observe(document.body, { childList: true, subtree: true });
            } catch (e2) {}
        }
    }

    window.maherFloatingLinesRefresh = function () {
        scanAndAttachCards();
        if (!reduceMotion && !rafOn && surfaces.length) {
            rafOn = true;
            requestAnimationFrame(tick);
        }
        if (reduceMotion) {
            for (var i = 0; i < surfaces.length; i++) drawSurface(surfaces[i]);
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
