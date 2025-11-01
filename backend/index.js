require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { Server } = require("socket.io");
const cors = require("cors");
const {
  takenotes,
  generatestructuredminutes,
  summarizetranscript,
  addTranscript,
  storedTranscripts,
} = require("./utils/takeNotes"); // ✅ import your real logic

const app = express();
const server = require("http").createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:3000" },
});

app.use(express.json());
app.use(cors());

// Recall API instance
const recall = axios.create({
  baseURL: "https://us-west-2.recall.ai/api/v1",
  headers: {
    Authorization: `Token ${process.env.RECALL_API_KEY}`,
    "Content-Type": "application/json",
  },
});

// 🧠 Identify meeting platform automatically
function detectPlatform(url) {
  if (url.includes("zoom.us")) return "Zoom";
  if (url.includes("meet.google.com")) return "Google Meet";
  if (url.includes("teams.microsoft.com")) return "Microsoft Teams";
  return "Unknown";
}

// 🚀 Universal Deploy Bot Route
app.post("/deploy-bot", async (req, res) => {
  const { meeting_url } = req.body;
  if (!meeting_url) return res.status(400).json({ error: "Meeting URL is required" });

  const platform = detectPlatform(meeting_url);
  if (platform === "Unknown") {
    return res.status(400).json({ error: "Unsupported meeting platform" });
  }

  try {
    const response = await recall.post("/bot", {
      meeting_url,
      bot_name: `IntelliMeet (${platform})`,
      recording_config: {
        transcript: { provider: { meeting_captions: {} } },
        realtime_endpoints: [
          {
            type: "webhook",
            url: `${process.env.WEBHOOK_URL}/webhook/transcription`,
            events: ["transcript.data"],
          },
        ],
      },
    });

    console.log(`✅ ${platform} Bot Deployed:`, response.data.id);
    res.json({
      message: `${platform} bot deployed successfully`,
      bot_id: response.data.id,
    });
  } catch (error) {
    console.error(`❌ Error deploying ${platform} bot:`, error.response?.data || error.message);
    res.status(500).json({ error: `Failed to deploy ${platform} bot` });
  }
});

// 📝 Handle transcription webhooks
app.post("/webhook/transcription", async (req, res) => {
  const transcriptData = req.body.data?.data || {};
  if (!transcriptData.words || !Array.isArray(transcriptData.words)) {
    return res.status(200).json({});
  }

  const transcript = {
    speaker: transcriptData.participant?.name || "Unknown",
    text: transcriptData.words.map((w) => w.text).join(" "),
    timestamp: transcriptData.words[0].start_timestamp?.relative || 0,
  };

  // ✅ use shared addTranscript function
  addTranscript(transcript.text);

  io.emit("transcript", transcript);

  // ✅ Extract actionable notes
  const notes = takenotes(transcript.text);
  if (notes && notes.length > 0) {
    io.emit("notes", { speaker: transcript.speaker, notes });
  }

  // ✅ Generate cumulative structured minutes
  try {
    const meetingsofminutes = generatestructuredminutes();
    io.emit("meetingsofminutes", { speaker: transcript.speaker, meetingsofminutes });
  } catch (error) {
    console.error("Error generating structured minutes:", error.message);
    io.emit("meetingsofminutes", {
      speaker: transcript.speaker,
      meetingsofminutes: "Error generating structured minutes.",
    });
  }

  // ✅ Generate summary cumulatively
  try {
    const summary = summarizetranscript();
    io.emit("summary", { speaker: transcript.speaker, summary });
  } catch (error) {
    console.error("Error summarizing transcript:", error.message);
    io.emit("summary", { summary: "Error summarizing transcript." });
  }

  res.status(200).json({});
});

// 📝 Summarize the entire meeting transcript
app.get("/summarize-transcript", (req, res) => {
  try {
    const summary = summarizetranscript();
    res.json({ summary });
  } catch (error) {
    console.error("Error summarizing transcript:", error.message);
    res.status(500).json({ error: "Error summarizing transcript." });
  }
});

// 🚦 Start server
server.listen(process.env.PORT || 3001, () => {
  console.log(`Server running on port ${process.env.PORT || 3001}`);
});
