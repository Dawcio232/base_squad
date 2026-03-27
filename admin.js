import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const APP = window.APP_CONFIG;
const supabase = createClient(APP.supabaseUrl, APP.supabaseAnonKey);

const adminStatus = document.getElementById("adminStatus");
const logoutButton = document.getElementById("logoutButton");
const adminGrid = document.getElementById("adminGrid");
const adminLock = document.getElementById("adminLock");
const adminAuth = document.getElementById("adminAuth");
const adminEmailInput = document.getElementById("adminEmailInput");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const adminLoginButton = document.getElementById("adminLoginButton");
const adminAuthMessage = document.getElementById("adminAuthMessage");
const profilesList = document.getElementById("profilesList");
const pointsList = document.getElementById("pointsList");
const contentList = document.getElementById("contentList");
const adminMessage = document.getElementById("adminMessage");
const refreshDebugButton = document.getElementById("refreshDebugButton");
const debugWrap = document.getElementById("debugWrap");

const announcementTitle = document.getElementById("announcementTitle");
const announcementBody = document.getElementById("announcementBody");
const createAnnouncementButton = document.getElementById("createAnnouncementButton");

const challengeTitle = document.getElementById("challengeTitle");
const challengeSummary = document.getElementById("challengeSummary");
const challengeDetails = document.getElementById("challengeDetails");
const challengePoints = document.getElementById("challengePoints");
const challengeStatus = document.getElementById("challengeStatus");
const createChallengeButton = document.getElementById("createChallengeButton");

const linkTitle = document.getElementById("linkTitle");
const linkUrl = document.getElementById("linkUrl");
const linkDescription = document.getElementById("linkDescription");
const linkTag = document.getElementById("linkTag");
const linkSort = document.getElementById("linkSort");
const createLinkButton = document.getElementById("createLinkButton");

const state = {
    session: null,
    profile: null,
    profiles: [],
    announcements: [],
    challenges: [],
    debug: {
        sessionUserId: null,
        sessionEmail: null,
        profileError: null,
        profilesError: null,
        authError: null,
        authException: null,
        authEmail: null,
        authStartedAt: null,
        authFinishedAt: null,
        profileRowCount: 0,
        profilesRowCount: 0,
        announcementsError: null,
        challengesError: null,
        lastAction: "init"
    }
};

console.log("[admin.js] boot v2");

init();

async function init() {
    state.debug.lastAction = "boot";
    const { data } = await supabase.auth.getSession();
    state.session = data.session;
    await loadAdminState();
    bindEvents();
    renderGate();
}

function bindEvents() {
    logoutButton.addEventListener("click", logout);
    adminLoginButton.addEventListener("click", loginDirectly);
    refreshDebugButton.addEventListener("click", async () => {
        state.debug.lastAction = "manual diagnostics refresh";
        await loadAdminState();
        renderGate();
        showMessage("Diagnostics refreshed");
    });
    createAnnouncementButton.addEventListener("click", createAnnouncement);
    createChallengeButton.addEventListener("click", createChallenge);
    createLinkButton.addEventListener("click", createLink);

    [adminEmailInput, adminPasswordInput].forEach((field) => {
        field.addEventListener("input", () => {
            field.classList.remove("error");
            adminAuthMessage.textContent = "";
            adminAuthMessage.className = "message";
        });
        field.addEventListener("keydown", (event) => {
            if (event.key === "Enter") loginDirectly();
        });
    });

    supabase.auth.onAuthStateChange(async (_event, session) => {
        state.session = session;
        await loadAdminState();
        renderGate();
    });
}

