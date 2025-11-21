// utils/takeNotes.js
const axios = require("axios");

// In-memory transcript store
let TRANSCRIPTS = [];

/* -------------------------------------------------------
   Transcript Helpers
-------------------------------------------------------- */
function addTranscript(entry) {
  // Accept both {speaker,text,timestamp} or plain text
  if (typeof entry === "string") {
    TRANSCRIPTS.push({
      speaker: "Unknown",
      text: entry,
      timestamp: new Date().toISOString()
    });
  } else {
    TRANSCRIPTS.push({
      speaker: entry.speaker || "Unknown",
      text: entry.text || "",
      timestamp: entry.timestamp || new Date().toISOString()
    });
  }
}

function getTranscript() {
  return TRANSCRIPTS;
}

function clearTranscript() {
  TRANSCRIPTS = [];
}

/* -------------------------------------------------------
   Notes Generator — Basic Extractive Version
-------------------------------------------------------- */
function takenotes(fullText) {
  if (!fullText || fullText.trim() === "") return [];

  const lines = fullText.split("\n");
  const important = lines.filter((l) =>
    /task|important|note|deadline|action|decide/i.test(l)
  );

  if (important.length === 0) {
    // fallback: extract 3 most meaningful lines
    return lines.slice(0, 3);
  }

  return important.slice(0, 8);
}

/* -------------------------------------------------------
   NORMALIZATION HELPERS
-------------------------------------------------------- */
function normalizeNameSplits(text) {
  if (!text || typeof text !== "string") return text;

  text = text.replace(/\bHarsh\s*ini\s*K\b/g, "Harshini K");
  text = text.replace(/\s{2,}/g, " ");

  return text.trim();
}

function cleanStreamArtifacts(text) {
  if (!text || typeof text !== "string") return text;

  return text
    .replace(/stop\s*$/i, "")
    .replace(/gemma:[0-9a-z]+/gi, "")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/gi, "")
    .trim();
}

/* -------------------------------------------------------
   FIXED — NON-STREAMING MOM GENERATOR
-------------------------------------------------------- */
async function generateMomWithOllama(transcript) {
  if (!transcript || transcript.trim() === "") {
    throw new Error("Transcript is empty.");
  }

  const cleanedTranscript = transcript.trim();

  const prompt = `
You are an assistant that writes clean, human-readable Minutes of Meeting (MoM).

Rules:
- Do NOT stream output.
- Do NOT output JSON.
- Do NOT output metadata.
- Produce ONE final text block only.

Format:

Minutes of Meeting (MoM)

Date: <if available>
Attendees: <if available>

Topic:
- <summary>

Key Points:
- point 1
- point 2

Decisions:
- decision 1

Action Items:
- <owner>: <task> (deadline if any)

Transcript:
${cleanedTranscript}

Return ONLY the MoM text. No JSON.
`;

  try {
    const resp = await axios.post(
      "http://localhost:11434/api/generate",
      {
        model: process.env.OLLAMA_MODEL || "gemma:2b",
        prompt,
        stream: false,
      },
      { timeout: 60000 }
    );

    let text = resp.data?.response || "";

    text = normalizeNameSplits(text);
    text = cleanStreamArtifacts(text);

    if (!text.trim()) throw new Error("Empty MoM response.");

    return text;
  } catch (err) {
    console.error("MoM generation error:", err.message || err);
    throw new Error("Failed to generate MoM.");
  }
}

module.exports = {
  addTranscript,
  getTranscript,
  takenotes,
  clearTranscript,
  generateMomWithOllama,
};
