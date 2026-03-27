import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const APP = window.APP_CONFIG;
const supabase = createClient(APP.supabaseUrl, APP.supabaseAnonKey);

const siteTitle = document.getElementById("siteTitle");
const siteSubtitle = document.getElementById("siteSubtitle");
const heroTitle = document.getElementById("heroTitle");
const heroText = document.getElementById("heroText");
const userChip = document.getElementById("userChip");
const adminButton = document.getElementById("adminButton");
const logoutButton = document.getElementById("logoutButton");
const linksList = document.getElementById("linksList");
const announcementsList = document.getElementById("announcementsList");
const challengesList = document.getElementById("challengesList");
const acceptedList = document.getElementById("acceptedList");
const scoreWrap = document.getElementById("scoreWrap");
const detailWrap = document.getElementById("detailWrap");
const displayNameInput = document.getElementById("displayNameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const authButton = document.getElementById("authButton");
const toggleAuthButton = document.getElementById("toggleAuthButton");
const authCopy = document.getElementById("authCopy");
const loginMessage = document.getElementById("loginMessage");
const detailModal = document.getElementById("detailModal");
const modalClose = document.getElementById("modalClose");
const modalTitle = document.getElementById("modalTitle");
const modalDetails = document.getElementById("modalDetails");
const modalMeta = document.getElementById("modalMeta");
const tabs = Array.from(document.querySelectorAll(".tab"));
const panels = Array.from(document.querySelectorAll(".tab-panel"));

const UI_STORE_KEY = "d_hub_selected";

const state = {
    authMode: "login",
    session: null,
    profile: null,
    links: [],
    announcements: [],
    challenges: [],
    acceptances: [],
    selectedChallengeId: Number(localStorage.getItem(UI_STORE_KEY) || 0)
};

init();

async function init() {
    siteTitle.textContent = APP.siteTitle;
    siteSubtitle.textContent = APP.siteSubtitle;
    heroTitle.textContent = APP.heroTitle;
    heroText.textContent = APP.heroText;

    bindEvents();

    const { data } = await supabase.auth.getSession();
    state.session = data.session;

    await loadAll();
    renderAll();

    setInterval(async () => {
        await refreshLiveContent();
    }, 10000);

    window.addEventListener("focus", async () => {
        await refreshLiveContent();
    });

    supabase.auth.onAuthStateChange(async (_event, session) => {
        state.session = session;
        await loadProfileAndAcceptances();
        renderAll();
    });
}

function bindEvents() {
    tabs.forEach((tab) => tab.addEventListener("click", () => setTab(tab.dataset.tab)));
    authButton.addEventListener("click", submitAuth);
    toggleAuthButton.addEventListener("click", toggleAuthMode);
    logoutButton.addEventListener("click", logout);
    modalClose.addEventListener("click", closeDetailModal);
    detailModal.addEventListener("click", (event) => {
        if (event.target === detailModal) closeDetailModal();
    });

    [displayNameInput, emailInput, passwordInput].forEach((field) => {
        field.addEventListener("input", () => {
            field.classList.remove("error");
            loginMessage.textContent = "";
            loginMessage.className = "message";
        });
        field.addEventListener("keydown", (event) => {
            if (event.key === "Enter") submitAuth();
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeDetailModal();
    });
}

async function loadAll() {
    await Promise.all([
        loadPublicData(),
        loadProfileAndAcceptances()
    ]);
}

async function refreshLiveContent() {
    await loadPublicData();
    if (state.session?.user) {
        await loadProfileAndAcceptances();
    }
    renderAll();
}

async function loadPublicData() {
    const [linksRes, announcementsRes, challengesRes] = await Promise.all([
        supabase.from("links").select("*").order("sort_order", { ascending: true }).order("id", { ascending: true }),
        supabase.from("announcements").select("*").order("created_at", { ascending: false }),
        supabase.from("challenges").select("*").order("created_at", { ascending: false })
    ]);

    state.links = linksRes.data || [];
    state.announcements = announcementsRes.data || [];
    state.challenges = challengesRes.data || [];
}

async function loadProfileAndAcceptances() {
    state.profile = null;
    state.acceptances = [];

    if (!state.session?.user) return;

    const userId = state.session.user.id;

    const [profileRes, acceptancesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("challenge_acceptances").select("*").eq("user_id", userId).order("created_at", { ascending: false })
    ]);

    state.profile = profileRes.data || null;
    state.acceptances = acceptancesRes.data || [];
}

function renderAll() {
    renderAuthMode();
    renderSession();
    renderLinks();
    renderAnnouncements();
    renderChallenges();
    renderAccepted();
    renderScore();
    renderDetail();
}

function renderAuthMode() {
    const signup = state.authMode === "signup";
    displayNameInput.style.display = signup ? "block" : "none";
    authButton.textContent = signup ? "Create Account" : "Log In";
    toggleAuthButton.textContent = signup ? "Back To Login" : "Create Account";
    authCopy.textContent = signup
        ? "Create an account. New users stay pending until an admin approves them."
        : "Log in with your email and password to access challenge controls.";
}

function renderSession() {
    if (!state.session?.user) {
        userChip.textContent = "No User Logged In";
        adminButton.classList.add("hidden");
        logoutButton.classList.add("hidden");
        return;
    }

    const label = state.profile?.display_name || state.session.user.email;
    if (!state.profile) {
        userChip.textContent = `${label} Loading`;
    } else if (!state.profile.approved) {
        userChip.textContent = `${label} Pending Approval`;
    } else {
        userChip.textContent = `${label} Logged In`;
    }

    adminButton.classList.toggle("hidden", !state.profile?.is_admin);
    logoutButton.classList.remove("hidden");
}

function renderLinks() {
    linksList.innerHTML = state.links.length
        ? state.links.map((link) => `
            <div class="card link-layout">
                <div>
                    <h4>${safe(link.title)}</h4>
                    <p>${safe(link.description || "")}</p>
                    <div class="meta">
                        <span>${safe(link.tag || "link")}</span>
                        <span>${safe(link.url)}</span>
                    </div>
                </div>
                <div class="actions">
                    <a class="button-link" href="${safeAttr(link.url)}" target="_blank" rel="noreferrer">Open</a>
                </div>
            </div>
        `).join("")
        : '<div class="empty">No links are available right now.</div>';
}

function renderAnnouncements() {
    announcementsList.innerHTML = state.announcements.length
        ? state.announcements.map((item) => `
            <div class="card">
                <h4>${safe(item.title)}</h4>
                <p>${safe(item.body)}</p>
                <div class="meta"><span>${formatDate(item.created_at)}</span></div>
            </div>
        `).join("")
        : '<div class="empty">No announcements are available right now.</div>';
}

function renderChallenges() {
    challengesList.innerHTML = state.challenges.length
        ? state.challenges.map((item) => {
            const acceptance = state.acceptances.find((entry) => entry.challenge_id === item.id);
            const approved = !!state.profile?.approved;
            const canAccept = !!state.session?.user && approved && !acceptance && item.status === "open";
            const actionLabel = !state.session?.user
                ? "Login Required"
                : !approved
                    ? "Pending Approval"
                    : acceptance
                        ? "Accepted"
                        : "Accept";

            return `
                <div class="card">
                    <h4>${safe(item.title)}</h4>
                    <p>${safe(item.summary)}</p>
                    <div class="meta">
                        <span>${safe(item.status || "open")}</span>
                        <span>${item.points} pts</span>
                    </div>
                    <div class="actions">
                        <button class="button ${canAccept ? "" : "secondary"}" type="button" onclick="acceptChallenge(${item.id})" ${canAccept ? "" : "disabled"}>
                            ${actionLabel}
                        </button>
                        <button class="button secondary" type="button" onclick="openChallengeDetail(${item.id})">Open Detail</button>
                    </div>
                </div>
            `;
        }).join("")
        : '<div class="empty">No challenges are available right now.</div>';
}

function renderAccepted() {
    if (!state.session?.user) {
        acceptedList.innerHTML = '<div class="empty">Log in to track accepted challenges.</div>';
        return;
    }

    if (!state.profile?.approved) {
        acceptedList.innerHTML = '<div class="empty">Your account is waiting for admin approval.</div>';
        return;
    }

    const items = state.acceptances
        .map((acceptance) => ({
            acceptance,
            challenge: state.challenges.find((item) => item.id === acceptance.challenge_id)
        }))
        .filter((entry) => entry.challenge);

    acceptedList.innerHTML = items.length
        ? items.map(({ acceptance, challenge }) => `
            <div class="card">
                <h4>${safe(challenge.title)}</h4>
                <p>${safe(challenge.details)}</p>
                <div class="meta">
                    <span>${challenge.points} pts</span>
                    <span>${safe(acceptance.status)}</span>
                </div>
                <div class="actions">
                    <button class="button" type="button" onclick="openChallengeDetail(${challenge.id})">Open Detail</button>
                    <button class="button secondary" type="button" onclick="markChallengeCompleted(${acceptance.id})" ${acceptance.status === "completed" ? "disabled" : ""}>
                        ${acceptance.status === "completed" ? "Completed" : "Mark Completed"}
                    </button>
                </div>
            </div>
        `).join("")
        : '<div class="empty">No accepted challenges yet. Accept one from the challenges tab.</div>';
}

function renderScore() {
    if (!state.session?.user) {
        scoreWrap.innerHTML = '<div class="score-card"><strong>0</strong><p>Log in to see your live point total.</p></div>';
        return;
    }

    const points = state.profile?.points || 0;
    const status = !state.profile
        ? "Loading profile..."
        : state.profile.approved
            ? "Your live synced score."
            : "Your account is pending admin approval.";

    scoreWrap.innerHTML = `
        <div class="score-card">
            <strong>${points}</strong>
            <p>${safe(status)}</p>
        </div>
    `;
}

function renderDetail() {
    if (!state.selectedChallengeId) {
        detailWrap.innerHTML = '<div class="empty">Pick a challenge to view full instructions here.</div>';
        return;
    }

    const item = state.challenges.find((challenge) => challenge.id === state.selectedChallengeId);
    if (!item) {
        detailWrap.innerHTML = '<div class="empty">The selected challenge is no longer available.</div>';
        return;
    }

    const acceptance = state.acceptances.find((entry) => entry.challenge_id === item.id);
    detailWrap.innerHTML = `
        <div class="card">
            <h4>${safe(item.title)}</h4>
            <p>${safe(item.details)}</p>
            <div class="meta">
                <span>${item.points} pts</span>
                <span>${safe(item.status || "open")}</span>
                <span>${acceptance ? safe(acceptance.status) : "not accepted"}</span>
            </div>
        </div>
    `;
}

async function submitAuth() {
    clearAuthErrors();

    if (state.authMode === "signup") {
        await signUp();
    } else {
        await signIn();
    }
}

async function signUp() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const displayName = displayNameInput.value.trim();

    if (!email || !password) {
        loginMessage.textContent = "Email And Password Required";
        loginMessage.className = "message error";
        if (!email) emailInput.classList.add("error");
        if (!password) passwordInput.classList.add("error");
        return;
    }

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                display_name: displayName || email.split("@")[0]
            }
        }
    });

    if (error) {
        loginMessage.textContent = error.message;
        loginMessage.className = "message error";
        emailInput.classList.add("error");
        passwordInput.classList.add("error");
        return;
    }

    loginMessage.textContent = "Account Created. Wait For Admin Approval.";
    loginMessage.className = "message success";
    passwordInput.value = "";
}