async function loadAdminState() {
    state.profile = null;
    state.profiles = [];
    state.announcements = [];
    state.challenges = [];
    state.debug.profileError = null;
    state.debug.profilesError = null;
    state.debug.announcementsError = null;
    state.debug.challengesError = null;
    state.debug.authError = null;
    state.debug.authException = null;
    state.debug.profileRowCount = 0;
    state.debug.profilesRowCount = 0;
    state.debug.sessionUserId = state.session?.user?.id || null;
    state.debug.sessionEmail = state.session?.user?.email || null;

    if (!state.session?.user) return;

    const [profileRes, profilesRes] = await Promise.all([
        supabase.rpc("get_my_profile"),
        supabase.rpc("admin_get_profiles")
    ]);

    state.debug.profileError = profileRes.error?.message || null;
    state.debug.profilesError = profilesRes.error?.message || null;
    state.debug.profileRowCount = profileRes.data?.length || 0;
    state.debug.profilesRowCount = profilesRes.data?.length || 0;

    state.profile = profileRes.data?.[0] || null;
    state.profiles = profilesRes.data || [];

    if (state.profile?.is_admin && state.profile?.approved) {
        const [announcementsRes, challengesRes] = await Promise.all([
            supabase.from("announcements").select("*").order("created_at", { ascending: false }),
            supabase.from("challenges").select("*").order("created_at", { ascending: false })
        ]);
        state.debug.announcementsError = announcementsRes.error?.message || null;
        state.debug.challengesError = challengesRes.error?.message || null;
        state.announcements = announcementsRes.data || [];
        state.challenges = challengesRes.data || [];
    }
}

function renderGate() {
    const allowed = !!state.profile?.is_admin && !!state.profile?.approved;
    adminGrid.classList.toggle("hidden", !allowed);
    adminLock.classList.toggle("hidden", allowed);
    logoutButton.classList.toggle("hidden", !state.session?.user);
    adminAuth.classList.toggle("hidden", !!state.session?.user);

    if (!state.session?.user) {
        adminStatus.textContent = "Not Logged In";
        renderDebug();
        return;
    }

    if (!state.profile) {
        adminStatus.textContent = "Loading";
        renderDebug();
        return;
    }

    if (!allowed) {
        adminStatus.textContent = "Access Restricted";
        renderDebug();
        return;
    }

    adminStatus.textContent = `${state.profile.display_name || state.profile.email} Admin`;
    renderProfiles();
    renderPoints();
    renderContent();
    renderDebug();
}

async function loginDirectly() {
    state.debug.lastAction = "login click";
    const email = adminEmailInput.value.trim();
    const password = adminPasswordInput.value.trim();
    state.debug.authEmail = email || null;
    state.debug.authStartedAt = new Date().toISOString();
    state.debug.authFinishedAt = null;
    state.debug.authError = null;
    state.debug.authException = null;
    renderDebug();

    adminEmailInput.classList.remove("error");
    adminPasswordInput.classList.remove("error");
    adminAuthMessage.textContent = "";
    adminAuthMessage.className = "message";

    try {
        const { data, error } = await Promise.race([
            supabase.auth.signInWithPassword({ email, password }),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Auth request timeout after 12s")), 12000);
            })
        ]);

        state.debug.authFinishedAt = new Date().toISOString();

        if (error) {
            state.debug.lastAction = "login error";
            state.debug.authError = error.message;
            renderDebug();
            adminEmailInput.classList.add("error");
            adminPasswordInput.classList.add("error");
            adminAuthMessage.textContent = error.message;
            adminAuthMessage.className = "message error";
            return;
        }

        state.debug.lastAction = "login success";
        state.session = data.session;
        await loadAdminState();
        adminPasswordInput.value = "";
        adminAuthMessage.textContent = "Authentication confirmed";
        adminAuthMessage.className = "message success";
        renderGate();
    } catch (error) {
        state.debug.lastAction = "login exception";
        state.debug.authFinishedAt = new Date().toISOString();
        state.debug.authException = error instanceof Error ? error.message : String(error);
        renderDebug();
        adminAuthMessage.textContent = state.debug.authException;
        adminAuthMessage.className = "message error";
    }
}

function renderProfiles() {
    profilesList.innerHTML = state.profiles.length
        ? state.profiles.map((profile) => `
            <div class="card">
                <h4>${safe(profile.display_name || profile.email)}</h4>
                <p>${safe(profile.email)}</p>
                <div class="meta">
                    <span>${profile.approved ? "approved" : "pending"}</span>
                    <span>${profile.is_admin ? "admin" : "member"}</span>
                </div>
                <div class="actions">
                    <button class="button ${profile.approved ? "secondary" : ""}" type="button" onclick="toggleApproval('${profile.id}', ${profile.approved ? "false" : "true"})">
                        ${profile.approved ? "Revoke" : "Approve"}
                    </button>
                    <button class="button secondary" type="button" onclick="toggleAdmin('${profile.id}', ${profile.is_admin ? "false" : "true"})">
                        ${profile.is_admin ? "Remove Admin" : "Make Admin"}
                    </button>
                    <button class="button secondary" type="button" onclick="sendMagicLink('${safeAttr(profile.email)}')">Magic Link</button>
                    <button class="button secondary" type="button" onclick="sendPasswordReset('${safeAttr(profile.email)}')">Reset Password</button>
                </div>
            </div>
        `).join("")
        : '<div class="empty">No users found.</div>';
}

