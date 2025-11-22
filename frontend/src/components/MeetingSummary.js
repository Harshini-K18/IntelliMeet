import React, { useState, useEffect } from "react";

const MeetingSummary = () => {
  const [transcript, setTranscript] = useState("");
  const [mom, setMom] = useState("");
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState("");
  const [currentDateTime, setCurrentDateTime] = useState("");

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
  
    // Convert markdown headings (## Title) → <h3>Title</h3>
    out = out.replace(/^##\s*(.*)/gm, "<h3>$1</h3>");
  
    // Convert markdown headings (# Title) → <h2>Title</h2>
    out = out.replace(/^#\s*(.*)/gm, "<h2>$1</h2>");
  
    // Convert bold text
    out = out.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  
    // Convert bullet points to list items
    out = out.replace(/^\s*[-*]\s+(.*)/gm, "<li>$1</li>");
  
    // Wrap lists in <ul> tags
    out = out.replace(/<li>(.*?)<\/li>/gs, (match) => {
        return `<ul>${match}</ul>`;
    });
    out = out.replace(/<\/ul>\s*<ul>/g, "");
  
    // Wrap remaining lines in <p> tags
    out = out.split('\n').map(line => {
        if (line.trim() === "") return "";
        if (line.startsWith('<h') || line.startsWith('<li') || line.startsWith('<ul')) return line;
        return `<p>${line}</p>`;
    }).join('');
  
    return out;
  };

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
    <div >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-light-highlight mb-2">Smart Meeting Minutes Generator</h1>
          
        </div>
        
        <div className="bg-light-card/50 backdrop-blur-sm rounded-xl p-8 mb-8 shadow-lg border border-light-accent/20">
          <label htmlFor="transcript" className="block text-lg font-semibold text-light-text mb-4 flex items-center">
          
            Meeting Transcript
          </label>
          <div className="relative">
            <textarea
              id="transcript"
              className="w-full px-4 py-3 bg-white/80 border border-light-accent/30 rounded-lg shadow-inner focus:ring-2 focus:ring-light-highlight/50 focus:border-light-highlight transition-all duration-200 text-light-text placeholder-light-text/50"
              rows="10"
              placeholder="Paste the meeting transcript here..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
            <div className="absolute -bottom-2 right-3 bg-white px-2 text-xs text-light-text/50">
              {transcript.length} characters
            </div>
          </div>

          <div className="mt-6 flex justify-between items-center">
            <div className="flex space-x-3">
              <button
                onClick={() => setTranscript('')}
                className="px-4 py-2 text-sm font-medium text-light-text/70 hover:text-[#f69d9bf8] transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleGenerateSummary}
                className={`inline-flex items-center px-5 py-2.5 rounded-lg font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all ${
                  loading 
                    ? 'bg-[#f69d9b]/70 cursor-not-allowed' 
                    : 'bg-[#f69d9b] hover:bg-[#f69d9b]/90'
                } text-white`}
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
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Generate Minutes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {mom && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-8 shadow-lg border border-light-accent/20 transition-all duration-300 transform hover:shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-light-highlight flex items-center">
                
                MOM
              </h2>
              <div className="flex space-x-3">
                <button 
                  onClick={() => navigator.clipboard.writeText(mom.replace(/<[^>]*>?/gm, ''))}
                  className="p-2 text-light-text/60 hover:text-light-highlight transition-colors"
                  title="Copy to clipboard"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </button>
                <button 
                  onClick={handleFinishMeeting}
                  className="px-4 py-2 bg-[#f69d9b] text-white rounded-lg text-sm font-medium flex items-center hover:bg-[#f69d9b]/90 transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export
                </button>
              </div>
            </div>
            <div 
              className="prose max-w-none text-light-text/90"
              dangerouslySetInnerHTML={{ __html: mom }} 
            />
          </div>
        )}
      </div>

      <style jsx global>{`
        .prose {
          color: inherit;
        }
        .prose h2 {
          font-size: 1.5em;
          font-weight: 700;
          margin-top: 1.8em;
          margin-bottom: 0.8em;
          color: #3d2c22;
          border-bottom: 2px solid #fbb0b0;
          padding-bottom: 0.4em;
          position: relative;
        }
        .prose h2:before {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 40px;
          height: 2px;
          background: #d873cb;
        }
        .prose h3 {
          font-size: 1.3em;
          font-weight: 600;
          margin-top: 1.5em;
          margin-bottom: 0.8em;
          color: #3d2c22;
          display: flex;
          align-items: center;
        }
        .prose h3:before {
          content: '•';
          color: #d873cb;
          margin-right: 8px;
          font-size: 1.5em;
          line-height: 0;
        }
        .prose p {
          margin-bottom: 1.2em;
          line-height: 1.7;
        }
        .prose ul {
          list-style-type: none;
          padding-left: 0;
          margin-bottom: 1.5em;
        }
        .prose ul li {
          position: relative;
          padding-left: 1.8em;
          margin-bottom: 0.6em;
        }
        .prose ul li:before {
          content: '→';
          position: absolute;
          left: 0;
          color: #d873cb;
          font-weight: bold;
        }
        .prose a {
          color: #d873cb;
          text-decoration: none;
          font-weight: 500;
          border-bottom: 1px dashed #d873cb;
          transition: all 0.2s ease;
        }
        .prose a:hover {
          color: #fbb0b0;
          border-bottom-style: solid;
        }
      `}</style>
    </div>
  );
};

export default MeetingSummary;