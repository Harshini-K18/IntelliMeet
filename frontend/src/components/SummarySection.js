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
    <div className="mt-8">
      <h2 className="text-2xl font-semibold mb-4 text-center text-primary dark:text-light">Meeting Summary</h2>
      <button
        onClick={fetchSummary}
        className="bg-secondary text-light px-4 py-2 rounded-md hover:bg-primary transition"
      >
        {loading ? "Generating Summary..." : "Summarize Meeting"}
      </button>
      <div className="bg-light dark:bg-primary p-4 rounded-md shadow-md mt-4 whitespace-pre-wrap text-primary dark:text-light">
        {summary || "Click the button to generate a summary of the meeting."}
      </div>
    </div>
  );
};

export default SummarySection;