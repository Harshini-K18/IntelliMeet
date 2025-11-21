// index.js — Final merged backend (Option A: frontend supplies emails when finishing meeting)
console.log("FILE LOADED!");

require("dotenv").config();

console.log("RECALL_API_KEY present?", !!process.env.RECALL_API_KEY);
console.log("RECALL_API_KEY value =", process.env.RECALL_API_KEY);

// ---------- imports ----------
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");
const http = require("http");
const { Server } = require("socket.io");

// ---------- use your existing utils (do not overwrite) ----------
const { extractTasks } = require("./utils/taskExtractor"); // keep old extractor
const { addTranscript, getTranscript, takenotes, generateMomWithOllama } = require("./utils/takeNotes");

// ---------- in-memory storage ----------
let TRANSCRIPT_STORE = []; // local backup
const participantsByMeeting = new Map();
let lastDashboardHTML = "";
let lastDashboardTimestamp = null;

// If your utils already implement addTranscript/getTranscript, we still keep local backup in case
function addTranscriptLocal(entry) {
  if (!entry) return;
  if (typeof entry === "string") {
    TRANSCRIPT_STORE.push({ speaker: "", text: entry, timestamp: new Date().toISOString(), timestamp_unix: Math.floor(Date.now() / 1000) });
  } else {
    const obj = Object.assign({}, entry);
    obj.timestamp = obj.timestamp || new Date().toISOString();
    obj.timestamp_unix = obj.timestamp_unix || Math.floor(new Date(obj.timestamp).getTime() / 1000);
    TRANSCRIPT_STORE.push(obj);
  }
}
function getTranscriptLocal() {
  return TRANSCRIPT_STORE;
}
function clearTranscriptLocal() {
  TRANSCRIPT_STORE = [];
}

// ---------- helpers ----------
function escapeHtml(text) {
  if (text === undefined || text === null) return "";
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function detectPlatform(url) {
  if (!url || typeof url !== "string") return "Unknown";
  if (url.includes("zoom.us")) return "Zoom";
  if (url.includes("meet.google.com")) return "Google Meet";
  if (url.includes("teams.microsoft.com")) return "Microsoft Teams";
  return "Unknown";
}

// ---------- sanitize possible streaming output from Ollama-like responses ----------
function sanitizeModelOutput(raw) {
  if (!raw && raw !== "") return "";
  if (typeof raw !== "string") {
    try { return JSON.stringify(raw); } catch { return String(raw); }
  }
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const jsonishCount = lines.filter(l => l.startsWith("{") && l.includes('"response"')).length;
  if (jsonishCount > 0) {
    let collected = "";
    for (const ln of lines) {
      try {
        if (ln.startsWith("{") && ln.endsWith("}")) {
          try {
            const o = JSON.parse(ln);
            if (o && typeof o.response === "string") {
              collected += o.response;
              continue;
            }
          } catch (e) {
            const m = ln.match(/"response"\s*:\s*"([^"]*)"/);
            if (m && m[1]) collected += m[1];
            continue;
          }
        }
        const m = ln.match(/"response"\s*:\s*"([^"]*)"/);
        if (m && m[1]) collected += m[1];
      } catch (e) {
        // ignore
      }
    }
    if (collected.trim().length) return collected.replace(/\s+/g, " ").trim();
  }
  const filtered = lines.filter(l => !(l.startsWith("{") && (l.includes('"model"') || l.includes('"done"'))));
  if (filtered.length > 0) return filtered.join(" ").replace(/\s+/g, " ").trim();
  return raw.replace(/\s+/g, " ").trim();
}

// ---------- Ollama-safe wrappers ----------
async function safeTakenotes(fullText) {
  try {
    const res = await Promise.resolve(takenotes(fullText));
    if (!res) return [];
    if (Array.isArray(res)) return res.map(r => sanitizeModelOutput(typeof r === "string" ? r : JSON.stringify(r)));
    if (typeof res === "string") return sanitizeModelOutput(res).split("\n").map(l => l.trim()).filter(Boolean);
    if (res && Array.isArray(res.notes)) return res.notes.map(n => sanitizeModelOutput(typeof n === "string" ? n : JSON.stringify(n)));
    return [sanitizeModelOutput(String(res))];
  } catch (err) {
    console.error("safeTakenotes error:", err);
    return ["Notes unavailable due to AI error."];
  }
}