function renderPoints() {
    pointsList.innerHTML = state.profiles.length
        ? state.profiles.map((profile) => `
            <div class="card">
                <h4>${safe(profile.display_name || profile.email)}</h4>
                <p>Current points: ${profile.points}</p>
                <div class="actions">
                    <input id="points-${profile.id}" type="number" value="${profile.points}" style="width:140px;padding:12px 14px;border-radius:16px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:var(--fg);" />
                    <button class="button" type="button" onclick="updatePoints('${profile.id}')">Save Points</button>
                </div>
            </div>
        `).join("")
        : '<div class="empty">No users found.</div>';
}

function renderContent() {
    const announcementCards = state.announcements.map((item) => `
        <div class="card">
            <h4>${safe(item.title)}</h4>
            <p>${safe(item.body)}</p>
            <div class="meta">
                <span>announcement</span>
                <span>${formatDate(item.created_at)}</span>
            </div>
            <div class="actions">
                <button class="button secondary" type="button" onclick="deleteAnnouncement(${item.id})">Delete</button>
            </div>
        </div>
    `);

    const challengeCards = state.challenges.map((item) => `
        <div class="card">
            <h4>${safe(item.title)}</h4>
            <p>${safe(item.summary)}</p>
            <div class="meta">
                <span>challenge</span>
                <span>${item.points} pts</span>
                <span>${safe(item.status)}</span>
            </div>
            <div class="actions">
                <button class="button secondary" type="button" onclick="deleteChallenge(${item.id})">Delete</button>
            </div>
        </div>
    `);

    const cards = [...announcementCards, ...challengeCards];
    contentList.innerHTML = cards.length ? cards.join("") : '<div class="empty">No announcements or challenges found.</div>';
}

async function createAnnouncement() {
    state.debug.lastAction = "create announcement";
    const title = announcementTitle.value.trim();
    const body = announcementBody.value.trim();
    if (!title || !body) return showMessage("Title and body required", true);

    const { error } = await supabase.from("announcements").insert({
        title,
        body,
        created_by: state.session.user.id
    });

    if (error) return showMessage(error.message, true);

    announcementTitle.value = "";
    announcementBody.value = "";
    await loadAdminState();
    renderGate();
    showMessage("Announcement published");
}

async function createChallenge() {
    state.debug.lastAction = "create challenge";
    const title = challengeTitle.value.trim();
    const summary = challengeSummary.value.trim();
    const details = challengeDetails.value.trim();
    const points = Number(challengePoints.value || 0);
    const status = challengeStatus.value.trim() || "open";

    if (!title || !summary || !details) return showMessage("Challenge fields required", true);

    const { error } = await supabase.from("challenges").insert({
        title,
        summary,
        details,
        points,
        status,
        created_by: state.session.user.id
    });

    if (error) return showMessage(error.message, true);

    challengeTitle.value = "";
    challengeSummary.value = "";
    challengeDetails.value = "";
    challengePoints.value = "";
    challengeStatus.value = "open";
    await loadAdminState();
    renderGate();
    showMessage("Challenge created");
}

async function createLink() {
    state.debug.lastAction = "create link";
    const title = linkTitle.value.trim();
    const url = linkUrl.value.trim();
    const description = linkDescription.value.trim();
    const tag = linkTag.value.trim() || "link";
    const sortOrder = Number(linkSort.value || 0);

    if (!title || !url) return showMessage("Link title and URL required", true);

    const { error } = await supabase.from("links").insert({
        title,
        url,
        description,
        tag,
        sort_order: sortOrder,
        created_by: state.session.user.id
    });

    if (error) return showMessage(error.message, true);

    linkTitle.value = "";
    linkUrl.value = "";
    linkDescription.value = "";
    linkTag.value = "link";
    linkSort.value = "0";
    showMessage("Link created");
}