async function signIn() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        loginMessage.textContent = error.message;
        loginMessage.className = "message error";
        emailInput.classList.add("error");
        passwordInput.classList.add("error");
        return;
    }

    state.session = data.session;
    await loadProfileAndAcceptances();
    loginMessage.textContent = "Authentication Confirmed";
    loginMessage.className = "message success";
    passwordInput.value = "";
    renderAll();
}

async function logout() {
    await supabase.auth.signOut();
    state.profile = null;
    state.acceptances = [];
    renderAll();
}

async function acceptChallenge(id) {
    if (!state.session?.user || !state.profile?.approved) return;

    const { error } = await supabase.from("challenge_acceptances").insert({
        user_id: state.session.user.id,
        challenge_id: id
    });

    if (error) {
        loginMessage.textContent = error.message;
        loginMessage.className = "message error";
        return;
    }

    await loadProfileAndAcceptances();
    selectChallenge(id);
    setTab("accepted");
    renderAll();
}

async function markChallengeCompleted(acceptanceId) {
    if (!state.session?.user || !state.profile?.approved) return;

    const { error } = await supabase
        .from("challenge_acceptances")
        .update({
            status: "completed",
            completed_at: new Date().toISOString()
        })
        .eq("id", acceptanceId)
        .eq("user_id", state.session.user.id);

    if (error) {
        loginMessage.textContent = error.message;
        loginMessage.className = "message error";
        return;
    }

    await loadProfileAndAcceptances();
    renderAll();
}