async function safeGenerateMom(fullText) {
  try {
    const res = await Promise.resolve(generateMomWithOllama(fullText));
    if (!res) return ["No MoM available"];
    if (Array.isArray(res)) return res.map(r => sanitizeModelOutput(typeof r === "string" ? r : JSON.stringify(r)));
    if (typeof res === "string") {
      const cleaned = sanitizeModelOutput(res);
      return cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    }
    if (res && res.mom) {
      if (Array.isArray(res.mom)) return res.mom.map(m => sanitizeModelOutput(typeof m === "string" ? m : JSON.stringify(m)));
      return sanitizeModelOutput(String(res.mom)).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    }
    return [sanitizeModelOutput(JSON.stringify(res))];
  } catch (err) {
    console.error("safeGenerateMom error:", err);
    return ["MoM unavailable due to AI error."];
  }
}

async function safeExtractTasks(fullText) {
  try {
    const res = await Promise.resolve(extractTasks(fullText));
    if (Array.isArray(res)) return res;
    if (typeof res === "string") {
      const cleaned = sanitizeModelOutput(res);
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        return [{ task: cleaned.slice(0, 500), assigned_to: "Unassigned", deadline: "" }];
      }
    }
    if (res && Array.isArray(res.tasks)) return res.tasks;
    return [];
  } catch (err) {
    console.error("safeExtractTasks error:", err);
    return [];
  }
}

// ---------- Dashboard HTML template ----------
function createDashboardHTML(data) {
  return `
  <html>
  <head>
    <meta charset="utf-8" />
    <title>IntelliMeet - Meeting Dashboard</title>
    <style>
      body { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial; color:#111; padding:20px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; }
      h1 { color:#0b62ff; margin:0; font-size:22px; }
      .meta { color:#555; font-size:13px; }
      .section { margin-top:18px; }
      .card { background:#fbfdff; border:1px solid #e6f0ff; padding:12px 14px; border-radius:8px; }
      ul { margin:0; padding-left:18px; }
      li { margin-bottom:8px; }
      .two-col { display:flex; gap:16px; flex-wrap:wrap; }
      .col { flex:1; min-width:260px; }
      .small { font-size:13px; color:#666; }
      .transcript-line { margin-bottom:6px; font-size:13px; }
      .footer { margin-top:26px; font-size:12px; color:#777; }
      table { width:100%; border-collapse:collapse; margin-top:8px; }
      table td, table th { padding:6px 8px; border:1px solid #e8eefc; text-align:left; font-size:13px; }
      .badge { background:#eef6ff; color:#0b62ff; padding:4px 8px; border-radius:999px; font-size:12px; display:inline-block; }
      @media print { .two-col { display:block; } }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>IntelliMeet Dashboard</h1>
        <div class="meta">Generated: ${new Date().toLocaleString()}</div>
      </div>
      <div class="small">
        <div><strong>Meeting:</strong> ${escapeHtml(data.meetingTitle || "Untitled meeting")}</div>
        <div><strong>Participants:</strong> ${(data.participants && data.participants.length) || 0}</div>
        <div><strong>Duration:</strong> ${data.analytics?.duration ?? "N/A"} mins</div>
      </div>
    </div>

    <div class="section">
      <h2>Summary</h2>
      <div class="card">${escapeHtml(data.summary || "No summary available.")}</div>
    </div>

    <div class="section two-col">
      <div class="col">
        <h2>Minutes of Meeting (MoM)</h2>
        <div class="card">
          <ul>
            ${Array.isArray(data.mom) && data.mom.length ? data.mom.map(i => `<li>${escapeHtml(i)}</li>`).join("") : "<li>No MoM generated</li>"}
          </ul>
        </div>
      </div>

      <div class="col">
        <h2>Action Items & Tasks</h2>
        <div class="card">
          <strong>Action Items</strong>
          <ul>
            ${Array.isArray(data.actionItems) && data.actionItems.length ? data.actionItems.map(i => `<li>${escapeHtml(i)}</li>`).join("") : "<li>None</li>"}
          </ul>

          <strong style="display:block;margin-top:8px;">Tasks</strong>
          <ul>
            ${Array.isArray(data.tasks) && data.tasks.length ? data.tasks.map(t => `<li>${escapeHtml(t.task || "")}${t.assigned_to ? ` — ${escapeHtml(t.assigned_to)}` : ""}${t.deadline ? ` (by ${escapeHtml(t.deadline)})` : ""}</li>`).join("") : "<li>None</li>"}
          </ul>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Analytics</h2>
      <div class="card">
        <table>
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Participants</td><td>${data.analytics?.participantCount || 0}</td></tr>
          <tr><td>Messages</td><td>${data.analytics?.messageCount || 0}</td></tr>
          <tr><td>Total duration (min)</td><td>${data.analytics?.duration || "N/A"}</td></tr>
          <tr><td>Top speaker</td><td>${escapeHtml(data.analytics?.topSpeaker || "N/A")}</td></tr>
        </table>
      </div>
    </div>

    <div class="section">
      <h2>Important Notes</h2>
      <div class="card">
        <ul>${Array.isArray(data.notes) && data.notes.length ? data.notes.map(n => `<li>${escapeHtml(n)}</li>`).join("") : "<li>No notes</li>"}</ul>
      </div>
    </div>

    <div class="section">
      <h2>Transcript (last 500 lines)</h2>
      <div class="card" style="max-height:320px;overflow:auto;">
        ${Array.isArray(data.transcript) && data.transcript.length
          ? data.transcript.slice(-500).map(line => `<div class="transcript-line"><strong>[${new Date(line.timestamp).toLocaleTimeString()}] ${escapeHtml(line.speaker || "")}:</strong> ${escapeHtml(line.text || "")}</div>`).join("")
          : "<div class='small'>Transcript not available</div>"}
      </div>
    </div>

    <div class="footer">
      Generated by IntelliMeet • <span class="badge">Automated</span>
    </div>
  </body>
  </html>
  `;
}

