import React, { useState } from "react";

export default function SummarySection({ transcripts }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  // Convert transcripts array into plain text
  const transcriptText = transcripts
    .map(t => `${t.speaker}: ${t.text}`)
    .join("\n");

  async function handleGenerate() {
    setLoading(true);
    try {
      const resp = await fetch("http://localhost:3001/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptText }),
      });

      const data = await resp.json();
      setSummary(data);
    } catch (e) {
      console.error("generate summary error", e);
      setSummary({ summary: "Failed to generate summary." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="bg-light-accent text-light-bg dark:bg-dark-accent dark:text-dark-bg px-4 py-2 rounded-md hover:opacity-90 transition mb-4"
      >
        {loading ? "Generating…" : "Generate Summary"}
      </button>

      {summary && (
        <div className="bg-light-bg dark:bg-dark-bg shadow-inner rounded-lg p-4 whitespace-pre-wrap text-left text-light-text dark:text-dark-text">
          <h4 className="font-semibold mb-2">Summary</h4>
          <p>{summary.summary || JSON.stringify(summary)}</p>
        </div>
      )}
    </div>
  );
}
