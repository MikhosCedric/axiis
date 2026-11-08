// The page the window shows when Axiis cannot reach its server. It retries by itself, so the window comes back
// without a click once the network does, and it only leaves for the site when the site answers.
const SITE = "https://axiis-lovat.vercel.app/today";
const retry = document.getElementById("retry");
const status = document.getElementById("status");
let checking = false;

async function reachable() {
  try {
    await fetch(SITE, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(4000) });
    return true;
  } catch {
    return false;
  }
}

async function check(asked) {
  if (checking) return;
  checking = true;
  if (asked) status.textContent = "Checking…";
  if (await reachable()) location.assign(SITE);
  else if (asked) status.textContent = "Still can’t connect. Axiis will keep trying.";
  checking = false;
}

retry.addEventListener("click", (event) => {
  event.preventDefault();
  void check(true);
});
window.addEventListener("online", () => void check(false));
setInterval(() => {
  if (navigator.onLine) void check(false);
}, 10000);
