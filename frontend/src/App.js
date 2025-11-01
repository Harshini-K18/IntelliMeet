import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import Navbar from "./components/Navbar";
import InputSection from "./components/InputSection";
import StatusMessage from "./components/StatusMessage";
import TranscriptSection from "./components/TranscriptSection";
import Footer from "./components/Footer";
import MomSection from "./components/momsection";
import { handleDownloadTranscript } from "./utils/downloadTranscript";
import SummarySection from "./components/SummarySection";

const socket = io("http://localhost:3001");

const App = () => {
  const [meetingUrl, setMeetingUrl] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [status, setStatus] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const transcriptContainerRef = useRef(null);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
    localStorage.setItem("darkMode", !darkMode);
  };

  // Load dark mode preference from local storage
  useEffect(() => {
    const storedDarkMode = localStorage.getItem("darkMode");
    if (storedDarkMode) {
      setDarkMode(storedDarkMode === "true");
    }
  }, []);

  // Handle real-time transcript updates
  useEffect(() => {
    socket.on("transcript", (transcript) => {
      setTranscripts((prev) => [...prev, transcript]);
    });
    return () => socket.off("transcript");
  }, []);

  // Auto-scroll to the bottom when new transcripts are added
  useEffect(() => {
    const container = transcriptContainerRef.current;
    if (container) {
      const lastChild = container.lastElementChild;
      if (lastChild) {
        lastChild.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [transcripts]);

  // Deploy bot
  const handleDeployBot = async () => {
    if (!meetingUrl) {
      setStatus("Please enter a valid Meeting URL");
      return;
    }
    setStatus("Deploying bot...");
    try {
      const response = await axios.post("http://localhost:3001/deploy-bot", {
        meeting_url: meetingUrl,
      });
      setStatus(`Bot deployed with ID: ${response.data.bot_id}`);
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      setStatus(`Error deploying bot: ${errorMessage}`);
    }
  };

  // Clears all transcripts
  const handleClearTranscript = () => {
    if (window.confirm("Are you sure you want to clear all transcripts?")) {
      setTranscripts([]);
    }
  };
  

  // Copy bot ID to clipboard
  const handleCopyBotId = () => {
    const botId = status.replace("Bot deployed with ID: ", "").trim();
    navigator.clipboard.writeText(botId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

    return (
    <div
      className={`relative min-h-screen ${
        darkMode ? "dark bg-primary text-light" : "bg-light text-primary"
      } transition-colors duration-300`}
    >
      <Navbar darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold mb-6 text-center">
          IntelliMeet Transcription Bot
        </h1>
        <h6 className="text-sm font-normal mb-2 text-center">
          Supports Google Meet, Zoom, and Microsoft Teams
        </h6>
        <InputSection
          meetingUrl={meetingUrl}
          setMeetingUrl={setMeetingUrl}
          handleDeployBot={handleDeployBot}
        />
        <StatusMessage
          status={status}
          handleCopyBotId={handleCopyBotId}
          isCopied={isCopied}
        />
        <TranscriptSection
          transcripts={transcripts}
          transcriptContainerRef={transcriptContainerRef}
          handleDownloadTranscript={handleDownloadTranscript}
          handleClearTranscript={handleClearTranscript}
        />
        <SummarySection /> {/* Add the SummarySection component */}
      </div>
      <Footer />
      <MomSection /> {/* Render the MomSection component */}
    </div>
  );
};

export default App;