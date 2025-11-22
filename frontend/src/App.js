import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import Navbar from "./components/Navbar";
import InputSection from "./components/InputSection";
import StatusMessage from "./components/StatusMessage";
import TranscriptSection from "./components/TranscriptSection";
import Footer from "./components/Footer";
import { handleDownloadTranscript } from "./utils/downloadTranscript";
import MeetingAnalytics from "./components/MeetingAnalytics";
import MeetingSummary from "./components/MeetingSummary";
import TaskExtractor from "./components/TaskExtractor";
import FinishMeetingButton from "./FinishMeetingButton";

const socket = io("http://localhost:3001");

const App = () => {
  const [meetingUrl, setMeetingUrl] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [status, setStatus] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const transcriptContainerRef = useRef(null);

  // 🌟 SHOW DOWNLOAD BUTTON ONLY AFTER MEETING FINISHES
  const [dashboardReady, setDashboardReady] = useState(false);

  /* ---------------- DARK MODE ---------------- */
  useEffect(() => {
    const root = document.documentElement;
    darkMode ? root.classList.add("dark") : root.classList.remove("dark");
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    const storedDark = localStorage.getItem("darkMode");
    if (storedDark) setDarkMode(JSON.parse(storedDark));
  }, []);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  /* ---------------- SOCKET TRANSCRIPTS ---------------- */
  useEffect(() => {
    socket.on("transcript", (newTranscript) => {
      if (!newTranscript?.utterance_id) return;

      setTranscripts((prev) => {
        const i = prev.findIndex(
          (t) => t.utterance_id === newTranscript.utterance_id
        );

        if (i !== -1) {
          const updated = [...prev];
          updated[i] = newTranscript;
          return updated;
        }

        return [...prev, newTranscript];
      });
    });

    return () => socket.off("transcript");
  }, []);

  /* ---------------- AUTO-SCROLL ---------------- */
  useEffect(() => {
    const div = transcriptContainerRef.current;
    if (div) div.scrollTop = div.scrollHeight;
  }, [transcripts]);

  /* ---------------- DEPLOY BOT ---------------- */
  const handleDeployBot = async () => {
    if (!meetingUrl) return setStatus("Please enter a valid Meeting URL");

    setStatus("Deploying bot...");

    try {
      const response = await axios.post("http://localhost:3001/deploy-bot", {
        meeting_url: meetingUrl,
      });
      setStatus(`Bot deployed with ID: ${response.data.bot_id}`);
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      setStatus(`Error deploying bot: ${msg}`);
    }
  };

  const handleClearTranscript = () => {
    if (window.confirm("Clear all transcripts?")) setTranscripts([]);
  };

  const handleCopyBotId = () => {
    const botId = status.replace("Bot deployed with ID: ", "").trim();
    navigator.clipboard.writeText(botId);

    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1200);
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text transition-colors duration-300 font-sans">

      <Navbar toggleDarkMode={toggleDarkMode} darkMode={darkMode} />

      <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 flex-grow">

        {/* HEADER */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-light-accent to-light-text dark:from-dark-accent dark:to-white">
            IntelliMeet - Meetings Made Seamless with AI
          </h1>
          <h6 className="text-sm font-normal">
            Supports Google Meet, Zoom, and Microsoft Teams
          </h6>
        </div>

        {/* INPUT + STATUS */}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT SIDE */}
          <div className="lg:col-span-2 flex flex-col gap-8">

            <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg shadow-md">
              <TranscriptSection
                transcripts={transcripts}
                transcriptContainerRef={transcriptContainerRef}
                handleDownloadTranscript={() =>
                  handleDownloadTranscript(transcripts)
                }
                handleClearTranscript={handleClearTranscript}
              />
            </div>

            <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg shadow-md">
              {/* PASS TRANSCRIPTS TO NEW ENHANCED EXTRACTOR */}
              <TaskExtractor transcripts={transcripts} />
            </div>

          </div>

          {/* RIGHT SIDE */}
          <div className="lg:col-span-1 flex flex-col gap-8">

            <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg shadow-md">
              <MeetingAnalytics transcript={transcripts} />
            </div>

            {/* MoM Section - Always visible at the bottom right */}
            <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg shadow-md">
              <MeetingSummary /> {/* Updated component */}
            </div>

          </div>
        </div>
      </div>

      {/* ONLY AFTER DASHBOARD IS GENERATED */}
      {dashboardReady && (
        <div className="flex justify-center mb-6">
          <a
            href="http://localhost:3001/download-pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Download Dashboard PDF
          </a>
        </div>
      )}

      {/* FINISH BUTTON */}
      <div className="flex justify-center mt-6 mb-10">
        <FinishMeetingButton onDashboardGenerated={() => setDashboardReady(true)} />
      </div>

      <Footer />
    </div>
  );
};

export default App;