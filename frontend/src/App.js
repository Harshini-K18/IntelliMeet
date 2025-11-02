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
import MeetingAnalytics from "./components/MeetingAnalytics";
import ActionItemsSection from "./components/ActionItemsSection";

const socket = io("http://localhost:3001");

const App = () => {
  const [meetingUrl, setMeetingUrl] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [status, setStatus] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const transcriptContainerRef = useRef(null);

  // Apply theme class to the root element
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  // Load theme preference from local storage
  useEffect(() => {
    const storedDarkMode = localStorage.getItem("darkMode");
    if (storedDarkMode) {
      setDarkMode(JSON.parse(storedDarkMode));
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  // Handle real-time transcript updates
  useEffect(() => {
    socket.on("transcript", (transcript) => {
      setTranscripts((prev) => [...prev, transcript]);
    });
    return () => socket.off("transcript");
  }, []);

  // Auto-scroll to bottom when new transcripts arrive
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

  // Clear all transcripts
  const handleClearTranscript = () => {
    if (window.confirm("Are you sure you want to clear all transcripts?")) {
      setTranscripts([]);
    }
  };

  // Copy bot ID
  const handleCopyBotId = () => {
    const botId = status.replace("Bot deployed with ID: ", "").trim();
    navigator.clipboard.writeText(botId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  return (
    <div className="relative min-h-screen bg-light-bg text-light-text dark:bg-dark-bg dark:text-dark-text transition-colors duration-300 font-sans">
      <Navbar toggleDarkMode={toggleDarkMode} darkMode={darkMode} />

      <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold mb-2">
            IntelliMeet Transcription Bot
          </h1>
          <h6 className="text-sm font-normal">
            Supports Google Meet, Zoom, and Microsoft Teams
          </h6>
        </div>

        {/* Input and Status */}
        <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg shadow-md mb-8">
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
        </div>

        {/* Transcripts */}
        <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg shadow-md mb-8">
          <TranscriptSection
            transcripts={transcripts}
            transcriptContainerRef={transcriptContainerRef}
            handleDownloadTranscript={handleDownloadTranscript}
            handleClearTranscript={handleClearTranscript}
          />
        </div>

        {/* Summary */}
        <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg shadow-md mb-8">
          <SummarySection />
        </div>

        {/* Minutes of Meeting */}
        <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg shadow-md mb-8">
          <MomSection />
        </div>

        {/* Meeting Analytics */}
        <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg shadow-md mb-8">
          <MeetingAnalytics transcript={transcripts} />
        </div>

        {/* Action Items */}
        <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg shadow-md mb-8">
          <ActionItemsSection transcript={transcripts} />
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default App;
