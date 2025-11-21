import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:3001";

const colorMap = {
  "rule-based": { from: "from-green-100", to: "to-green-50", border: "border-green-500" },
  "llm-raw": { from: "from-indigo-100", to: "to-indigo-50", border: "border-indigo-500" },
  "llm": { from: "from-purple-100", to: "to-purple-50", border: "border-purple-500" },
  preview: { from: "from-yellow-100", to: "to-yellow-50", border: "border-yellow-500" },
  default: { from: "from-gray-100", to: "to-gray-50", border: "border-gray-400" },
};

const getCardClasses = (source) => {
  const cfg = colorMap[source] || colorMap.default;
  return `card-coffee ${cfg.from} ${cfg.to} border-l-4 ${cfg.border} shadow-sm rounded-lg p-4 transition-transform transform hover:-translate-y-0.5 bg-light-card dark:bg-dark-card`;
};

const badgeClass = "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium";

/**
 * Normalizer for a single server-returned item into expected task shape
 */
const normalizeItem = (item) => {
  if (!item) return null;
  if (typeof item === "string") return { task: item.trim(), assigned_to: null, deadline: null, timestamp: null, source: "llm-raw" };
  // if already has task field
  if (item.task || item.title || item.text || item.content) {
    return {
      task: (item.task || item.title || item.text || item.content || "").toString().trim(),
      assigned_to: item.assigned_to || item.owner || item.assignee || null,
      deadline: item.deadline || item.due || null,
      timestamp: item.timestamp || null,
      source: item.source || item._source || "llm",
    };
  }
  // fallback: stringify
  return { task: JSON.stringify(item).slice(0, 400), assigned_to: null, deadline: null, timestamp: null, source: "llm-raw" };
};

