(function () {
    "use strict";

    const supabaseUrl = "https://jgvfcievyfkyldryatlk.supabase.co";
    const supabaseKey = "sb_publishable_ieBSqzdn_nZJk4t-n8cNlw_ZjMwsgjY";

    if (typeof window.supabase === "undefined") {
        console.error("Supabase SDK is not available.");
        return;
    }

    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    if (!window.supabaseClient) {
        window.supabaseClient = supabase;
    }

    async function resolveRole(user) {
        var currentUser = user;
        if (!currentUser) {
            const { data: { user: liveUser } } = await window.supabaseClient.auth.getUser();
            currentUser = liveUser || null;
        }

        if (!currentUser) return null;

        const { data: profile, error } = await window.supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .single();

        if (error || !profile) return null;
        return profile.role || null;
    }

    async function handleRegister(email, password, fullName, role) {
        const { data, error } = await window.supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName,
                    role: role
                }
            }
        });

        if (error) return { error: error };
        return { data: data };
    }

    async function handleLogin(email, password) {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) return { error: error };

        var user = data && data.user ? data.user : null;
        var role = user ? await resolveRole(user) : null;

        return {
            error: null,
            data: data,
            role: role
        };
    }

    async function handleForgotPassword(email) {
        const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email);

        if (error) return { error: error };
        return { error: null };
    }

    window.maherResolveUserRole = resolveRole;
    window.maherHandleRegister = handleRegister;
    window.maherHandleLogin = handleLogin;
    window.maherHandleForgotPassword = handleForgotPassword;
})();