// ---------- PDF generator ----------
async function generatePDFBuffer(htmlContent) {
  const launchOptions = { headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] };
  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" } });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

// ---------- email helper ----------
async function sendDashboardEmail({ pdfBuffer, htmlBody, subject = "IntelliMeet Dashboard", recipients = [] }) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    console.warn("No recipients provided for dashboard email.");
    return null;
  }

  // dedupe & sanitize
  const unique = Array.from(new Set(recipients.map(r => (r || "").trim()).filter(Boolean)));
  if (unique.length === 0) {
    console.warn("No valid recipient emails after sanitization.");
    return null;
  }

  let transporterConfig;
  if (process.env.SMTP_HOST) {
    transporterConfig = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: (process.env.SMTP_SECURE === "true"),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    };
  } else {
    transporterConfig = { service: "gmail", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } };
  }

  const transporter = nodemailer.createTransport(transporterConfig);
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: unique.join(","),
    subject,
    html: htmlBody || "<p>Your IntelliMeet dashboard is attached.</p>",
    attachments: [{ filename: "intellimeet-dashboard.pdf", content: pdfBuffer }],
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("Dashboard email sent, messageId:", info.messageId, "to:", unique);
  return { info, recipients: unique };
}

// ---------- analytics ----------
function computeAnalytics(transcriptArray) {
  const analytics = { participantCount: 0, messageCount: 0, duration: null, topSpeaker: null };
  if (!Array.isArray(transcriptArray) || transcriptArray.length === 0) return analytics;

  const counts = {};
  let firstTs = Infinity, lastTs = -Infinity;
  transcriptArray.forEach((t) => {
    const speaker = t.speaker || "Unknown";
    counts[speaker] = (counts[speaker] || 0) + 1;
    analytics.messageCount++;
    let ts = Date.parse(t.timestamp);
    if (isNaN(ts)) ts = Number(t.timestamp) || (t.timestamp_unix ? t.timestamp_unix * 1000 : Date.now());
    if (ts < firstTs) firstTs = ts;
    if (ts > lastTs) lastTs = ts;
  });
  analytics.participantCount = Object.keys(counts).length;
  const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
  analytics.topSpeaker = top ? top[0] : null;
  if (firstTs < Infinity && lastTs > -Infinity) analytics.duration = Math.round((lastTs - firstTs) / 60000);
  return analytics;
}