const TaskExtractor = ({ initialTranscript = "" }) => {
  const [transcript, setTranscript] = useState(initialTranscript);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoExtract, setAutoExtract] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const socketRef = useRef(null);
  const debounceRef = useRef(null);
  const seenSignatures = useRef(new Set());

  const mergeNewTasks = useCallback((newTasks) => {
    if (!Array.isArray(newTasks)) {
      console.log("[TaskExtractor] mergeNewTasks received non-array:", newTasks);
      return;
    }
    setTasks((prev = []) => {
      const merged = prev.slice();
      for (const t of newTasks) {
        const sig = (t.task || "").trim().toLowerCase();
        if (!sig) continue;
        if (seenSignatures.current.has(sig)) continue;
        seenSignatures.current.add(sig);
        merged.push(t);
      }
      return merged;
    });
  }, []);

  /**
   * NEW: Robust triggerExtract that normalizes many server response shapes
   * - Accepts server returning: { tasks: [...] }, [...], { ...single task... }, or raw text
   * - Normalizes entries via normalizeItem()
   */
  const triggerExtract = useCallback(
    async (overrideText, silent = false) => {
      setError(null);
      if (!overrideText && !transcript) {
        if (!silent) setError("Please paste or enter a transcript.");
        return;
      }
      const bodyTranscript = overrideText ?? transcript;

      setLoading(true);
      try {
        console.log("[TaskExtractor] POST /extract-tasks -> length:", bodyTranscript.length);
        const res = await fetch("http://localhost:3001/extract-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: bodyTranscript }),
        });

        const rawText = await res.text();
        console.log("[TaskExtractor] raw response:", rawText);

        if (!res.ok) {
          let msg = rawText;
          try {
            const parsedErr = JSON.parse(rawText);
            msg = parsedErr.error || JSON.stringify(parsedErr);
          } catch (e) {}
          throw new Error(`Server returned ${res.status}: ${msg}`);
        }

        // try parse JSON
        let parsed = null;
        try {
          parsed = JSON.parse(rawText);
        } catch (e) {
          parsed = rawText;
        }

        // Normalize into array of items
        let items = [];
        if (Array.isArray(parsed)) {
          items = parsed;
        } else if (parsed && Array.isArray(parsed.tasks)) {
          items = parsed.tasks;
        } else if (parsed && typeof parsed === "object") {
          // sometimes server returns { task: "..."} or single object
          const keys = Object.keys(parsed);
          // Heuristic: if object has numeric keys 0.. then convert to array
          if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
            items = keys.map((k) => parsed[k]);
          } else {
            // treat as single item object
            items = [parsed];
          }
        } else if (typeof parsed === "string" && parsed.trim()) {
          // fallback: treat as raw string response (LLM fallback)
          items = [parsed.trim()];
        }

        // Map/normalize each item
        const normalized = items.map(normalizeItem).filter(Boolean);

        console.log("[TaskExtractor] normalized items:", normalized);

        if (normalized.length === 0) {
          if (!silent) setError("No tasks found.");
        } else {
          // Option A (immediate display): replace UI tasks with normalized results
          // This helps validate that server returned tasks and shows them instantly.
          // We still keep mergeNewTasks available for incremental merging.
          // Deduplicate using seenSignatures set
          const unique = [];
          for (const it of normalized) {
            const sig = (it.task || "").trim().toLowerCase();
            if (!sig) continue;
            if (seenSignatures.current.has(sig)) continue;
            seenSignatures.current.add(sig);
            unique.push(it);
          }

          // If you prefer merging into existing list instead of replacing, uncomment mergeNewTasks:
          // mergeNewTasks(unique);

          // Replace current tasks with union of previous + new unique (keeps UI simple)
          setTasks((prev = []) => {
            const next = prev.slice();
            for (const u of unique) next.push(u);
            return next;
          });

          setError(null);
        }
      } catch (err) {
        console.error("extract error:", err);
        if (!silent) setError(err.message || "Failed to extract tasks. See console.");
      } finally {
        setLoading(false);
      }
    },
    [transcript, mergeNewTasks]
  );

  const saveToProvider = async (provider) => {
    if (!tasks || tasks.length === 0) {
      setSaveStatus({ provider, status: "error", msg: "No tasks to save" });
      return;
    }
    setSaving(true);
    setSaveStatus(null);
    try {
      const url = provider === "trello" ? "http://localhost:3001/api/save-to-trello" : "http://localhost:3001/api/save-to-asana";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks, title: `Meeting tasks (${tasks.length})` }),
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(txt || `Save failed (${res.status})`);
      setSaveStatus({ provider, status: "ok", msg: txt || "Saved" });
    } catch (err) {
      console.error("save error:", err);
      setSaveStatus({ provider, status: "error", msg: err.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const emailTasks = () => {
    if (!tasks || tasks.length === 0) {
      setSaveStatus({ provider: "email", status: "error", msg: "No tasks to email" });
      return;
    }
    const title = encodeURIComponent(`Meeting tasks (${tasks.length})`);
    const body = encodeURIComponent(
      tasks.map((t, i) => `${i + 1}. ${t.task}${t.assigned_to ? ` — ${t.assigned_to}` : ""}${t.deadline ? ` (by ${t.deadline})` : ""}`).join("\n")
    );
    window.location.href = `mailto:?subject=${title}&body=${body}`;
  };

  useEffect(() => {
    try {
      socketRef.current = io(SOCKET_URL, { transports: ["websocket"], autoConnect: true });
      const socket = socketRef.current;

      const onTranscript = (payload) => {
        const text = typeof payload === "string" ? payload : payload.text || payload.transcript || payload.chunk || "";
        if (!text) return;

        setTranscript((prev) => {
          const newText = prev.endsWith("\n") ? prev + text : prev + "\n" + text;
          if (autoExtract) {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              triggerExtract(newText, true);
            }, 900);
          }
          return newText;
        });
      };

      const onTasks = (payload) => {
        if (Array.isArray(payload) && payload.length) mergeNewTasks(payload);
      };

      socket.on("transcript", onTranscript);
      socket.on("live-transcript", onTranscript);
      socket.on("transcript:update", onTranscript);
      socket.on("tasks", onTasks);

      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        socket.off("transcript", onTranscript);
        socket.off("live-transcript", onTranscript);
        socket.off("transcript:update", onTranscript);
        socket.off("tasks", onTasks);
        socket.disconnect();
      };
    } catch (e) {
      console.warn("Socket connection failed:", e);
    }
  }, [autoExtract, mergeNewTasks, triggerExtract]);

  return (
    <div className="bg-light-card dark:bg-dark-card shadow-lg rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="max-w-3xl layout-left">
        <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-100">Task Extractor</h2>
        <div className="mb-3 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={autoExtract} onChange={(e) => setAutoExtract(e.target.checked)} className="h-4 w-4" />
            Auto-extract from live transcript
          </label>
           <button
            onClick={() => {
              setTranscript("");
              setTasks([]);
              setError(null);
              seenSignatures.current.clear();
              setSaveStatus(null);
            }}
            className="border px-3 py-1 rounded-md text-sm hover:bg-light-accent hover:text-light-bg dark:hover:bg-dark-accent dark:hover:text-dark-bg dark:border-gray-600 dark:text-gray-300"
          >
            Clear Transcript
          </button>
          <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">Tip: Auto-extract sends the full transcript on update</div>
        </div>
        {/* Transcript Input */}
        <div className="mb-4">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Transcript will appear here... or paste your own."
            className="w-full h-20 p-2 border rounded-lg bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text"
          />
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={() => triggerExtract()} disabled={loading} className="bg-light-accent text-light-bg px-4 py-2 rounded-md hover:bg-opacity-90 disabled:opacity-60 dark:bg-dark-accent dark:text-dark-bg">
            {loading ? "Extracting..." : "Extract Tasks"}
          </button>
          <button
            onClick={() => {
              const lastLine = transcript.trim().split("\n").pop() || "";
              triggerExtract(lastLine || transcript);
            }}
            className="border px-4 py-2 rounded-md hover:bg-light-accent hover:text-light-bg dark:hover:bg-dark-accent dark:hover:text-dark-bg dark:border-gray-600 dark:text-gray-300"
          >
            Extract Latest
          </button>
          <button
            onClick={() => {
              const preview = (transcript || "").split(/\r?\n/).filter(Boolean).slice(-3).join(" ");
              if (!preview) setError("No recent transcript lines to preview.");
              else {
                setError(null);
                const p = { task: preview, assigned_to: null, deadline: null, timestamp: null, source: "preview" };
                mergeNewTasks([p]);
              }
            }}
            className="border px-4 py-2 rounded-md hover:bg-light-accent hover:text-light-bg dark:hover:bg-dark-accent dark:hover:text-dark-bg dark:border-gray-600 dark:text-gray-300"
          >
            Preview Latest
          </button>
        </div>
        {error && <div className="mt-2 text-red-600 dark:text-red-400">{error}</div>}
        {tasks && (
          <div className="mt-4">
            <h3 className="font-bold mb-3 text-gray-800 dark:text-gray-100">Extracted Tasks</h3>
            {tasks.length === 0 && <div className="text-sm text-gray-600 dark:text-gray-400">No tasks found.</div>}
            {/* Task List */}
            <ul className="space-y-4">
              {tasks.map((t, i) => {
                const src = t.source || "default";
                const cardCls = getCardClasses(src === "preview" ? "preview" : src);
                return (
                  <li key={i} className={cardCls}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="text-sm text-gray-800 dark:text-gray-200 font-semibold mb-1">Task</div>
                        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{t.task || "(no description)"}</div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="mb-2">
                          <span className={`${badgeClass} bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-transparent px-2 py-0.5`}>#{i + 1}</span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{t.timestamp || ""}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Owner</span>
                        <span className="px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">{t.assigned_to || "Unassigned"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Deadline</span>
                        <span className="px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">{t.deadline || "None"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Source</span>
                        <span className="px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">{t.source || "rule/llm"}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => saveToProvider("trello")} disabled={saving} className="bg-light-accent text-light-bg px-3 py-2 rounded-md hover:bg-opacity-90 disabled:opacity-60 dark:bg-dark-accent dark:text-dark-bg">
                {saving ? "Saving..." : "Save to Trello"}
              </button>
              <button onClick={() => saveToProvider("asana")} disabled={saving} className="bg-light-accent text-light-bg px-3 py-2 rounded-md hover:bg-opacity-90 disabled:opacity-60 dark:bg-dark-accent dark:text-dark-bg">
                {saving ? "Saving..." : "Save to Asana"}
              </button>
              <button onClick={emailTasks} className="border px-3 py-2 rounded-md hover:bg-light-accent hover:text-light-bg dark:hover:bg-dark-accent dark:hover:text-dark-bg dark:border-gray-600 dark:text-gray-300">
                Email Tasks
              </button>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(tasks.map((t, i) => `${i + 1}. ${t.task}`).join("\n"));
                  setSaveStatus({ provider: "clipboard", status: "ok", msg: "Copied to clipboard" });
                  setTimeout(() => setSaveStatus(null), 2500);
                }}
                className="border px-3 py-2 rounded-md hover:bg-light-accent hover:text-light-bg dark:hover:bg-dark-accent dark:hover:text-dark-bg dark:border-gray-600 dark:text-gray-300"
              >
                Copy
              </button>
              <button
                onClick={() => {
                  setTasks([]);
                  seenSignatures.current.clear();
                  setSaveStatus(null);
                }}
                className="ml-auto border px-3 py-2 rounded-md hover:bg-light-accent hover:text-light-bg dark:hover:bg-dark-accent dark:hover:text-dark-bg dark:border-gray-600 dark:text-gray-300"
              >
                Clear Tasks
              </button>
            </div>
            {saveStatus && <div className={`mt-3 text-sm ${saveStatus.status === "ok" ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{saveStatus.provider.toUpperCase()}: {saveStatus.msg}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskExtractor;