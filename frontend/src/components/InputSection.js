import React from "react";

// ... existing code ...
const InputSection = ({ meetingUrl, setMeetingUrl, handleDeployBot }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-center">
      <input
        type="text"
        placeholder="Enter Meeting URL"
        value={meetingUrl}
        onChange={(e) => setMeetingUrl(e.target.value)}
        className="flex-1 px-4 py-2 border border-secondary rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-accent bg-light dark:bg-primary dark:text-light dark:placeholder-gray-400"
      />
      <button
        onClick={handleDeployBot}
        disabled={!meetingUrl}
        className={`px-6 py-2 bg-secondary text-light rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-accent transition-colors ${
          !meetingUrl
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:bg-primary"
        }`}
      >
        Deploy Bot
      </button>
    </div>
  );
};


export default InputSection;