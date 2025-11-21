import React, { useState } from "react";

const MeetingSummary = () => {
  const [transcript, setTranscript] = useState("");
  const [mom, setMom] = useState("");
  const [loading, setLoading] = useState(false);

  /* --------------------------------------------
     GENERATE MOM FROM BACKEND
  --------------------------------------------- */
  const handleGenerateSummary = async () => {
    if (!transcript.trim()) {
      alert("Please enter a transcript.");
      return;
    }

    setLoading(true);
    setMom("");

    try {
      const response = await fetch("http://localhost:3001/generate-mom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate MoM.");
      }

      const data = await response.json();

      // 🔥 FIX: BACKEND RETURNS ARRAY → convert to string
      let raw = "";
      if (Array.isArray(data.mom)) {
        raw = data.mom.join("\n");
      } else {
        raw = data.mom || "Failed to generate MoM.";
      }

      const html = transformMomToHtml(raw);
      setMom(html);

    } catch (error) {
      console.error("Error generating MoM:", error.message);
      setMom(`<p><strong>Error:</strong> Could not generate the meeting summary.</p>`);
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------
     FORMAT MOM TEXT INTO HTML
  --------------------------------------------- */
  const transformMomToHtml = (text) => {
    if (!text) return "";

    let out = text;

    // Highlight speaker lines like "[00:01] Harshini K: ..."
    out = out.replace(
      /(\[?\d{1,2}:\d{2}\]?\s*)([A-Za-z0-9 ._-]{2,40}):/g,
      (m, time, speaker) => `${time}<strong>${speaker}:</strong>`
    );

    // Bold standard MoM labels
    out = out.replace(
      /(^|\n)(\s*)(Date:|Time:|Attendees:|Topic:|Key Points:|Decisions:|Action Items:)/gi,
      (m, nl, sp, label) => `${nl}${sp}<strong>${label}</strong>`
    );

    // Bold markdown-like headings
    out = out.replace(/^\s*\*\*(.+?)\*\*/gm, (m, h) => `<strong>${h.trim()}</strong>`);

    // Convert newlines to <br/>
    out = out.replace(/\n{3,}/g, "\n\n");
    out = out.split("\n").map((line) => (line === "" ? "<br/>" : line)).join("<br/>");

    return out;
  };

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-semibold mb-4 text-center">Generate Minutes of Meeting</h2>

      <textarea
        className="w-full p-4 border rounded-md mb-4 bg-light-bg text-light-text 
                   dark:bg-dark-bg dark:text-dark-text dark:border-gray-600"
        rows="6"
        placeholder="Paste the meeting transcript here..."
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
      ></textarea>

      <button
        onClick={handleGenerateSummary}
        className="bg-light-accent text-light-bg px-4 py-2 rounded-md 
                   hover:bg-opacity-90 transition disabled:opacity-60 
                   dark:bg-dark-accent dark:text-dark-bg"
        disabled={loading}
      >
        {loading ? "Generating..." : "Generate MOM"}
      </button>

      {mom && (
        <div className="bg-light-card dark:bg-dark-card p-4 rounded-md shadow-md mt-4 whitespace-pre-wrap">
          <h3 className="text-xl font-bold mb-2">Minutes of Meeting:</h3>
          <div dangerouslySetInnerHTML={{ __html: mom }} />
        </div>
      )}
    </div>
  );
};

export default MeetingSummary;