async function toggleApproval(id, approved) {
    state.debug.lastAction = `toggle approval ${id}`;
    const { error } = await supabase.rpc("admin_set_profile_approval", {
        target_id: id,
        new_approved: approved
    });
    if (error) return showMessage(error.message, true);
    await loadAdminState();
    renderGate();
    showMessage(approved ? "User approved" : "Approval removed");
}

async function toggleAdmin(id, isAdmin) {
    state.debug.lastAction = `toggle admin ${id}`;
    const { error } = await supabase.rpc("admin_set_profile_admin", {
        target_id: id,
        new_is_admin: isAdmin
    });
    if (error) return showMessage(error.message, true);
    await loadAdminState();
    renderGate();
    showMessage(isAdmin ? "Admin granted" : "Admin removed");
}

async function updatePoints(id) {
    state.debug.lastAction = `update points ${id}`;
    const field = document.getElementById(`points-${id}`);
    const points = Number(field.value || 0);
    const { error } = await supabase.rpc("admin_update_profile_points", {
        target_id: id,
        new_points: points
    });
    if (error) return showMessage(error.message, true);
    await loadAdminState();
    renderGate();
    showMessage("Points updated");
}

async function deleteAnnouncement(id) {
    state.debug.lastAction = `delete announcement ${id}`;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return showMessage(error.message, true);
    await loadAdminState();
    renderGate();
    showMessage("Announcement deleted");
}

async function deleteChallenge(id) {
    state.debug.lastAction = `delete challenge ${id}`;
    const { error } = await supabase.from("challenges").delete().eq("id", id);
    if (error) return showMessage(error.message, true);
    await loadAdminState();
    renderGate();
    showMessage("Challenge deleted");
}

async function sendMagicLink(email) {
    state.debug.lastAction = `send magic link ${email}`;
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: false,
            emailRedirectTo: new URL("./hub.html", window.location.href).href
        }
    });
    if (error) return showMessage(error.message, true);
    showMessage(`Magic link sent to ${email}`);
}

async function sendPasswordReset(email) {
    state.debug.lastAction = `send password reset ${email}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("./update-password.html", window.location.href).href
    });
    if (error) return showMessage(error.message, true);
    showMessage(`Password reset sent to ${email}`);
}

async function logout() {
    state.debug.lastAction = "logout";
    await supabase.auth.signOut();
    window.location.href = "./hub.html";
}

function showMessage(text, isError = false) {
    adminMessage.textContent = text;
    adminMessage.className = `message ${isError ? "error" : "success"}`;
    if (isError) console.error("[admin]", text);
    else console.log("[admin]", text);
}

function formatDate(value) {
    if (!value) return "No Date";
    return new Date(value).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function renderDebug() {
    const rows = [
        ["last action", state.debug.lastAction],
        ["session email", state.debug.sessionEmail || "none"],
        ["session user id", state.debug.sessionUserId || "none"],
        ["auth email", state.debug.authEmail || "none"],
        ["auth started", state.debug.authStartedAt || "none"],
        ["auth finished", state.debug.authFinishedAt || "none"],
        ["auth error", state.debug.authError || "none"],
        ["auth exception", state.debug.authException || "none"],
        ["profile rows", String(state.debug.profileRowCount)],
        ["profiles rows", String(state.debug.profilesRowCount)],
        ["profile error", state.debug.profileError || "none"],
        ["profiles error", state.debug.profilesError || "none"],
        ["announcements error", state.debug.announcementsError || "none"],
        ["challenges error", state.debug.challengesError || "none"],
        ["is admin", String(!!state.profile?.is_admin)],
        ["approved", String(!!state.profile?.approved)]
    ];

    debugWrap.innerHTML = rows.map(([label, value]) => `
        <div class="card">
            <h4>${safe(label)}</h4>
            <p>${safe(value)}</p>
        </div>
    `).join("");
}

function safe(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function safeAttr(value) {
    return safe(value);
}

window.toggleApproval = toggleApproval;
window.toggleAdmin = toggleAdmin;
window.updatePoints = updatePoints;
window.deleteAnnouncement = deleteAnnouncement;
window.deleteChallenge = deleteChallenge;
window.sendMagicLink = sendMagicLink;
window.sendPasswordReset = sendPasswordReset;
