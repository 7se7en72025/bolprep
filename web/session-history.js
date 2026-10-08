// Text is stored only after an explicit Save; this module never starts audio.
window.BolPrepSavedConversations = ({ apiFetch, snapshot, restore, revision, validStudySources }) => {
  const saveButton = document.querySelector("#save-conversation");
  const refreshButton = document.querySelector("#refresh-history");
  const deleteButton = document.querySelector("#clear-history");
  const status = document.querySelector("#history-status");
  const list = document.querySelector("#saved-conversations");
  let busy = false;
  let pendingSave = null;
  const object = (value) => value && typeof value === "object" && !Array.isArray(value);
  const uuid = (value) => typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
  const text = (value, limit) => typeof value === "string" && Boolean(value.trim())
    && value.length <= limit * 2 && [...value].length <= limit;
  const date = (value) => typeof value === "string" && value.length <= 64
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value)
    && Number.isFinite(Date.parse(value));
  const language = (value) => ["hi-IN", "en-IN"].includes(value);
  const summary = (value) => object(value) && uuid(value.id) && date(value.saved_at_utc)
    && text(value.title, 80) && language(value.language)
    && Number.isSafeInteger(value.message_count) && value.message_count >= 1 && value.message_count <= 20;

  function validSnapshot(value, id) {
    return object(value) && value.schema_version === 1 && value.id === id && uuid(value.id)
      && date(value.saved_at_utc) && language(value.language) && Array.isArray(value.messages)
      && value.messages.length >= 1 && value.messages.length <= 20
      && value.messages.some((message) => object(message) && message.role === "user")
      && value.messages.every((message) => object(message) && ["user", "assistant"].includes(message.role)
        && text(message.content, message.role === "user" ? 1200 : 3000)
        && validStudySources(message.sources) && message.sources.length <= 48
        && message.sources.every((source) => /^article-\d+[a-z]?$/.test(source.id || ""))
        && new Set(message.sources.map((source) => source.id)).size === message.sources.length);
  }

  function conversationChanged() {
    saveButton.disabled = busy || !snapshot().messages.some((message) => message.role === "user");
  }

  function controls() {
    conversationChanged();
    refreshButton.disabled = busy;
    deleteButton.disabled = busy;
    for (const button of list.querySelectorAll("button")) button.disabled = busy;
  }

  async function request(method, path = "/api/history", body = null) {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 20000);
    let reader;
    try {
      const response = await apiFetch(path, {
        method, signal: controller.signal,
        ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      if (!response.body) throw new Error("Saved conversation response was unavailable.");
      reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: true });
      let raw = "";
      let bytes = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 1024 * 1024) throw new Error("Saved conversation response exceeded its size limit.");
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
      if (controller.signal.aborted) throw new Error("Saved conversation request timed out.");
      let payload;
      try { payload = JSON.parse(raw); } catch { throw new Error("Saved conversation response was invalid."); }
      if (!response.ok) throw new Error(object(payload) && text(payload.error, 512)
        ? payload.error : "Saved conversation request failed.");
      return payload;
    } catch (error) {
      if (controller.signal.aborted) throw new Error(method === "GET" || path.endsWith("/load")
        ? "Loading timed out after 20 seconds. Refresh or try opening again."
        : "Request timed out after 20 seconds. Storage may already have changed; refresh or retry explicitly.");
      // Avoid exposing parser fragments that could include saved text.
      if (error instanceof TypeError) throw new Error("Could not read saved conversations. Check the local server.");
      throw error;
    } finally {
      clearTimeout(deadline);
      if (reader) { try { await reader.cancel(); } catch {} reader.releaseLock(); }
    }
  }

  async function run(action) {
    if (busy) return;
    busy = true;
    controls();
    try { await action(); }
    catch (error) { status.textContent = error.message || "Saved conversation request failed."; }
    finally { busy = false; controls(); }
  }

  async function loadList() {
    const payload = await request("GET");
    if (!object(payload) || payload.schema_version !== 1 || !Array.isArray(payload.conversations)
      || payload.conversations.length > 20 || !payload.conversations.every(summary)
      || new Set(payload.conversations.map((item) => item.id)).size !== payload.conversations.length) {
      throw new Error("Saved conversation list was invalid. Refresh or check the local server.");
    }
    list.replaceChildren();
    for (const item of payload.conversations) {
      const row = document.createElement("li");
      const title = document.createElement("span");
      title.textContent = item.title;
      const details = document.createElement("p");
      details.textContent = `${new Date(item.saved_at_utc).toLocaleString()} · ${item.message_count} messages · ${item.language === "en-IN" ? "English" : "Hindi / Hinglish"}`;
      const open = document.createElement("button");
      open.type = "button";
      open.className = "text-button";
      open.textContent = "Open";
      open.title = "Replace the current conversation with this saved text";
      open.setAttribute("aria-label", `Open saved conversation: ${item.title}`);
      open.addEventListener("click", () => {
        if (!row.isConnected) return;
        void run(async () => {
          const before = revision();
          status.textContent = "Opening saved text...";
          const saved = await request("POST", "/api/history/load", { save_id: item.id });
          if (!validSnapshot(saved, item.id)) throw new Error("Saved conversation data was invalid.");
          if (before !== revision()) throw new Error("Your conversation or draft changed while loading. Open again when ready.");
          restore(saved);
          pendingSave = null;
          status.textContent = "Saved text opened. Audio stays stopped; Listen again is available.";
        });
      });
      row.append(title, details, open);
      list.append(row);
    }
    controls();
    return payload.conversations.length;
  }

  refreshButton.addEventListener("click", () => void run(async () => {
    status.textContent = "Loading saved conversations...";
    const count = await loadList();
    status.textContent = count ? `${count} saved conversations.` : "No saved conversations yet. Ask a question, then choose Save.";
  }));
  saveButton.addEventListener("click", () => void run(async () => {
    const selected = snapshot();
    if (!selected.messages.some((message) => message.role === "user")) throw new Error("Ask a question before saving.");
    const signature = JSON.stringify(selected);
    if (!pendingSave || pendingSave.signature !== signature) {
      if (!window.crypto?.randomUUID) throw new Error("This browser cannot create a save ID. Use a current browser on localhost.");
      pendingSave = { signature, body: { ...selected, save_id: window.crypto.randomUUID(), consent_to_save: true } };
    }
    status.textContent = "Saving the selected text...";
    const result = await request("POST", "/api/history", pendingSave.body);
    if (!summary(result) || result.id !== pendingSave.body.save_id) throw new Error("Save response was invalid; refresh before retrying.");
    status.textContent = "Text saved. Refreshing the list...";
    try { await loadList(); } catch { status.textContent = "Text saved, but the list did not refresh. Choose Refresh."; return; }
    status.textContent = signature === JSON.stringify(snapshot())
      ? "Text saved. Audio was not stored."
      : "Selected text saved. Newer messages or changes were not included; choose Save again to include them.";
  }));
  deleteButton.addEventListener("click", () => {
    if (busy || !window.confirm("Delete all saved conversations for this browser? Quiz scores will remain.")) return;
    void run(async () => {
      status.textContent = "Deleting saved conversations...";
      const result = await request("DELETE");
      if (!object(result) || result.ok !== true) throw new Error("Deletion response was invalid. Refresh to inspect saved conversations.");
      pendingSave = null;
      list.replaceChildren();
      status.textContent = "Saved conversations deleted. Current text and quiz scores remain.";
    });
  });
  conversationChanged();
  refreshButton.click();
  return { conversationChanged };
};
