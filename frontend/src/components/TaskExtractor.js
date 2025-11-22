// src/components/TaskExtractor.jsx
import React, { useState } from "react";
import axios from "axios";

const BACKEND_BASE = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

function tryParseJsonLike(text) {
  if (!text || !text.trim()) return null;
  // Remove surrounding code fences and language hints (```json ... ``` or ``` ... ```).
  const stripped = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  // Try direct JSON.parse
  try {
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") return [parsed];
  } catch (e) {
    // not direct parseable
  }

  // Try to find the first JSON array inside the text (from [ to last ])
  const firstBracket = stripped.indexOf('[');
  const lastBracket = stripped.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const arrText = stripped.substring(firstBracket, lastBracket + 1);
    try {
      const parsed = JSON.parse(arrText);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // continue
    }
  }

  // Try to recover a list of objects by finding {...} chunks
  const objectMatches = [...stripped.matchAll(/\{[\s\S]*?\}/g)];
  if (objectMatches.length) {
    const objs = [];
    for (const m of objectMatches) {
      const candidate = m[0];
      try {
        const p = JSON.parse(candidate);
        objs.push(p);
      } catch (e) {
        // try quick cleanup: convert smart quotes to straight quotes and parse
        const cleaned = candidate.replace(/[“”]/g, '"').replace(/[\u2018\u2019]/g, "'");
        try {
          const p2 = JSON.parse(cleaned);
          objs.push(p2);
        } catch (e2) {
          // last resort: try to extract key: "value" pairs with regex (best-effort)
          const kv = {};
          const pairRegex = /"([^"]+)"\s*:\s*"([^"]*)"/g;
          let pair;
          while ((pair = pairRegex.exec(candidate)) !== null) {
            kv[pair[1]] = pair[2];
          }
          if (Object.keys(kv).length) objs.push(kv);
        }
      }
    }
    if (objs.length) return objs;
  }

  // nothing parsed
  return null;
}

const normalizeTasks = (rawTasks = []) => {
  return rawTasks.map((t, i) => {
    const taskText = t.task || t.title || (typeof t === "string" ? t : "");
    return {
      task: String(taskText || "").trim(),
      original_line: (t.original_line || t.original || t.source || "").toString(),
      assigned_to: t.assigned_to || t.owner || t.assignee || "Unassigned",
      deadline: t.deadline || null,
      labels: Array.isArray(t.labels) ? t.labels : (t.label ? [t.label] : []),
      task_id: t.task_id || t.id || `task-${i}-${Date.now()}`,
      raw: t
    };
  });
};

