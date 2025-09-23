require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { Server } = require("socket.io");
const cors = require("cors");
const { takenotes } = require("./utils/takenotes"); // your notes generator

const app = express();
const server = require("http").createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:3000" },
});

app.use(express.json());
app.use(cors());

// Axios instance for Recall.ai API
const recall = axios.create({
  baseURL: "https://us-west-2.recall.ai/api/v1",
  headers: {
    Authorization: `Token ${process.env.RECALL_API_KEY}`,
    "Content-Type": "application/json",
  },
});

// Deploy bot to Google Meet
app.post("/deploy-bot", async (req, res) => {
  const { meeting_url } = req.body;
  if (!meeting_url) {
    return res.status(400).json({ error: "Meeting URL is required" });
  }

  try {
    const response = await recall.post("/bot", {
      meeting_url,
      bot_name: "IntelliMeet",
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
    res.json({ bot_id: response.data.id });
  } catch (error) {
    res.status(500).json({ error: "Failed to deploy bot" });
  }
});

// Handle transcription webhooks
app.post("/webhook/transcription", (req, res) => {
  const transcriptData = req.body.data?.data || {};
  if (!transcriptData.words || !Array.isArray(transcriptData.words)) {
    return res.status(200).json({});
  }

  const transcript = {
    speaker: transcriptData.participant?.name || "Unknown",
    text: transcriptData.words.map((w) => w.text).join(" "),
    timestamp: transcriptData.words[0].start_timestamp?.relative || 0,
  };

  // Emit transcript to frontend (original behavior)
  io.emit("transcript", transcript);

  // Generate and emit notes if any
  const notes = takenotes(transcript.text);
  if (notes && notes.length > 0) {
    io.emit("notes", { speaker: transcript.speaker, notes });
  }

  res.status(200).json({});
});

// Start server
server.listen(process.env.PORT || 3001, () => {
  console.log("Server running on port 3001");
});