// ---------- endMeetingWorkflow ----------
async function endMeetingWorkflow({ recallPayload = null, meetingId = null } = {}) {
  try {
    console.log("Starting endMeetingWorkflow for meetingId:", meetingId);

    // get transcript from your utils if available, else from local store
    let rawTranscript;
    try {
      rawTranscript = await Promise.resolve(getTranscript()); // your utils.getTranscript() if present
    } catch (e) {
      rawTranscript = getTranscriptLocal();
    }

    let transcriptArray = [];
    if (Array.isArray(rawTranscript) && rawTranscript.length) {
      transcriptArray = rawTranscript;
    } else if (typeof rawTranscript === "string" && rawTranscript.trim() !== "") {
      transcriptArray = rawTranscript.split("\n").map(line => ({ speaker: "", text: line, timestamp: new Date().toISOString(), timestamp_unix: Math.floor(Date.now()/1000) }));
    } else {
      // try local store fallback
      transcriptArray = getTranscriptLocal();
    }

    const fullText = transcriptArray.map(t => t.text || "").join("\n");

    // notes (sanitized)
    const notes = await safeTakenotes(fullText);

    // mom (sanitized)
    const mom = await safeGenerateMom(fullText);

    // tasks (keep old extractor but sanitize)
    const tasks = await safeExtractTasks(fullText);
    const actionItems = Array.isArray(tasks) ? tasks.map(t => t.task || "").filter(Boolean) : [];

    // analytics
    const analytics = computeAnalytics(transcriptArray);

    // participants (use recall payload or stored)
    let participants = [];
    if (recallPayload) {
      const pFromPayload = recallPayload.data?.participants || recallPayload.participants || recallPayload.data?.events || [];
      if (Array.isArray(pFromPayload) && pFromPayload.length) {
        participants = pFromPayload.map(p => (typeof p === "string" ? p : (p.email || p.user_email || p.address || p.name))).filter(Boolean);
      }
    }
    if ((!participants || participants.length === 0) && meetingId) {
      const stored = participantsByMeeting.get(String(meetingId));
      if (stored && stored.length) participants = stored;
    }
    if ((!participants || participants.length === 0) && process.env.DEFAULT_PARTICIPANTS) {
      participants = process.env.DEFAULT_PARTICIPANTS.split(",").map(s => s.trim()).filter(Boolean);
    }
    participants = Array.from(new Set(participants));

    const dashboardData = {
      meetingTitle: recallPayload?.data?.meeting?.title || recallPayload?.meeting_title || "Meeting",
      summary: notes.length ? notes[0] : (mom[0] || "No summary available"),
      mom,
      actionItems,
      tasks,
      analytics,
      notes,
      transcript: transcriptArray,
      participants,
    };

    const html = createDashboardHTML(dashboardData);
    lastDashboardHTML = html;
    lastDashboardTimestamp = Date.now();
    console.log("Dashboard HTML saved for /dashboard");

    const pdfBuffer = await generatePDFBuffer(html);

    // send emails if participants (best-effort)
    let emailResult = null;
    if (participants && participants.length) {
      try {
        emailResult = await sendDashboardEmail({ pdfBuffer, htmlBody: html, subject: `IntelliMeet Dashboard — ${dashboardData.meetingTitle}`, recipients: participants });
        console.log("Dashboard emailed to participants:", participants);
      } catch (e) {
        console.error("Email failed:", e);
      }
    } else {
      console.warn("No participants detected; skipping email (or using DEFAULT_PARTICIPANTS).");
    }

    return { success: true, dashboardData, emailed: emailResult ? emailResult.recipients : [] };
  } catch (err) {
    console.error("endMeetingWorkflow error:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

// ---------- app + socket setup ----------
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.FRONTEND_URL || "http://localhost:3000" } });

