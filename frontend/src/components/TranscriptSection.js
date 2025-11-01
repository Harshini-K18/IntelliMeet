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
    <div className="my-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-medium text-primary dark:text-light text-center">
          Live Transcript
        </h2>
        <div>
          <button
            onClick={() => handleDownloadTranscript(transcripts)}
            disabled={transcripts.length === 0}
            className={`flex items-center text-primary dark:text-light ${
              transcripts.length === 0
                ? "opacity-50 cursor-not-allowed"
                : "hover:text-accent dark:hover:text-accent"
            } transition-colors duration-200`}
            aria-label="Download"
          >
            <span className="mr-2">Download Transcript</span>
            <ArrowDownTrayIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
       ref={transcriptContainerRef}
        className="bg-light dark:bg-primary shadow-md rounded-lg p-6 max-h-96 overflow-y-auto"
      >
        {transcripts.length === 0 ? (
          <p className="text-secondary dark:text-accent text-center">
            No transcripts yet...
          </p>
        ) : (
          transcripts.map((t, index) => (
            <div
              key={index}
              className="border-b border-secondary last:border-b-0 py-2 px-4 my-2 bg-secondary dark:bg-accent text-light dark:text-primary whitespace-pre-wrap rounded-lg break-words w-fit max-w-[85%] mr-auto"
            >
              <span className="text-light dark:text-primary">
                [{formatTimestamp(t.timestamp)}] {t.speaker}:{" "}
              </span>
              <span className="text-light dark:text-primary">{t.text}</span>
            </div>
          ))
        )}
      </div>

       <div className="flex justify-end mt-4">
        <button
          onClick={handleClearTranscript}
          disabled={transcripts.length === 0}
          className={`py-2 px-4 border rounded-lg ${
            transcripts.length === 0
              ? "opacity-50 cursor-not-allowed text-secondary border-secondary"
              : "border-danger text-danger hover:text-light hover:bg-danger"
          } transition-colors duration-200`}
          aria-label="Clear transcript"
        >
          Clear Transcript
        </button>
      </div>

      {/* Important Notes Section */}
       <div className="mt-8">
        <h2 className="text-xl font-medium text-primary dark:text-light text-center mb-4">
          Important Notes
        </h2>
        {notes.length === 0 ? (
          <p className="text-secondary dark:text-accent text-center">
            No notes yet...
          </p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n, index) => (
              <li
                key={index}
                className="bg-light dark:bg-primary p-4 rounded-lg shadow-md"
              >
                <strong className="block text-primary dark:text-light">
                  {n.speaker}:
                </strong>
                <span className="text-secondary dark:text-accent">{n.notes}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TranscriptSection;
