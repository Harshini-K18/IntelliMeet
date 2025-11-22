import React, { useState, useEffect } from "react";

const MeetingSummary = () => {
  const [transcript, setTranscript] = useState("");
  const [mom, setMom] = useState("");
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState("");
  const [currentDateTime, setCurrentDateTime] = useState("");

  // Set current date and time when component mounts
  useEffect(() => {
    const now = new Date();
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    };
    setCurrentDateTime(now.toLocaleDateString('en-US', options));
  }, []);

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

    // Format section headers with proper highlighting
    out = out.replace(
      /(^|\n)(\s*)(Date:|Time:|Attendees:|Topic:|Key Points:|Decisions Made:|Action Items:)([^•]*?)(?=\n\s*[•*\-]|$)/gis,
      (m, nl, sp, label, content) => {
        return `
          <div class="section">
            <h3 class="section-heading">${label.replace(':', '')}</h3>
            <div class="section-content">${content.trim()}</div>
          </div>
        `;
      }
    );

    // Format bullet points with proper spacing
    out = out.replace(/^\s*[•*\-]\s*(.+)/gm, '<div class="list-item">• $1</div>');

    // Clean up any remaining formatting issues
    out = out.replace(/\*\*/g, '');
    out = out.replace(/\n\s*\n/g, '\n');

    // Main container with clean layout
    return `
      <div class="mom-container">
        <h1 class="meeting-title">Minutes of Meeting</h1>
        <div class="meeting-date">${currentDateTime}</div>
        <div class="meeting-content">
          ${out}
        </div>
      </div>
    `;
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
    <div className="min-h-screen bg-light-bg p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-light-text text-center mb-6">Minutes of Meeting Generator</h1>
        
        <div className="bg-white rounded-lg p-6 mb-6 shadow-md">
          <label htmlFor="transcript" className="block text-sm font-medium text-light-text mb-2">
            Paste Meeting Transcript
          </label>
          <textarea
            id="transcript"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-light-highlight focus:border-light-highlight sm:text-sm"
            rows="10"
            placeholder="Paste the meeting transcript here..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleGenerateSummary}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-light-highlight hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-light-highlight ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : 'Generate Minutes of Meeting'}
            </button>
          </div>
        </div>

        {mom && (
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div 
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: mom }} 
            />
          </div>
        )}
      </div>

      <style jsx global>{`
        body {
          background-color: #ffffff;
          margin: 0;
          padding: 2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          color: #2d3748;
          line-height: 1.6;
        }
        
        .mom-container {
          max-width: 900px;
          margin: 0 auto;
          background: white;
          padding: 2rem;
        }
        
        .meeting-title {
          font-size: 1.8rem;
          font-weight: 700;
          color: #1a365d;
          margin: 0 0 0.5rem 0;
          text-align: center;
        }
        
        .meeting-date {
          color: #4a5568;
          text-align: center;
          margin-bottom: 2.5rem;
          font-size: 0.95rem;
        }
        
        .meeting-content {
          background: white;
          border-radius: 8px;
        }
        
        .section {
          margin-bottom: 1.8rem;
        }
        
        .section-heading {
          font-size: 1.3rem;
          font-weight: 700;
          color: #2b6cb0;
          margin: 1.8rem 0 0.8rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #e2e8f0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .section-content {
          font-size: 1.05rem;
          color: #4a5568;
          line-height: 1.7;
          padding: 0 0.5rem;
        }
        
        .list-item {
          margin: 0.6rem 0;
          padding-left: 0.5rem;
          position: relative;
        }
        
        .list-item:before {
          content: '•';
          color: #2b6cb0;
          font-weight: bold;
          position: absolute;
          left: -0.5rem;
        }
      `}</style>
    </div>
  );
};

export default MeetingSummary;