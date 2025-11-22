// index.js — Backend with Jira integration + server-side charts embedded into dashboard
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
const path = require("path");

// Chart rendering
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");

// ---------- use your existing utils (do not overwrite) ----------
const { extractTasks } = require("./utils/taskExtractor");
const takeNotesUtils = require("./utils/takeNotes");
const addTranscript = takeNotesUtils.addTranscript;
const getTranscript = takeNotesUtils.getTranscript;
const takenotes = takeNotesUtils.takenotes;
const generateMomWithOllama = takeNotesUtils.generateMomWithOllama;

// ---------- in-memory storage ----------
let TRANSCRIPT_STORE = []; // local backup
const participantsByMeeting = new Map();
let lastDashboardHTML = "";
let lastDashboardTimestamp = null;

// ---------- helper to reference uploaded file (dev instruction) ----------
const UPLOADED_FILE_PATH = "/mnt/data/de8939b0-df46-45c9-8fb3-aba10a6b6250.png";

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

// local transcript backup helpers
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
function getTranscriptLocal() { return TRANSCRIPT_STORE; }
function clearTranscriptLocal() { TRANSCRIPT_STORE = []; }

// ---------- model-output sanitizers & wrappers ----------
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
      } catch (e){}
    }
    if (collected.trim().length) return collected.replace(/\s+/g, " ").trim();
  }
  const filtered = lines.filter(l => !(l.startsWith("{") && (l.includes('"model"') || l.includes('"done"'))));
  if (filtered.length > 0) return filtered.join(" ").replace(/\s+/g, " ").trim();
  return raw.replace(/\s+/g, " ").trim();
}

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

// ---------- Chart generation ----------
// We'll build three charts:
//  - bar chart: messages per speaker (counts)
//  - pie chart: share of messages per speaker
//  - line chart: messages over time (per minute)
const chartWidth = 800;
const chartHeight = 420;
const chartBackground = 'white';

const chartRenderer = new ChartJSNodeCanvas({
  width: chartWidth,
  height: chartHeight,
  backgroundColour: chartBackground,
  chartCallback: (ChartJS) => {
    // you may register plugins or fonts here if needed
  },
});

function aggregateSpeakerCounts(transcriptArray) {
  const counts = {};
  transcriptArray.forEach(t => {
    const speaker = (t.speaker || "Unknown").toString();
    counts[speaker] = (counts[speaker] || 0) + 1;
  });
  return counts;
}

function aggregateMessagesOverTime(transcriptArray) {
  // Group messages by minute (YYYY-MM-DDTHH:MM)
  const buckets = {};
  transcriptArray.forEach(t => {
    const ts = t.timestamp ? new Date(t.timestamp) : new Date();
    if (isNaN(ts.getTime())) return;
    const key = ts.toISOString().slice(0,16); // YYYY-MM-DDTHH:MM
    buckets[key] = (buckets[key] || 0) + 1;
  });
  const sortedKeys = Object.keys(buckets).sort();
  return { keys: sortedKeys, values: sortedKeys.map(k => buckets[k]) };
}