const TaskExtractor = () => {
  const [pastedTranscript, setPastedTranscript] = useState("");
  const [tasks, setTasks] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [saveState, setSaveState] = useState({});

  const extractTasks = async () => {
    setError(null);
    setTasks([]);
    setSaveState({});
    if (!pastedTranscript.trim()) return;

    setIsExtracting(true);

    // First: try local robust JSON parsing (handles fenced code, concatenated objects, etc.)
    let parsed = tryParseJsonLike(pastedTranscript);

    if (!parsed) {
      // fallback: call backend /extract-tasks if local parse fails
      try {
        const resp = await axios.post(`${BACKEND_BASE}/extract-tasks`, { transcript: pastedTranscript }, { timeout: 60000 });
        if (resp.data && resp.data.tasks) {
          parsed = Array.isArray(resp.data.tasks) ? resp.data.tasks : tryParseJsonLike(String(resp.data.tasks));
        } else if (resp.data && Array.isArray(resp.data)) {
          parsed = resp.data;
        }
      } catch (err) {
        console.error("Backend extract-tasks failed:", err);
        setError("Failed to extract tasks locally and backend call failed.");
      }
    }

    if (!parsed) {
      // As last resort: try to split lines and heuristically detect sentences that look like tasks
      const heuristics = pastedTranscript.split(/\n+/).map(l => l.trim()).filter(Boolean).slice(0, 200);
      const likely = heuristics.filter(l => /(please|assign|finish|complete|send|prepare|verify|update|upload|by|deadline)/i.test(l));
      parsed = likely.map(l => ({ task: l, original_line: l, assigned_to: "Unassigned", deadline: null, labels: [] }));
    }

    const normalized = normalizeTasks(parsed || []);
    setTasks(normalized);
    setIsExtracting(false);
  };

  const copyToClipboard = () => {
    const out = tasks.map(t => `Task: ${t.task}\nOwner: ${t.assigned_to}\nDeadline: ${t.deadline || "Not set"}\nSource: ${t.original_line || ""}`).join("\n\n");
    navigator.clipboard.writeText(out);
    alert("Tasks copied to clipboard");
  };

  const saveToJira = async (task) => {
    const key = task.task_id;
    setSaveState(prev => ({ ...prev, [key]: { saving: true } }));
    try {
      const resp = await axios.post(`${BACKEND_BASE}/api/save-to-jira`, { task }, { timeout: 30000 });
      if (resp.data && resp.data.ok) {
        setSaveState(prev => ({ ...prev, [key]: { saving: false, ok: true, created: resp.data.created || null } }));
        alert(`Saved to Jira ${resp.data.created?.key || ""}`);
      } else {
        setSaveState(prev => ({ ...prev, [key]: { saving: false, ok: false, message: JSON.stringify(resp.data || "no response") } }));
        alert("Save to Jira failed: " + JSON.stringify(resp.data || "no response"));
      }
    } catch (err) {
      const body = err?.response?.data || err?.message || err;
      setSaveState(prev => ({ ...prev, [key]: { saving: false, ok: false, message: JSON.stringify(body) } }));
      alert("Failed to save task to Jira: " + JSON.stringify(body));
    }
  };

  const saveAllToJira = async () => {
    if (!tasks.length) return alert("No tasks to save");
    // optimistic
    const initial = {};
    tasks.forEach(t => initial[t.task_id] = { saving: true });
    setSaveState(initial);

    try {
      const resp = await axios.post(`${BACKEND_BASE}/api/save-multiple-to-jira`, { tasks }, { timeout: 60000 });
      if (resp.data && resp.data.ok) {
        const results = resp.data.results || [];
        const state = {};
        results.forEach((r, idx) => {
          const t = tasks[idx];
          const id = t.task_id;
          if (r.ok) state[id] = { saving: false, ok: true, created: r.created };
          else state[id] = { saving: false, ok: false, message: r.error || r };
        });
        setSaveState(state);
        const failed = Object.values(state).filter(s => !s.ok);
        if (failed.length) alert(`${failed.length} tasks failed to save. See details.`);
        else alert("All tasks saved to Jira!");
      } else {
        setSaveState(prev => {
          const allFailed = {};
          tasks.forEach(t => allFailed[t.task_id] = { saving: false, ok: false, message: JSON.stringify(resp.data || "no response") });
          return allFailed;
        });
        alert("Failed to save tasks to Jira: " + JSON.stringify(resp.data || "no response"));
      }
    } catch (err) {
      const body = err?.response?.data || err?.message || err;
      const failedState = {};
      tasks.forEach(t => failedState[t.task_id] = { saving: false, ok: false, message: JSON.stringify(body) });
      setSaveState(failedState);
      alert("Failed to save all tasks to Jira: " + JSON.stringify(body));
    }
  };

  const saveTasksToDashboard = async () => {
    try {
      await axios.post(`${BACKEND_BASE}/api/store-frontend-tasks`, { tasks });
      alert("Tasks sent to dashboard");
    } catch (err) {
      console.error("store-frontend-tasks failed", err);
      alert("Failed to send tasks to dashboard");
    }
  };

  const renderSaveStatus = (t) => {
    const s = saveState[t.task_id];
    if (!s) return null;
    if (s.saving) return <span className="text-sm text-blue-600">Saving…</span>;
    if (s.ok) return <span className="text-sm text-green-700">Saved {s.created?.key ? `(${s.created.key})` : ""}</span>;
    return <span className="text-sm text-red-600">Failed: {String(s.message).slice(0,120)}</span>;
  };

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold mb-4">Task Extractor</h2>
      <textarea
        rows={10}
        value={pastedTranscript}
        onChange={(e) => setPastedTranscript(e.target.value)}
        placeholder="Paste transcript or JSON here..."
        className="w-full p-2 border rounded mb-3"
      />
      <div className="flex gap-3 mb-4">
        <button disabled={isExtracting || !pastedTranscript.trim()} onClick={extractTasks} className="px-4 py-2 bg-blue-600 text-white rounded">
          {isExtracting ? "Extracting..." : "Extract Tasks"}
        </button>
        <button onClick={() => { setPastedTranscript(""); setTasks([]); setSaveState({}); setError(null); }} className="px-4 py-2 bg-gray-500 text-white rounded">Clear</button>
      </div>

      {error && <div className="text-red-600 mb-3">{error}</div>}

      <div className="space-y-3">
        {tasks.map((t, idx) => (
          <div key={t.task_id || idx} className="p-3 border rounded bg-gray-50 flex justify-between">
            <div style={{flex:1}}>
              <div className="font-semibold">{t.task}</div>
              <div className="text-sm text-gray-700">Owner: {t.assigned_to}</div>
              <div className="text-sm text-gray-700">Deadline: {t.deadline || "Not set"}</div>
              {t.original_line && <div className="text-sm text-gray-500 italic">Source: "{t.original_line}"</div>}
            </div>
            <div className="flex flex-col items-end gap-2 ml-3">
              {renderSaveStatus(t)}
              <div className="flex gap-2">
                <button onClick={() => saveToJira(t)} disabled={saveState[t.task_id]?.saving} className="px-3 py-1 bg-blue-500 text-white rounded">Save to Jira</button>
                <button onClick={() => navigator.clipboard.writeText(JSON.stringify(t, null, 2))} className="px-3 py-1 bg-gray-500 text-white rounded">Copy</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tasks.length > 0 && (
        <div className="mt-4 flex gap-2">
          <button onClick={saveAllToJira} className="px-4 py-2 bg-blue-600 text-white rounded">Save All to Jira</button>
          <button onClick={saveTasksToDashboard} className="px-4 py-2 bg-green-600 text-white rounded">Save to Dashboard</button>
          <button onClick={copyToClipboard} className="px-4 py-2 bg-gray-600 text-white rounded">Copy Tasks</button>
        </div>
      )}
    </div>
  );
};

export default TaskExtractor;