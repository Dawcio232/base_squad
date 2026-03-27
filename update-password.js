import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const APP = window.APP_CONFIG;
const supabase = createClient(APP.supabaseUrl, APP.supabaseAnonKey);

const newPasswordInput = document.getElementById("newPasswordInput");
const confirmPasswordInput = document.getElementById("confirmPasswordInput");
const savePasswordButton = document.getElementById("savePasswordButton");
const passwordMessage = document.getElementById("passwordMessage");

savePasswordButton.addEventListener("click", updatePassword);

[newPasswordInput, confirmPasswordInput].forEach((field) => {
    field.addEventListener("input", () => {
        field.classList.remove("error");
        passwordMessage.textContent = "";
        passwordMessage.className = "message";
    });
});

async function updatePassword() {
    const password = newPasswordInput.value.trim();
    const confirm = confirmPasswordInput.value.trim();

    newPasswordInput.classList.remove("error");
    confirmPasswordInput.classList.remove("error");

    if (!password || password.length < 6) {
        newPasswordInput.classList.add("error");
        passwordMessage.textContent = "Password must be at least 6 characters";
        passwordMessage.className = "message error";
        return;
    }

    if (password !== confirm) {
        newPasswordInput.classList.add("error");
        confirmPasswordInput.classList.add("error");
        passwordMessage.textContent = "Passwords do not match";
        passwordMessage.className = "message error";
        return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
        passwordMessage.textContent = error.message;
        passwordMessage.className = "message error";
        return;
    }

    passwordMessage.textContent = "Password updated successfully";
    passwordMessage.className = "message success";
    newPasswordInput.value = "";
    confirmPasswordInput.value = "";
}
