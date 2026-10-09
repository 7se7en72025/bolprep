// Server-owned request metadata is read only when the learner chooses Refresh.
window.BolPrepRequestTraces = ({ apiFetch }) => {
  const refreshButton = document.querySelector("#refresh-request-traces");
  const clearButton = document.querySelector("#clear-request-traces");
  const status = document.querySelector("#saved-traces-status");
  const rows = document.querySelector("#saved-traces-rows");
  let busy = false;

  const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const count = (value) => Number.isSafeInteger(value) && value >= 0;
  const modelId = (value) => value === null || typeof value === "string"
    && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value);
  function validTrace(trace) {
    if (!object(trace)
      || typeof trace.request_id !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trace.request_id)
      || typeof trace.started_at_utc !== "string"
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(trace.started_at_utc)
      || !Number.isFinite(Date.parse(trace.started_at_utc))
      || !["completed", "failed", "disconnected"].includes(trace.outcome)
      || !["offline", "model"].includes(trace.mode)
      || !modelId(trace.configured_model)
      || typeof trace.server_duration_ms !== "number" || !Number.isFinite(trace.server_duration_ms)
      || trace.server_duration_ms < 0 || trace.server_duration_ms > 86400000
      || !count(trace.source_count) || trace.source_count > 100
      || ![null, "agent-error", "http-write-failed"].includes(trace.failure_reason)
      || (trace.outcome === "completed" && trace.failure_reason !== null)
      || (trace.outcome === "failed" && trace.failure_reason !== "agent-error")
      || (trace.outcome === "disconnected" && trace.failure_reason !== "http-write-failed")
      || !Array.isArray(trace.tool_outcomes) || trace.tool_outcomes.length > 6
      || !trace.tool_outcomes.every((tool) => object(tool)
        && ["start_quiz", "score_answer", "save_progress", "get_weak_topics"].includes(tool.name)
        && typeof tool.ok === "boolean")
      || !(trace.model_response_count === null || count(trace.model_response_count))
      || !(trace.usage_response_count === null || count(trace.usage_response_count))
      || (trace.model_response_count !== null && trace.usage_response_count !== null
        && trace.usage_response_count > trace.model_response_count)) return false;
    if (trace.provider_reported_models !== null
      && (!Array.isArray(trace.provider_reported_models) || trace.provider_reported_models.length > 4
        || trace.provider_reported_models.length !== trace.model_response_count
        || (trace.mode === "offline" && trace.provider_reported_models.length !== 0)
        || !trace.provider_reported_models.every(modelId))) return false;
    if (trace.usage === null) return true;
    return object(trace.usage)
      && ["input_tokens", "output_tokens", "total_tokens", "response_count"]
        .every((field) => count(trace.usage[field]))
      && trace.usage.response_count > 0
      && trace.usage.response_count === trace.model_response_count
      && trace.usage.response_count === trace.usage_response_count;
  }

  function setBusy(value) {
    busy = value;
    refreshButton.disabled = value;
    clearButton.disabled = value;
  }

  async function request(method, path) {
    const controller = new AbortController();
    const deadline = window.setTimeout(() => controller.abort(), 20000);
    let reader;
    try {
      const response = await apiFetch(path, {
        method, signal: controller.signal,
        ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: "{}" } : {}),
      });
      if (!response.body) throw new Error();
      reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: true });
      let raw = "";
      let bytes = 0;
      while (true) {
        if (controller.signal.aborted) throw new Error();
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 1024 * 1024) throw new Error();
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
      if (controller.signal.aborted || !response.ok) throw new Error();
      return JSON.parse(raw);
    } catch {
      throw new Error(controller.signal.aborted
        ? "Saved diagnostics request timed out. Refresh to check its result."
        : "Saved diagnostics could not be read or changed. Check the local server and try again.");
    } finally {
      window.clearTimeout(deadline);
      if (reader) {
        void reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    }
  }

  function render(traces) {
    rows.replaceChildren();
    for (const trace of traces) {
      const row = document.createElement("tr");
      const reportedModels = trace.provider_reported_models === null
        ? "unavailable" : trace.provider_reported_models.length
          ? trace.provider_reported_models.map((model) => model || "unavailable").join(", ") : "none (offline)";
      const tools = trace.tool_outcomes.length
        ? trace.tool_outcomes.map((tool) => `${tool.name}: ${tool.ok ? "succeeded" : "failed"}`).join(", ")
        : "none reported";
      const tokens = trace.usage
        ? `${trace.usage.input_tokens} input, ${trace.usage.output_tokens} output, ${trace.usage.total_tokens} total`
        : "tokens unavailable";
      const cells = [
        `${trace.started_at_utc} | ${trace.request_id}`,
        `${trace.outcome} / ${trace.mode}${trace.failure_reason ? ` (${trace.failure_reason})` : ""}`,
        `Requested ${trace.configured_model || "unavailable"}; reported ${reportedModels}`,
        `${(trace.server_duration_ms / 1000).toFixed(2)}s; ${trace.source_count} sources`,
        `${tools}; ${tokens}`,
      ];
      cells.forEach((value, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        if (index === 0) cell.scope = "row";
        cell.textContent = value;
        row.append(cell);
      });
      rows.append(row);
    }
  }

  refreshButton.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    status.textContent = "Loading saved diagnostics…";
    try {
      const result = await request("GET", "/api/traces");
      if (!object(result) || !Array.isArray(result.traces) || result.traces.length > 100
        || !result.traces.every(validTrace)
        || new Set(result.traces.map((trace) => trace.request_id)).size !== result.traces.length) {
        throw new Error("Saved diagnostics response was invalid. Refresh or check the local server.");
      }
      render(result.traces);
      status.textContent = result.traces.length
        ? `${result.traces.length} saved request diagnostics for this browser.`
        : "No saved request diagnostics for this browser.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      setBusy(false);
    }
  });

  clearButton.addEventListener("click", async () => {
    if (busy || !window.confirm("Delete saved request diagnostics for this browser? Saved conversations and quiz progress remain.")) return;
    setBusy(true);
    status.textContent = "Deleting saved diagnostics…";
    try {
      const result = await request("POST", "/api/traces/clear");
      if (!object(result) || result.ok !== true) throw new Error("Deletion response was invalid. Refresh to check saved diagnostics.");
      rows.replaceChildren();
      status.textContent = "Saved request diagnostics deleted. Current-page diagnostics remain until reload.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      setBusy(false);
    }
  });

  return {
    notice: (result) => {
      status.textContent = result === "saved"
        ? "Request diagnostics saved. Choose Refresh to view them."
        : result === "unavailable"
          ? "Request diagnostics could not be saved. The tutor response is independent of diagnostics storage."
          : "Request diagnostics save status is unknown. Choose Refresh to check.";
    },
  };
};
