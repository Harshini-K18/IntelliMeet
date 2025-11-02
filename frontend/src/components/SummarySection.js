import React, { useState } from "react";

const SummarySection = () => {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:3001/summarize-transcript");
      const data = await response.json();
      setSummary(data.summary);
    } catch (error) {
      console.error("Error fetching summary:", error.message);
      setSummary("Error fetching summary.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-center">
      <h2 className="text-2xl font-semibold mb-4 text-light-text dark:text-dark-text">
        Meeting Summary
      </h2>
      <button
        onClick={fetchSummary}
        className="bg-light-accent text-light-bg dark:bg-dark-accent dark:text-dark-bg px-4 py-2 rounded-md hover:opacity-90 transition mb-4"
      >
        {loading ? "Generating Summary..." : "Summarize Meeting"}
      </button>
      <div className="bg-light-bg dark:bg-dark-bg shadow-inner rounded-lg p-4 whitespace-pre-wrap text-left text-light-text dark:text-dark-text">
        {summary || "Click the button to generate a summary of the meeting."}
      </div>
    </div>
  );
};

export default SummarySection;