async function generateChartsImages(transcriptArray = []) {
  // Prepare data
  const speakerCounts = aggregateSpeakerCounts(transcriptArray);
  const speakers = Object.keys(speakerCounts);
  const counts = speakers.map(s => speakerCounts[s]);

  // Bar chart config (messages per speaker)
  const barConfig = {
    type: 'bar',
    data: {
      labels: speakers,
      datasets: [{
        label: 'Messages',
        data: counts,
        // default colors left to Chart.js; node canvas will pick defaults
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: 'Speaker' } },
        y: { title: { display: true, text: 'Messages' }, beginAtZero: true }
      }
    }
  };

  // Pie chart config (share)
  const pieConfig = {
    type: 'pie',
    data: {
      labels: speakers,
      datasets: [{
        data: counts,
      }]
    },
    options: {
      plugins: { legend: { position: 'right' } }
    }
  };

  // Line chart config (activity over time)
  const timeAgg = aggregateMessagesOverTime(transcriptArray);
  const lineConfig = {
    type: 'line',
    data: {
      labels: timeAgg.keys,
      datasets: [{
        label: 'Messages per minute',
        data: timeAgg.values,
        fill: false,
        tension: 0.2
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: 'Time (YYYY-MM-DDTHH:MM)' } },
        y: { title: { display: true, text: 'Messages' }, beginAtZero: true }
      }
    }
  };

  // Render to buffers (PNG) and convert to base64
  const barBuffer = await chartRenderer.renderToBuffer(barConfig);
  const pieBuffer = await chartRenderer.renderToBuffer(pieConfig);
  const lineBuffer = await chartRenderer.renderToBuffer(lineConfig);

  return {
    barBase64: barBuffer.toString('base64'),
    pieBase64: pieBuffer.toString('base64'),
    lineBase64: lineBuffer.toString('base64'),
  };
}

