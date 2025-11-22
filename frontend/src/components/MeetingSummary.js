import React, { useState } from "react";

const MeetingSummary = () => {
  const [transcript, setTranscript] = useState("");
  const [mom, setMom] = useState("");
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState("");

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
        throw new Error(err.error || "Failed to generate the meeting summary.");
      }

      const data = await response.json();
      const raw = data.mom || "Failed to generate the meeting summary.";
      const html = transformMomToHtml(raw);
      setMom(html);
    } catch (error) {
      console.error("Error generating meeting summary:", error.message);
      setMom(`<p><strong>Error:</strong> Failed to generate the meeting summary.</p>`);
    } finally {
      setLoading(false);
    }
  };

  const transformMomToHtml = (text) => {
    if (!text) return "";
    let out = text;

    out = out.replace(
      /(\[?\d{1,2}:\d{2}\]?\s*)([A-Za-z0-9 ._-]{2,40}):/g,
      (m, time, speaker) => `${time}<strong>${speaker}:</strong>`
    );

    out = out.replace(
      /(^|\n)(\s*)(Date:|Time:|Attendees:|Topic:|Key Points:|Decisions Made:|Action Items:)/gi,
      (m, nl, sp, label) => `${nl}${sp}<strong>${label}</strong>`
    );

    out = out.replace(/^\s*\*\*(.+?)\*\*/gm, (m, h) => `\n<strong>${h.trim()}</strong>\n`);
    out = out.replace(/^(.+?):\s*$/gm, (m, h) => `<strong>${h.trim()}:</strong>\n`);

    out = out.replace(/\n{3,}/g, "\n\n");
    out = out.split("\n").map(line => line === "" ? "<br/>" : line).join("<br/>");

    return out;
  };

  // 👍 New Function — Finish Meeting & Generate Dashboard
  const handleFinishMeeting = async () => {
    if (!transcript.trim()) {
      alert("Transcript is required for generating dashboard!");
      return;
    }

    const emailList = emails
      .split(",")
      .map(e => e.trim())
      .filter(Boolean);

    try {
      const response = await fetch("http://localhost:3001/finish-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: "default",
          transcript,
          emails: emailList
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        alert("Dashboard generation failed: " + (data.error || "Unknown error"));
        return;
      }

      alert("Dashboard generated successfully!");

      if (data.downloadUrl) {
        window.open(`http://localhost:3001${data.downloadUrl}`, "_blank");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to finish meeting");
    }
  };


  return (
    <div className="mt-8">
      <h2 className="text-2xl font-semibold mb-4 text-center">Generate Minutes of Meeting</h2>

      <textarea
        className="w-full p-4 border rounded-md mb-4"
        rows="6"
        placeholder="Paste the meeting transcript here..."
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
      ></textarea>

      <button
        onClick={handleGenerateSummary}
        className="bg-blue-600 text-white px-4 py-2 rounded-md"
        disabled={loading}
      >
        {loading ? "Generating..." : "Generate MOM"}
      </button>

      {mom && (
        <div className="bg-gray-100 p-4 rounded-md shadow-md mt-4 whitespace-pre-wrap">
          <h3 className="text-xl font-bold mb-2">Minutes of Meeting:</h3>
          <div dangerouslySetInnerHTML={{ __html: mom }} />
        </div>
      )}

      {/* NEW — Email input for dashboard */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Emails for Dashboard PDF</h3>
        <input
          type="text"
          className="w-full p-3 border rounded mb-3"
          placeholder="Enter emails separated by commas"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
        />
      </div>

      {/* NEW — Finish Meeting Button */}
      <button
        onClick={handleFinishMeeting}
        className="bg-green-600 text-white px-4 py-2 rounded-md"
      >
        Finish Meeting & Generate Dashboard
      </button>
    </div>
  );
};

export default MeetingSummary;
