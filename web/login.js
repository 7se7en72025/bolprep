const loginForm = document.querySelector("#login-form");
const passwordInput = document.querySelector("#login-password");
const loginButton = document.querySelector("#login-button");
const loginStatus = document.querySelector("#login-status");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loginButton.disabled) return;
  const body = JSON.stringify({ password: passwordInput.value });
  passwordInput.value = "";
  passwordInput.disabled = true;
  loginButton.disabled = true;
  loginStatus.textContent = "Signing in…";
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not sign in. Try again.");
    window.location.replace("/");
  } catch (error) {
    loginStatus.textContent = error.name === "AbortError"
      ? "Sign-in timed out. Check the local server and try again."
      : error.message || "Could not sign in. Try again.";
  } finally {
    clearTimeout(deadline);
    passwordInput.disabled = false;
    loginButton.disabled = false;
    passwordInput.focus();
  }
});
