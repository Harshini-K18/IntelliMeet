// utils/takenotes.js
const axios = require("axios");

/**
 * Normalize common token-splitting artifacts (conservative)
 */
function normalizeNameSplits(text) {
  if (!text || typeof text !== "string") return text;

  // 1) Known-name quick fixes (add more as you find issues)
  text = text.replace(/\bHarsh\s*ini\s*K\b/g, "Harshini K");

  // 2) Heuristic: join short lowercase fragments inside names like "Harsh ini K" -> "Harshini K"
  text = text.replace(/\b([A-Z][a-z]{2,})\s+([a-z]{1,3})\s+([A-Z][a-z]+)/g, "$1$2 $3");

  // 3) Collapse accidental repeated spaces/newlines and trim
  text = text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

/**
 * Remove streaming/metadata artifacts commonly appended by Ollama:
 * - modelName + ISO-timestamp + 'stop' (e.g. "gemma:2b2025-11-15T14:44:25.5708784Zstop")
 * - stray "stop" tokens
 * - stray model tags like "gemma:2b"
 */
function cleanStreamArtifacts(text) {
  if (!text || typeof text !== "string") return text;

  let out = text;

  // 1) Remove patterns like: gemma:2b2025-11-15T14:44:25.5708784Zstop (model + ISO timestamp + stop)
  out = out.replace(
    /\s*[A-Za-z0-9_\-\/.:]+?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s*stop\s*$/i,
    ""
  );

  // 2) Remove a trailing "stop" by itself (common artifact)
  out = out.replace(/\s*\bstop\b\s*$/i, "");

  // 3) Remove trailing model tags with no timestamp, e.g. "gemma:2b" or "gpt-4o-mini"
  out = out.replace(/\s*[A-Za-z0-9_\-\.]+:[A-Za-z0-9_\-\.]+\s*$/i, "");

  // 4) Strip leftover ISO-like timestamp at the end if present
  out = out.replace(/\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s*$/i, "");

  // 5) Final cleanup of repeated spaces/newlines and trim
  out = out.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  return out;
}

/**
 * Helper: try to safely extract a text chunk from a parsed object
 */
function extractTextFromObj(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  if (obj.response && typeof obj.response === "string") return obj.response;
  if (obj.output) {
    if (Array.isArray(obj.output)) {
      return obj.output.map(o => o.content || o.text || "").join("");
    }
    if (typeof obj.output === "string") return obj.output;
  }
  if (obj.choices && Array.isArray(obj.choices)) {
    return obj.choices.map(c => c.text || c.message || "").join("\n");
  }
  // fallback: flatten small fields
  const keys = ["text", "content", "data"];
  for (const k of keys) {
    if (obj[k] && typeof obj[k] === "string") return obj[k];
  }
  return "";
}

const generateMomWithOllama = async (transcript) => {
  if (!transcript || transcript.trim() === "") {
    throw new Error("Transcript is empty. Cannot generate MoM.");
  }

  // Strong, explicit prompt so Ollama doesn't invent pronouns or change speaker names
  const prompt = `
You are a helpful assistant that converts raw meeting transcripts into a clear, structured Minutes of Meeting (MoM).
Requirements:
1) Preserve original speaker names exactly as they appear in the transcript (do not guess gender or substitute pronouns).
2) Use neutral phrasing (use the speaker's name or "they" instead of gendered pronouns).
3) Produce a structured MoM in plain text with these labeled sections: Date, Time (if present), Attendees, Topic (one-line), Key Points (bullet list), Decisions Made (bullet list), Action Items (bullet list with assignee when possible).
4) Keep outputs concise and factual; do not invent information not present in the transcript.
5) If timestamps or speakers are present (e.g. [0:00] Harshini K: ...), keep them in parentheses next to the point.

Transcript:
${transcript}

Produce only the MoM (no commentary) and keep formatting simple for easy HTML highlighting.
`;

  try {
    const url = "http://localhost:11434/api/generate"; // Ollama HTTP API
    const model = process.env.OLLAMA_MODEL || "gemma:2b";

    const payload = {
      model,
      prompt,
      // optional: temperature, max_tokens, etc.
      // temperature: 0.1,
      // max_tokens: 800,
    };

    // Request as stream to robustly handle various Ollama server behaviors
    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" },
      responseType: "stream",
      timeout: 120000, // 2 minutes
    });

    let assembled = "";
    const stream = response.data;

    if (stream && typeof stream.on === "function") {
      // Stream consumption: handle NDJSON / newline-delimited JSON and plain text chunks
      let buffer = "";

      for await (const chunk of stream) {
        const raw = chunk.toString("utf8");
        buffer += raw;

        // split on newlines; leave last partial line in buffer
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Try parse JSON; if fails, accept as plain text
          let parsed = null;
          try {
            parsed = JSON.parse(trimmed);
          } catch (e) {
            // Not JSON — append raw text
            assembled += trimmed;
            continue;
          }

          // If parsed JSON, try to extract text fields
          const txt = extractTextFromObj(parsed);
          if (txt) {
            assembled += txt;
          } else {
            // Fallback: join all string-valued fields
            const flatText = Object.values(parsed)
              .filter(v => typeof v === "string")
              .join("");
            assembled += flatText;
          }
        }
      }

      // Process leftover buffer after stream ends
      if (buffer && buffer.trim()) {
        const leftover = buffer.trim();
        try {
          const parsed = JSON.parse(leftover);
          assembled += extractTextFromObj(parsed);
        } catch (e) {
          assembled += leftover;
        }
      }
    } else {
      // Non-stream response fallback
      const data = response.data;
      if (typeof data === "string") assembled = data;
      else if (data) {
        const txt = extractTextFromObj(data);
        assembled = txt || JSON.stringify(data, null, 2);
      }
    }

    // Normalize and clean artifacts
    const normalized = normalizeNameSplits(assembled || "");
    let finalText = normalized.trim();
    finalText = cleanStreamArtifacts(finalText);

    // Final check
    if (!finalText) {
      throw new Error("Empty response from Ollama or unable to parse streamed chunks.");
    }

    // Optional debug log (remove or comment out in production)
    console.log("Generated MoM (cleaned):", finalText.slice(0, 1200));

    return finalText;
  } catch (error) {
    // Try to surface any non-stream error body for debugging
    if (error.response && error.response.data) {
      try {
        const body = typeof error.response.data === "string" ? error.response.data : JSON.stringify(error.response.data);
        console.error("Ollama error response body:", body.slice ? body.slice(0, 1000) : body);
      } catch (e) {
        // ignore
      }
    }

    console.error("Error generating MoM with Ollama:", error.message || error);
    throw new Error("Failed to generate MoM. Please try again later.");
  }
};

module.exports = {
  generateMomWithOllama,
};