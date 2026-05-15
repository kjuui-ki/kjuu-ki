// supabaseClient.js — Supabase client factory ONLY.
// All auth logic lives in auth.js. Do NOT add auth/redirect code here.
(function () {
    "use strict";

    var attempts = 0;

    function init() {
        attempts++;
        if (typeof window.supabase === "undefined") {
            if (attempts < 80) {
                setTimeout(init, 50);
            } else {
                console.error("Supabase SDK not loaded.");
            }
            return;
        }

        if (!window.supabaseClient) {
            window.supabaseClient = window.supabase.createClient(
                "https://jgvfcievyfkyldryatlk.supabase.co",
                "sb_publishable_ieBSqzdn_nZJk4t-n8cNlw_ZjMwsgjY"
            );
        }

        try {
            document.dispatchEvent(new CustomEvent("maherSupabaseReady"));
        } catch (e) { /* ignore */ }
    }

    init();
})();
