import React from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { formatTimestamp } from "../utils/formatTimestamp";

export default function TranscriptSection({
  transcripts,
  transcriptContainerRef,
  handleDownloadTranscript,
  handleClearTranscript,
}) {

  // COPY FUNCTION
  async function handleCopyTranscripts() {
    const text = (Array.isArray(transcripts) ? transcripts : [])
      .map(
        (t) =>
          `${t.speaker ? t.speaker + ": " : ""}${t.text || ""}`
      )
      .join("\n");

    if (!text) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch (err) {
      console.error("copy transcripts error", err);
    }
  }

  return (
    <div>
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-black dark:text-[#e790adff]">
          Live Transcript
        </h2>

        <div>
          <button
            onClick={() => handleDownloadTranscript(transcripts)}
            disabled={transcripts.length === 0}
            className="flex items-center text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition duration-200 font-medium"
          >
            <span className="mr-2">Download Transcript</span>
            <ArrowDownTrayIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* TRANSCRIPT BOX */}
      <div
        ref={transcriptContainerRef}
        className="bg-light-bg dark:bg-gray-900 shadow-inner rounded-lg p-4 max-h-96 overflow-y-auto"
      >
        {transcripts.length === 0 ? (
          <p className="text-light-text dark:text-dark-text text-center">
            No transcripts yet...
          </p>
        ) : (
          transcripts.map((t, index) => (
            <div
              key={index}
              className="border-b border-light-accent dark:border-dark-accent last:border-b-0 py-2 px-4 my-2 bg-light-accent dark:bg-dark-accent text-black dark:text-black whitespace-pre-wrap rounded-lg break-words w-fit max-w-[85%] mr-auto"
            >
              <span className="font-semibold">
                [{formatTimestamp(t.timestamp)}] {t.speaker}:{" "}
              </span>
              <span>{t.text}</span>
            </div>
          ))
        )}
      </div>

      {/* BUTTON ROW */}
      <div className="flex justify-end gap-3 mt-4">

        {/* COPY BUTTON — BLUE */}
        <button
          onClick={handleCopyTranscripts}
          disabled={transcripts.length === 0}
          className="py-2 px-4 bg-[#f69d9b] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f69d9b]/90 transition duration-200 font-medium"
        >
          Copy Transcript
        </button>

        {/* CLEAR BUTTON — SAME BLUE STYLE */}
        <button
          onClick={handleClearTranscript}
          disabled={transcripts.length === 0}
          className="py-2 px-4 bg-[#f69d9b] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f69d9b]/90 transition duration-200 font-medium"
        >
          Clear Transcript
        </button>

      </div>
    </div>
  );
}