// ---------- Dashboard HTML template & PDF generator ----------
function formatMomLine(text) {
  if (!text) return "";

  let t = text;

  // Convert markdown bold (**text**) → <strong>text</strong>
  t = t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Convert markdown headings (## Title) → <strong>Title</strong>
  t = t.replace(/^#+\s*(.*)/g, "<strong>$1</strong>");

  // Convert "- bullet" → clean bullet text
  t = t.replace(/^-+\s*/g, "");

  // Remove backticks or artifacts
  t = t.replace(/`+/g, "");

  t = t.trim();

  return `<li>${t}</li>`;
}

function createDashboardHTML(data, charts = {}) {
  // charts: { barBase64, pieBase64, lineBase64 }
  const logoImgTag = UPLOADED_FILE_PATH ? `<img src="file://${escapeHtml(UPLOADED_FILE_PATH)}" alt="logo" style="height:48px;margin-left:10px;border-radius:6px;object-fit:cover;" />` : "";

  const chartsHtml = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:14px;">
      <div style="flex:1;min-width:260px">
        <h3 style="margin:0 0 6px 0;font-size:14px">Messages per speaker</h3>
        ${charts.barBase64 ? `<img style="max-width:100%;" src="data:image/png;base64,${charts.barBase64}" />` : "<div style='color:#666'>No data</div>"}
      </div>
      <div style="flex:1;min-width:260px">
        <h3 style="margin:0 0 6px 0;font-size:14px">Share by speaker</h3>
        ${charts.pieBase64 ? `<img style="max-width:100%;" src="data:image/png;base64,${charts.pieBase64}" />` : "<div style='color:#666'>No data</div>"}
      </div>
      <div style="width:100%;margin-top:12px">
        <h3 style="margin:0 0 6px 0;font-size:14px">Activity over time</h3>
        ${charts.lineBase64 ? `<img style="max-width:100%;" src="data:image/png;base64,${charts.lineBase64}" />` : "<div style='color:#666'>No data</div>"}
      </div>
    </div>
  `;

  // previous HTML template with charts inserted
  return `
  <html>
  <head>
    <meta charset="utf-8" />
    <title>IntelliMeet - Meeting Dashboard</title>
    <style>
      body { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial; color:#111; padding:20px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; }
      h1 { color:#0b62ff; margin:0; font-size:22px; display:inline-block; }
      .meta { color:#555; font-size:13px; }
      .section { margin-top:18px; }
      .card { background:#fbfdff; border:1px solid #e6f0ff; padding:12px 14px; border-radius:8px; }
      ul { margin:0; padding-left:18px; } li { margin-bottom:8px; }
      .two-col { display:flex; gap:16px; flex-wrap:wrap; } .col { flex:1; min-width:260px; }
      .small { font-size:13px; color:#666; } .transcript-line { margin-bottom:6px; font-size:13px; }
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
        <div style="display:flex;align-items:center;gap:8px">
          <h1>IntelliMeet Dashboard</h1>
        </div>
        <div class="meta">Generated: ${new Date().toLocaleString()}</div>
      </div>
      <div class="small">
        <div><strong>Meeting:</strong> ${escapeHtml(data.meetingTitle || "Untitled meeting")}</div>
        <div><strong>Participants:</strong> ${(data.participants && data.participants.length) || 0}</div>
        <div><strong>Duration:</strong> ${data.analytics?.duration ?? "N/A"} mins</div>
      </div>
    </div>

    <!-- REMOVED SUMMARY SECTION -->

    <div class="section two-col">
  <div class="col">
    <h2>Minutes of Meeting (MoM)</h2>
    <div class="card">
      <ul>
        ${
          Array.isArray(data.mom) && data.mom.length
            ? data.mom
                .map(m => formatMomLine(m))
                .join("")
            : "<li>No MoM generated</li>"
        }
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

    <!-- ANALYTICS SECTION -->
    <div class="section">
      <h2>Analytics</h2>
      <div class="card">
        ${chartsHtml}
        <table style="margin-top:12px;">
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Participants</td><td>${data.analytics?.participantCount || 0}</td></tr>
          <tr><td>Messages</td><td>${data.analytics?.messageCount || 0}</td></tr>
          <tr><td>Total duration (min)</td><td>${data.analytics?.duration || "N/A"}</td></tr>
          <tr><td>Top speaker</td><td>${escapeHtml(data.analytics?.topSpeaker || "N/A")}</td></tr>
        </table>
      </div>
    </div>

    <!-- REMOVED IMPORTANT NOTES SECTION -->

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

// ---------- Email helper ----------
async function sendDashboardEmail({ pdfBuffer, htmlBody, subject = "IntelliMeet Dashboard", recipients = [] }) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    console.warn("No recipients provided for dashboard email.");
    return null;
  }

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
  analytics.rawCounts = counts;
  return analytics;
}

// ---------- endMeetingWorkflow ----------
async function endMeetingWorkflow({ recallPayload = null, meetingId = null } = {}) {
  try {
    console.log("Starting endMeetingWorkflow for meetingId:", meetingId);

    // get transcript
    let rawTranscript;
    try {
      rawTranscript = await Promise.resolve(getTranscript());
    } catch (e) {
      rawTranscript = getTranscriptLocal();
    }

    let transcriptArray = [];
    if (Array.isArray(rawTranscript) && rawTranscript.length) {
      transcriptArray = rawTranscript;
    } else if (typeof rawTranscript === "string" && rawTranscript.trim() !== "") {
      transcriptArray = rawTranscript.split("\n").map(line => ({ speaker: "", text: line, timestamp: new Date().toISOString(), timestamp_unix: Math.floor(Date.now()/1000) }));
    } else {
      transcriptArray = getTranscriptLocal();
    }

    const fullText = transcriptArray.map(t => t.text || "").join("\n");

    const notes = await safeTakenotes(fullText);
    const mom = await safeGenerateMom(fullText);

    // Use frontend-provided tasks (if any) else run extractor
    let tasks = [];
    try {
      if (Array.isArray(FRONTEND_TASKS) && FRONTEND_TASKS.length) {
        tasks = FRONTEND_TASKS;
      } else {
        tasks = await safeExtractTasks(fullText);
      }
    } catch (err) {
      console.error("task extraction error:", err);
      tasks = [];
    }

    const actionItems = Array.isArray(tasks) ? tasks.map(t => t.task || "").filter(Boolean) : [];
    const analytics = computeAnalytics(transcriptArray);

    // Generate charts (server-side) and inject base64 images
    let charts = {};
    try {
      charts = await generateChartsImages(transcriptArray || []);
    } catch (err) {
      console.error("chart generation error:", err);
      charts = {};
    }

    // participants (recallPayload -> stored -> env default)
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

    const html = createDashboardHTML(dashboardData, charts);
    lastDashboardHTML = html;
    lastDashboardTimestamp = Date.now();
    console.log("Dashboard HTML saved for /dashboard");

    const pdfBuffer = await generatePDFBuffer(html);

    // send emails if participants
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

    // Clear FRONTEND_TASKS after use (optional)
    FRONTEND_TASKS = [];

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

// recall client
const RECALL_BASE_URL = process.env.RECALL_BASE_URL || "https://api.recall.ai/v1";
const recall = axios.create({
  baseURL: RECALL_BASE_URL,
  headers: { Authorization: `Token ${process.env.RECALL_API_KEY}`, "Content-Type": "application/json" },
  timeout: 30000,
});

// ---------- convenience participant endpoints ----------
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
app.get("/participants/:meetingId", (req, res) => {
  const id = req.params.meetingId || "default";
  const list = participantsByMeeting.get(String(id)) || [];
  res.json({ meetingId: id, participants: list });
});

// ---------- routes (deploy-bot etc) ----------
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

// ---------- Finish meeting endpoint ----------
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

    const result = await endMeetingWorkflow({ recallPayload: null, meetingId });
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

// webhook (transcription & participant events)
app.post("/webhook/transcription", async (req, res) => {
  res.sendStatus(200);
  const payload = req.body || {};
  const evt = payload.event || payload.type || payload.action || payload.event_type || "";

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
      if (!d) { console.log("No data object in payload; ignoring."); return; }
      const wordsArray = Array.isArray(d.words) ? d.words : (Array.isArray(d.segments) ? d.segments : null);
      if (!wordsArray || wordsArray.length === 0) { console.log("No words/segments found; ignoring."); return; }

      const text = wordsArray.map(w => (w.text || "").trim()).filter(Boolean).join(" ").trim();
      if (!text) { console.log("Empty text; ignoring."); return; }

      const isoTs = wordsArray[0]?.start_timestamp?.absolute || wordsArray[0]?.start_timestamp?.iso || wordsArray[0]?.start_timestamp || new Date().toISOString();
      const timestampIso = typeof isoTs === "string" ? isoTs : new Date().toISOString();
      const timestampUnix = Math.floor(new Date(timestampIso).getTime() / 1000);

      const speaker = (d.participant && (d.participant.name || d.participant.email)) || d.speaker || "Unknown";

      try {
        if (typeof addTranscript === "function") {
          try { addTranscript(text); } catch (e) { try { addTranscript({ speaker, text, timestamp: timestampIso, timestamp_unix: timestampUnix }); } catch (e2) {} }
        }
      } catch (e) { console.warn("utils.addTranscript potentially failed:", e); }

      addTranscriptLocal({ speaker, text, timestamp: timestampIso, timestamp_unix: timestampUnix });

      const transcript = {
        utterance_id: d.utterance_id || d.id || `auto-${Date.now()}`,
        speaker,
        text,
        timestamp: timestampIso,
        timestamp_unix: timestampUnix,
        is_final: Boolean(d.is_final || d.is_final === undefined)
      };

      io.emit("transcript", transcript);
      console.log("Stored transcript:", { speaker: transcript.speaker, text: transcript.text.slice(0, 120), timestamp_unix: transcript.timestamp_unix });

      if (transcript.is_final && transcript.text) {
        (async () => {
          try {
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

/* -----------------------
   MoM generation endpoint
------------------------*/
app.post("/generate-mom", async (req, res) => {
  const { transcript } = req.body;
  if (!transcript || transcript.trim() === "") {
    return res.status(400).json({ error: "Transcript is required to generate MoM." });
  }

  try {
    const mom = await generateMomWithOllama(transcript);
    return res.json({ mom });
  } catch (error) {
    console.error("Error generating MoM:", error.message || error);
    return res.status(500).json({ error: "Failed to generate MoM. Please try again later." });
  }
});

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

let FRONTEND_TASKS = [];

app.post("/api/store-frontend-tasks", (req, res) => {
  const { tasks } = req.body;
  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: "tasks must be an array" });
  }
  FRONTEND_TASKS = tasks;
  console.log("Stored FRONTEND tasks:", FRONTEND_TASKS.length);
  res.json({ ok: true });
});

// ---------- Jira helper (fallback) ----------
const JIRA_BASE = (process.env.JIRA_DOMAIN && process.env.JIRA_DOMAIN.startsWith("http")) ? process.env.JIRA_DOMAIN.replace(/\/+$/, "") : (process.env.JIRA_DOMAIN ? `https://${process.env.JIRA_DOMAIN.replace(/^https?:\/\//, "")}` : null);
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY || "SCRUM";
const JIRA_EMAIL = process.env.JIRA_EMAIL || process.env.JIRA_USER;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

function jiraAuthHeader() {
  if (!JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_BASE) return null;
  const token = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  return `Basic ${token}`;
}

async function createJiraIssueFallback(task) {
  if (!JIRA_BASE || !JIRA_PROJECT_KEY || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new Error("Jira environment variables not set (JIRA_DOMAIN, JIRA_PROJECT_KEY, JIRA_EMAIL, JIRA_API_TOKEN).");
  }

  const summary = (task.task || "").slice(0, 140) || "Meeting task";
  const descriptionParts = [];
  if (task.original_line) descriptionParts.push(`**Source:** ${task.original_line}`);
  if (task.assigned_to) descriptionParts.push(`**Owner:** ${task.assigned_to}`);
  if (task.deadline) descriptionParts.push(`**Deadline:** ${task.deadline}`);
  if (task.labels && Array.isArray(task.labels) && task.labels.length) descriptionParts.push(`**Labels:** ${task.labels.join(", ")}`);
  const description = (task.description || descriptionParts.join("\n\n") || "").trim();

  const payload = {
    fields: {
      project: { key: JIRA_PROJECT_KEY },
      summary,
      description: description || "Created from IntelliMeet task.",
      issuetype: { name: "Task" }
    }
  };

  const url = `${JIRA_BASE}/rest/api/3/issue`;
  const headers = {
    "Authorization": jiraAuthHeader(),
    "Accept": "application/json",
    "Content-Type": "application/json"
  };

  const resp = await axios.post(url, payload, { headers, timeout: 20000 });
  return resp.data; // contains key, id, self
}

// If the user-provided taskExtractor exports saveTaskToJira, prefer it. Otherwise use fallback.
let externalSaveToJira = null;
try { externalSaveToJira = require("./utils/taskExtractor").saveTaskToJira; } catch (e) { externalSaveToJira = null; }

// ---------- Jira endpoints ----------
app.post("/api/save-to-jira", async (req, res) => {
  try {
    const { task } = req.body;
    if (!task) return res.status(400).json({ error: "Task is required in body" });

    let result;
    if (typeof externalSaveToJira === "function") {
      result = await externalSaveToJira(task);
      return res.json({ ok: true, created: result });
    } else {
      const created = await createJiraIssueFallback(task);
      return res.json({ ok: true, created });
    }
  } catch (err) {
    console.error("save-to-jira error:", err?.response?.data || err?.message || err);
    return res.status(500).json({ ok: false, error: err?.response?.data || err?.message || String(err) });
  }
});

app.post("/api/save-multiple-to-jira", async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks) || tasks.length === 0) return res.status(400).json({ error: "tasks array required" });

    const results = [];
    for (const t of tasks) {
      try {
        if (typeof externalSaveToJira === "function") {
          const created = await externalSaveToJira(t);
          results.push({ ok: true, created });
        } else {
          const created = await createJiraIssueFallback(t);
          results.push({ ok: true, created });
        }
      } catch (err) {
        results.push({ ok: false, error: err?.response?.data || err?.message || String(err) });
      }
    }

    return res.json({ ok: true, results });
  } catch (err) {
    console.error("save-multiple-to-jira error:", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// health
app.get("/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log("Uploaded file path (dev):", UPLOADED_FILE_PATH);
});
