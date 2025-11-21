// backend/utils/taskExtractor.js
const axios = require("axios");

/* -------------------------
   Utilities / Normalizers
   -------------------------*/
const safeTrim = (s) => (typeof s === "string" ? s.trim() : "");
const collapseWhitespace = (s) => (s || "").replace(/\s+/g, " ");

/* -------------------------
   Line parser
   -------------------------*/
const parseLineWithSpeaker = (line) => {
  const tsSpeakerMsgRegex = /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)]?\s*[-–—]?\s*([^:]+?):\s*(.+)$/;
  const tsDashSpeakerMsgRegex = /^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*([^:]+?):\s*(.+)$/;
  const tsMsgRegex = /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)]?\s*[-–—]?\s*(.+)$/;
  const speakerMsgRegex = /^\s*([^:]+?):\s*(.+)$/;

  let m = line.match(tsSpeakerMsgRegex);
  if (m) return { timestamp: m[1], speaker: safeTrim(m[2]), message: safeTrim(m[3]) };

  m = line.match(tsDashSpeakerMsgRegex);
  if (m) return { timestamp: m[1], speaker: safeTrim(m[2]), message: safeTrim(m[3]) };

  m = line.match(tsMsgRegex);
  if (m) return { timestamp: m[1], speaker: null, message: safeTrim(m[2]) };

  m = line.match(speakerMsgRegex);
  if (m) return { timestamp: null, speaker: safeTrim(m[1]), message: safeTrim(m[2]) };

  return { timestamp: null, speaker: null, message: safeTrim(line) };
};

/* -------------------------
   Rule-based extractor (REMOVED)
   -------------------------*/

/* -------------------------
   Ollama (LLM) fallback
   -------------------------*/
const resolveOllamaEndpoint = () => process.env.OLLAMA_ENDPOINT || "http://localhost:11434/api/generate";

const callOllamaForTasks = async (transcript) => {
  const prompt = `You are an assistant that extracts meeting action items.\nReturn a JSON array ONLY. Each item: { "task": "...", "assigned_to": "...", "deadline": "...", "timestamp": "..." }\nTranscript:\n${transcript}\n-- Respond with JSON array and nothing else.`;
  const endpoint = resolveOllamaEndpoint();
  const model = process.env.OLLAMA_MODEL || "gemma:2b";
  const tryBodies = [{ model, prompt, stream: false }, { model, input: prompt, stream: false }, { prompt, stream: false }];
  let lastErr = null;

  for (const body of tryBodies) {
    try {
      const resp = await axios.post(endpoint, body, { headers: { "Content-Type": "application/json" }, timeout: 60000 });
      let txt = "";

      if (!resp || !resp.data) {
        txt = "";
      } else if (resp.data.response) {
        txt = resp.data.response;
      } else if (typeof resp.data === "string") {
        const lines = resp.data.trim().split('\n');
        const responseParts = [];
        let isStream = false;
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              responseParts.push(parsed.response);
              isStream = true;
            }
          } catch (e) {
            continue;
          }
        }
        txt = isStream ? responseParts.join('') : resp.data;
      } else if (resp.data.output) {
        txt = Array.isArray(resp.data.output) ? resp.data.output.map(o => o.text || "").join("\n") : String(resp.data.output);
      } else if (resp.data.choices && resp.data.choices.length) {
        txt = resp.data.choices.map(c => c.text || c.delta?.content || "").join("\n");
      } else {
        txt = JSON.stringify(resp.data);
      }

      let jsonString = txt.trim();
      const jsonMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1].trim();
      }

      try {
        const parsed = JSON.parse(jsonString);
        const tasks = Array.isArray(parsed) ? parsed : [parsed];
        return tasks.map(t => ({ ...t, source: 'llm' }));
      } catch (e) {
        // Fallback for embedded JSON
        const firstBracket = jsonString.indexOf('[');
        const lastBracket = jsonString.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket > firstBracket) {
          try {
            const parsed = JSON.parse(jsonString.substring(firstBracket, lastBracket + 1));
            if (Array.isArray(parsed)) return parsed.map(t => ({ ...t, source: 'llm' }));
          } catch (e2) {}
        }
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          try {
            const parsed = JSON.parse(jsonString.substring(firstBrace, lastBrace + 1));
            return [{ ...parsed, source: 'llm' }];
          } catch (e3) {}
        }
      }

      if (txt && txt.trim()) {
        return [{ task: txt.trim(), assigned_to: null, deadline: null, timestamp: null, source: "llm-raw" }];
      }
    } catch (err) {
      lastErr = err;
    }
  }
  const e = new Error("Ollama calls failed");
  e.cause = lastErr;
  throw e;
};

/* -------------------------
   Public extractTasks function
   -------------------------*/
const extractTasks = async (transcript) => {
  if (!transcript || !transcript.trim()) return [];
  try {
    return await callOllamaForTasks(transcript);
  } catch (err) {
    console.error("extractTasks fatal error:", err?.message || err);
    return [];
  }
};

/* -------------------------
   Helpers: generate save button payloads
   -------------------------*/
const generateSaveButtons = (tasks = [], { projectName = "Meeting tasks", description = "" } = {}) => {
  const title = `${projectName} — ${tasks.length} tasks`;
  const descLines = [];
  if (description) descLines.push(description);
  tasks.forEach((t, i) => {
    descLines.push(`${i + 1}. ${t.task}${t.assigned_to ? ` — ${t.assigned_to}` : ""}${t.deadline ? ` (by ${t.deadline})` : ""}`);
  });
  const desc = descLines.join("\n");
  const trelloBody = { name: title, desc };
  const asanaBody = { name: title, notes: desc };
  const mailtoBody = `subject=${encodeURIComponent(title)}&body=${encodeURIComponent(desc)}`;
  const mailtoUrl = `mailto:?${mailtoBody}`;
  return [
    { label: "Save to Trello (server-side)", type: "trello", method: "POST", url: "/api/save-to-trello", body: trelloBody, note: "Server needs Trello key/token and idList. Do server-side only." },
    { label: "Save to Asana (server-side)", type: "asana", method: "POST", url: "/api/save-to-ana", body: asanaBody, note: "Server needs Asana PAT and project/workspace id. Do server-side only." },
    { label: "Email tasks", type: "mailto", method: "GET", url: mailtoUrl, note: "Opens user's mail client." },
  ];
};

module.exports = {
  extractTasks,
  callOllamaForTasks,
  generateSaveButtons,
};