app.use(cors());
app.use(express.json({ limit: "16mb" }));
app.use(bodyParser.json({ limit: "16mb" }));

// recall client (if used)
const RECALL_BASE_URL = process.env.RECALL_BASE_URL || "https://api.recall.ai/v1";
const recall = axios.create({
  baseURL: RECALL_BASE_URL,
  headers: { Authorization: `Token ${process.env.RECALL_API_KEY}`, "Content-Type": "application/json" },
  timeout: 30000,
});

// ---------- convenience participant endpoints (frontend can POST attendee emails) ----------
// POST /participants  => { meetingId: "...", emails: ["a@x.com","b@y.com"] }
app.post("/participants", (req, res) => {
  try {
    const { meetingId = "default", emails = [] } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) return res.status(400).json({ error: "emails array required" });
    if (!participantsByMeeting.has(String(meetingId))) participantsByMeeting.set(String(meetingId), []);
    const existing = participantsByMeeting.get(String(meetingId));
    for (const e of emails.map(s => (s || "").trim()).filter(Boolean)) {
      if (!existing.includes(e)) existing.push(e);
    }
    participantsByMeeting.set(String(meetingId), existing);
    console.log("Participants set for", meetingId, existing);
    return res.json({ ok: true, meetingId, participants: existing });
  } catch (err) {
    console.error("participants POST error:", err);
    return res.status(500).json({ error: "failed to add participants" });
  }
});

// GET /participants/:meetingId
app.get("/participants/:meetingId", (req, res) => {
  const id = req.params.meetingId || "default";
  const list = participantsByMeeting.get(String(id)) || [];
  res.json({ meetingId: id, participants: list });
});

// ---------- routes ----------
// deploy bot
app.post("/deploy-bot", async (req, res) => {
  const { meeting_url } = req.body;
  if (!meeting_url) return res.status(400).json({ error: "Meeting URL is required" });
  const platform = detectPlatform(meeting_url);
  if (platform === "Unknown") return res.status(400).json({ error: "Unsupported meeting platform URL" });

  try {
    const response = await recall.post("/bot", {
      meeting_url,
      bot_name: `IntelliMeet (${platform})`,
      recording_config: {
        transcript: { provider: { meeting_captions: {} } },
        realtime_endpoints: [{ type: "webhook", url: process.env.WEBHOOK_URL, events: ["transcript.data"] }],
      },
    });
    console.log(`✅ ${platform} Bot Deployed:`, response.data.id);
    res.json({ message: `${platform} bot deployed`, bot_id: response.data.id });
  } catch (err) {
    console.error("deploy-bot error:", err?.response?.data || err.message || err);
    res.status(500).json({ error: err?.response?.data || err.message || "Deploy failed" });
  }
});