function selectChallenge(id) {
    state.selectedChallengeId = id;
    localStorage.setItem(UI_STORE_KEY, String(id));
    renderDetail();
}

function openChallengeDetail(id) {
    const item = state.challenges.find((challenge) => challenge.id === id);
    if (!item) return;

    selectChallenge(id);
    const acceptance = state.acceptances.find((entry) => entry.challenge_id === item.id);
    modalTitle.textContent = item.title;
    modalDetails.textContent = item.details;
    modalMeta.innerHTML = `
        <span>${item.points} pts</span>
        <span>${safe(item.status || "open")}</span>
        <span>${acceptance ? safe(acceptance.status) : "not accepted"}</span>
    `;
    detailModal.classList.add("visible");
}

function closeDetailModal() {
    detailModal.classList.remove("visible");
}

function toggleAuthMode() {
    state.authMode = state.authMode === "login" ? "signup" : "login";
    clearAuthErrors();
    renderAuthMode();
}

function clearAuthErrors() {
    [displayNameInput, emailInput, passwordInput].forEach((field) => field.classList.remove("error"));
    loginMessage.textContent = "";
    loginMessage.className = "message";
}

function setTab(name) {
    tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
    panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === name));
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

function safeAttr(value) {
    return safe(value);
}

window.acceptChallenge = acceptChallenge;
window.markChallengeCompleted = markChallengeCompleted;
window.openChallengeDetail = openChallengeDetail;
window.setTab = setTab;
