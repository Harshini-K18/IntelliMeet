import React, { useState, useEffect } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { io } from "socket.io-client";
import { formatTimestamp } from "../utils/formatTimestamp";

const TranscriptSection = ({
  transcripts,
  transcriptContainerRef,
  handleDownloadTranscript,
  handleClearTranscript,
}) => {
  const [notes, setNotes] = useState([]);

  // Socket for notes
  useEffect(() => {
    const socket = io("http://localhost:3001");

    socket.on("notes", (data) => {
      if (data && data.notes && data.notes.trim() !== "") {
        setNotes((prev) => [...prev, data]);
      }
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-medium text-light-text dark:text-dark-text text-center">
          Live Transcript
        </h2>
        <div>
          <button
            onClick={() => handleDownloadTranscript(transcripts)}
            disabled={transcripts.length === 0}
            className="flex items-center text-light-accent dark:text-dark-accent disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-colors duration-200"
            aria-label="Download"
          >
            <span className="mr-2">Download Transcript</span>
            <ArrowDownTrayIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={transcriptContainerRef}
        className="bg-light-bg dark:bg-dark-bg shadow-inner rounded-lg p-4 max-h-96 overflow-y-auto"
      >
        {transcripts.length === 0 ? (
          <p className="text-light-text dark:text-dark-text text-center">
            No transcripts yet...
          </p>
        ) : (
          transcripts.map((t, index) => (
            <div
              key={index}
              className="border-b border-light-accent dark:border-dark-accent last:border-b-0 py-2 px-4 my-2 bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text whitespace-pre-wrap rounded-lg break-words w-fit max-w-[85%] mr-auto"
            >
              <span className="font-semibold">
                [{formatTimestamp(t.timestamp)}] {t.speaker}:{" "}
              </span>
              <span>{t.text}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={handleClearTranscript}
          disabled={transcripts.length === 0}
          className="py-2 px-4 border rounded-lg border-danger text-danger disabled:opacity-50 disabled:cursor-not-allowed hover:text-white hover:bg-danger transition-colors duration-200"
          aria-label="Clear transcript"
        >
          Clear Transcript
        </button>
      </div>

      {/* Important Notes Section */}
      <div className="mt-8">
        <h2 className="text-xl font-medium text-light-text dark:text-dark-text text-center mb-4">
          Important Notes
        </h2>
        {notes.length === 0 ? (
          <p className="text-light-text dark:text-dark-text text-center">
            No notes yet...
          </p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n, index) => (
              <li
                key={index}
                className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg shadow-inner"
              >
                <strong className="block text-light-text dark:text-dark-text">
                  {n.speaker}:
                </strong>
                <span className="text-light-text dark:text-dark-text">{n.notes}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TranscriptSection;