// ---------- IMPORTANT: Finish meeting endpoint (Option A) ----------
// Frontend should POST: { meetingId: "default", emails: ["a@x.com","b@x.com"] }
// The endpoint will store emails and run endMeetingWorkflow using that meetingId.
app.post("/finish-meeting", async (req, res) => {
  try {
    const { meetingId = "default", emails = [] } = req.body || {};

    // Add emails if provided
    if (Array.isArray(emails) && emails.length) {
      if (!participantsByMeeting.has(String(meetingId))) participantsByMeeting.set(String(meetingId), []);
      const existing = participantsByMeeting.get(String(meetingId));
      for (const e of emails.map(s => (s || "").trim()).filter(Boolean)) {
        if (!existing.includes(e)) existing.push(e);
      }
      participantsByMeeting.set(String(meetingId), existing);
      console.log("finish-meeting: added emails for", meetingId, existing);
    }

    // Run end workflow (use recallPayload=null, pass meetingId so participantsByMeeting is consulted)
    const result = await endMeetingWorkflow({ recallPayload: null, meetingId });

    // Attempt to return a url where front-end can download the pdf
    const downloadUrl = result.success ? `/download-pdf?ts=${lastDashboardTimestamp || Date.now()}` : null;

    if (result.success) {
      return res.json({ ok: true, message: "Dashboard generated and emails (if any) sent", downloadUrl, dashboardData: result.dashboardData, emailedTo: result.emailed || [] });
    } else {
      return res.status(500).json({ ok: false, error: result.error || "Failed to generate dashboard" });
    }
  } catch (err) {
    console.error("finish-meeting error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

// serve dashboard
app.get("/dashboard", (req, res) => {
  if (!lastDashboardHTML) return res.status(404).send("No dashboard generated yet.");
  res.set("Content-Type", "text/html");
  res.send(lastDashboardHTML);
});

// download pdf
app.get("/download-pdf", async (req, res) => {
  if (!lastDashboardHTML) return res.status(400).send("Dashboard not generated yet.");
  try {
    const pdfBuffer = await generatePDFBuffer(lastDashboardHTML);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=IntelliMeet_Dashboard.pdf");
    res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF download error:", err);
    res.status(500).send("Failed to generate PDF.");
  }
});

// webhook for realtime transcription & events
app.post("/webhook/transcription", async (req, res) => {
  // Respond quickly to Recall
  res.sendStatus(200);

  const payload = req.body || {};
  const evt = payload.event || payload.type || payload.action || payload.event_type || "";

  console.log("WEBHOOK RECEIVED event:", evt);
  // keep full payload log only when debugging big issues
  // console.log("FULL PAYLOAD:", JSON.stringify(payload, null, 2));

  // participant events
  if (evt === "meeting.participant_joined" || evt === "meeting.participant_left" || evt === "participant.joined" || evt === "participant.left") {
    try {
      const meetingId = payload?.data?.meeting_id || payload?.meeting_id || payload?.data?.meeting?.id || payload?.meeting?.id || "default";
      const participant = payload?.data?.participant || payload?.participant || payload?.data?.user || null;
      if (participant) {
        const email = participant.email || participant.user_email || null;
        const name = participant.name || participant.displayName || participant.username || null;
        if (!participantsByMeeting.has(String(meetingId))) participantsByMeeting.set(String(meetingId), []);
        const existing = participantsByMeeting.get(String(meetingId));
        if (email && !existing.includes(email)) existing.push(email);
        else if (!email && name && !existing.includes(name)) existing.push(name);
        participantsByMeeting.set(String(meetingId), existing);
        console.log("Participants updated for", meetingId, existing);
      }
    } catch (err) {
      console.error("participant event error:", err);
    }
    return;
  }

  // end signals
  if (evt === "bot.left_call" || evt === "recording.done" || evt === "meeting.ended") {
    console.log("Detected end signal — running endMeetingWorkflow");
    const meetingId = payload?.data?.meeting_id || payload?.meeting_id || payload?.data?.meeting?.id || payload?.meeting?.id || null;
    endMeetingWorkflow({ recallPayload: payload, meetingId }).then(r => {
      console.log("endMeetingWorkflow finished:", r);
    }).catch(err => console.error("endMeetingWorkflow error:", err));
    return;
  }

  // transcript data
  if (evt === "transcript.data" || evt === "transcript") {
    try {
      const d = payload?.data?.data || payload?.data || payload;
      if (!d) {
        console.log("No data object in payload; ignoring.");
        return;
      }

      const wordsArray = Array.isArray(d.words) ? d.words : (Array.isArray(d.segments) ? d.segments : null);
      if (!wordsArray || wordsArray.length === 0) {
        console.log("No words/segments found; ignoring.");
        return;
      }

      // Compose text
      const text = wordsArray.map(w => (w.text || "").trim()).filter(Boolean).join(" ").trim();
      if (!text) { console.log("Empty text; ignoring."); return; }

      // Use absolute ISO timestamp if present to avoid NaN in frontend; fall back to now.
      const isoTs = wordsArray[0]?.start_timestamp?.absolute || wordsArray[0]?.start_timestamp?.iso || wordsArray[0]?.start_timestamp || new Date().toISOString();
      const timestampIso = typeof isoTs === "string" ? isoTs : new Date().toISOString();
      const timestampUnix = Math.floor(new Date(timestampIso).getTime() / 1000);

      const speaker = (d.participant && (d.participant.name || d.participant.email)) || d.speaker || "Unknown";

      // Persist both into your utils (preferred) and local backup
      try {
        if (typeof addTranscript === "function") {
          try {
            // If utils.addTranscript expects only text, call accordingly
            addTranscript(text);
          } catch (e) {
            // fallback try to pass object
            try { addTranscript({ speaker, text, timestamp: timestampIso, timestamp_unix: timestampUnix }); } catch (e2) { /* ignore */ }
          }
        }
      } catch (e) {
        console.warn("utils.addTranscript potentially failed:", e);
      }
      // local backup
      addTranscriptLocal({ speaker, text, timestamp: timestampIso, timestamp_unix: timestampUnix });

      const transcript = {
        utterance_id: d.utterance_id || d.id || `auto-${Date.now()}`,
        speaker,
        text,
        timestamp: timestampIso,
        timestamp_unix: timestampUnix,
        is_final: Boolean(d.is_final || d.is_final === undefined)
      };

      // emit to frontend
      io.emit("transcript", transcript);

      console.log("Stored transcript:", { speaker: transcript.speaker, text: transcript.text.slice(0, 120), timestamp_unix: transcript.timestamp_unix });

      // If final, generate notes and emit
      if (transcript.is_final && transcript.text) {
        (async () => {
          try {
            // gather full transcript — prefer utils.getTranscript else local
            let full = "";
            try {
              const gt = await Promise.resolve(getTranscript());
              if (Array.isArray(gt)) full = gt.map(t => (typeof t === "string" ? t : (t.text || ""))).join("\n");
              else if (typeof gt === "string") full = gt;
            } catch (e) {
              const local = getTranscriptLocal();
              full = Array.isArray(local) ? local.map(t => t.text || "").join("\n") : String(local || "");
            }
            const notes = await safeTakenotes(full);
            if (notes && notes.length) io.emit("notes", { notes });
          } catch (err) {
            console.error("Realtime takenotes error:", err);
          }
        })();
      }

    } catch (err) {
      console.error("transcript handler error:", err);
    }
    return;
  }

  console.log("Unhandled webhook event type, ignoring:", evt);
  return;
});

// generate-mom endpoint (frontend uses)
app.post("/generate-mom", async (req, res) => {
  const { transcript } = req.body;
  if (!transcript || transcript.trim() === "") return res.status(400).json({ error: "Transcript is required to generate MoM." });
  try {
    const mom = await safeGenerateMom(transcript);
    return res.json({ mom });
  } catch (err) {
    console.error("generate-mom error:", err);
    return res.status(500).json({ error: "Failed to generate MoM." });
  }
});

// extract-tasks endpoint (frontend uses old extractor)
app.post("/extract-tasks", async (req, res) => {
  try {
    const { transcript } = req.body;
    console.log("Received transcript for /extract-tasks (length):", transcript ? transcript.length : 0);
    if (!transcript) return res.status(400).json({ error: "Transcript is required" });
    const tasks = await safeExtractTasks(transcript);
    console.log("Extracted tasks:", tasks);
    res.json({ tasks });
  } catch (err) {
    console.error("extract-tasks error:", err);
    res.status(500).json({ error: "Failed to extract tasks" });
  }
});

// optionally expose Jira/Trello endpoints or others as you had
app.post("/api/save-to-jira", async (req, res) => {
  try {
    const { task } = req.body;
    if (!task) return res.status(400).json({ error: "Task is required" });
    if (typeof require("./utils/taskExtractor").saveTaskToJira === "function") {
      const created = await require("./utils/taskExtractor").saveTaskToJira(task);
      return res.json({ message: "Created Jira task", task: created });
    }
    return res.status(501).json({ error: "saveToJira not implemented on server" });
  } catch (err) {
    console.error("save-to-jira error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// health
app.get("/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
