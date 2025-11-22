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
   Ollama (LLM) fallback
   -------------------------*/
const resolveOllamaEndpoint = () => process.env.OLLAMA_ENDPOINT || "http://localhost:11434/api/generate";

const callOllamaForTasks = async (transcript) => {
  const lines = transcript.split('\n').map(l => l.trim()).filter(Boolean);
  const speakers = [...new Set(lines.map(l => parseLineWithSpeaker(l).speaker).filter(Boolean))];
  const currentYear = new Date().getFullYear();

  const prompt = `You are an assistant that extracts meeting action items from a transcript.
The current year is ${currentYear}. ALL deadlines MUST be in the current year (${currentYear}) unless a different year is explicitly mentioned in the transcript. When a month and day are mentioned for a deadline, the year MUST be ${currentYear}.
Your response MUST be a JSON array of objects. Do not include any other text.
Each object in the array represents a single task and MUST have the following format: { "task": "The task description", "original_line": "The exact, unmodified line from the transcript that this task was derived from", "assigned_to": "Person's Name", "deadline": "YYYY-MM-DD or None", "labels": ["label1", "label2", ...] }
The following people attended the meeting: ${speakers.join(', ')}. You MUST assign tasks to one of these people if an assignee is mentioned or implied. If no one is assigned, use "Unassigned".
For the "labels" field, you can use values like "bug", "feature", "urgent", "question", etc.
The "original_line" field is mandatory and must contain the verbatim transcript line.
Transcript is provided below.
${transcript}`.trim();

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
        txt = resp.data;
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

      // Try parse directly
      try {
        const parsed = JSON.parse(jsonString);
        const tasks = Array.isArray(parsed) ? parsed : [parsed];
        return tasks.map(t => ({ ...t, source: 'llm' }));
      } catch (e) {
        // Fallback for embedded JSON arrays or objects inside text
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
        // If LLM returned free text, treat as one raw item
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
const extractTasks = async (transcriptInput) => {
  if (!transcriptInput) return [];

  // Accept either:
  // - an array of objects / lines
  // - a string formatted transcript
  let transcript = "";
  if (Array.isArray(transcriptInput)) {
    // join array into formatted lines (try to preserve speaker if present)
    transcript = transcriptInput
      .map(t => {
        if (!t) return "";
        if (typeof t === "string") return t;
        const speaker = t.speaker || t.participant || t.owner || "";
        const text = t.text || t.transcript || t.chunk || "";
        const ts = t.timestamp ? ` [${t.timestamp}]` : "";
        return `${speaker ? `${speaker}: ` : ""}${text}${ts}`.trim();
      })
      .filter(Boolean)
      .join("\n");
  } else if (typeof transcriptInput === "string") {
    transcript = transcriptInput.trim();
  } else {
    transcript = String(transcriptInput);
  }

  if (!transcript) return [];

  try {
    const tasks = await callOllamaForTasks(transcript);

    const now = new Date();
    let taskIdCounter = 1;
    const enriched = tasks.map((t) => {
      const parsedLine = t.original_line ? parseLineWithSpeaker(t.original_line) : {};

      return {
        ...t,
        task_id: t.task_id || `task-${Date.now()}-${taskIdCounter++}`,
        original_line: t.original_line || t.task,
        extraction_time: now.toLocaleTimeString(),
        owner: t.assigned_to || parsedLine.speaker || 'Unassigned',
        deadline: t.deadline || null,
        speaker: parsedLine.speaker || t.speaker || null,
        timestamp: parsedLine.timestamp || t.timestamp || null,
      };
    });

    return enriched;
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
    descLines.push(`${i + 1}. ${t.task}${t.assigned_to ? ` — ${t.assigned_to}` : ""}${t.deadline ? ` (by ${t.deadline})` : ""}${t.speaker ? ` — ${t.speaker}` : ""}${t.timestamp ? ` (${t.timestamp})` : ""}`);
  });
  const desc = descLines.join("\n");
  const mailtoBody = `subject=${encodeURIComponent(title)}&body=${encodeURIComponent(desc)}`;
  const mailtoUrl = `mailto:?${mailtoBody}`;
  return [
    { label: "Email tasks", type: "mailto", method: "GET", url: mailtoUrl, note: "Opens user's mail client." },
  ];
};

module.exports = {
  extractTasks,
  callOllamaForTasks,
  generateSaveButtons,
};