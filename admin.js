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
    challenges: []
};

init();

async function init() {
    const { data } = await supabase.auth.getSession();
    state.session = data.session;
    await loadAdminState();
    bindEvents();
    renderGate();
}

function bindEvents() {
    logoutButton.addEventListener("click", logout);
    adminLoginButton.addEventListener("click", loginDirectly);
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

    if (!state.session?.user) return;

    const userId = state.session.user.id;

    const [profileRes, profilesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("profiles").select("*").order("created_at", { ascending: false })
    ]);

    state.profile = profileRes.data || null;
    state.profiles = profilesRes.data || [];

    if (state.profile?.is_admin && state.profile?.approved) {
        const [announcementsRes, challengesRes] = await Promise.all([
            supabase.from("announcements").select("*").order("created_at", { ascending: false }),
            supabase.from("challenges").select("*").order("created_at", { ascending: false })
        ]);
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
        return;
    }

    if (!state.profile) {
        adminStatus.textContent = "Loading";
        return;
    }

    if (!allowed) {
        adminStatus.textContent = "Access Restricted";
        return;
    }

    adminStatus.textContent = `${state.profile.display_name || state.profile.email} Admin`;
    renderProfiles();
    renderPoints();
    renderContent();
}

async function loginDirectly() {
    const email = adminEmailInput.value.trim();
    const password = adminPasswordInput.value.trim();

    adminEmailInput.classList.remove("error");
    adminPasswordInput.classList.remove("error");
    adminAuthMessage.textContent = "";
    adminAuthMessage.className = "message";

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        adminEmailInput.classList.add("error");
        adminPasswordInput.classList.add("error");
        adminAuthMessage.textContent = error.message;
        adminAuthMessage.className = "message error";
        return;
    }

    adminPasswordInput.value = "";
    adminAuthMessage.textContent = "Authentication confirmed";
    adminAuthMessage.className = "message success";
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
    const { error } = await supabase.from("profiles").update({ approved }).eq("id", id);
    if (error) return showMessage(error.message, true);
    await loadAdminState();
    renderGate();
    showMessage(approved ? "User approved" : "Approval removed");
}

async function toggleAdmin(id, isAdmin) {
    const { error } = await supabase.from("profiles").update({ is_admin: isAdmin }).eq("id", id);
    if (error) return showMessage(error.message, true);
    await loadAdminState();
    renderGate();
    showMessage(isAdmin ? "Admin granted" : "Admin removed");
}

async function updatePoints(id) {
    const field = document.getElementById(`points-${id}`);
    const points = Number(field.value || 0);
    const { error } = await supabase.from("profiles").update({ points }).eq("id", id);
    if (error) return showMessage(error.message, true);
    await loadAdminState();
    renderGate();
    showMessage("Points updated");
}

async function deleteAnnouncement(id) {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return showMessage(error.message, true);
    await loadAdminState();
    renderGate();
    showMessage("Announcement deleted");
}

async function deleteChallenge(id) {
    const { error } = await supabase.from("challenges").delete().eq("id", id);
    if (error) return showMessage(error.message, true);
    await loadAdminState();
    renderGate();
    showMessage("Challenge deleted");
}

async function sendMagicLink(email) {
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("./update-password.html", window.location.href).href
    });
    if (error) return showMessage(error.message, true);
    showMessage(`Password reset sent to ${email}`);
}

async function logout() {
    await supabase.auth.signOut();
    window.location.href = "./hub.html";
}

function showMessage(text, isError = false) {
    adminMessage.textContent = text;
    adminMessage.className = `message ${isError ? "error" : "success"}`;
}

function formatDate(value) {
    if (!value) return "No Date";
    return new Date(value).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function safe(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

window.toggleApproval = toggleApproval;
window.toggleAdmin = toggleAdmin;
window.updatePoints = updatePoints;
window.deleteAnnouncement = deleteAnnouncement;
window.deleteChallenge = deleteChallenge;
window.sendMagicLink = sendMagicLink;
window.sendPasswordReset = sendPasswordReset;
