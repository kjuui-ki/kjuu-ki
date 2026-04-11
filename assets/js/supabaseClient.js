// supabaseClient.js — Supabase client factory ONLY.
// All auth logic lives in auth.js. Do NOT add auth/redirect code here.
(function () {
    "use strict";

    if (typeof window.supabase === "undefined") {
        console.error("Supabase SDK not loaded.");
        return;
    }

    if (!window.supabaseClient) {
        window.supabaseClient = window.supabase.createClient(
            "https://jgvfcievyfkyldryatlk.supabase.co",
            "sb_publishable_ieBSqzdn_nZJk4t-n8cNlw_ZjMwsgjY"
        );
    }

})();
