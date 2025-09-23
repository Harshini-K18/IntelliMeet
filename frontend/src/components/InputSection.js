import React from "react";

const InputSection = ({ meetingUrl, setMeetingUrl, handleDeployBot }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-center">
      <input
        type="text"
        placeholder="Enter Google Meet URL"
        value={meetingUrl}
        onChange={(e) => setMeetingUrl(e.target.value)}
        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
      />
      <button
        onClick={handleDeployBot}
        disabled={!meetingUrl}
        className={`${
          !meetingUrl
            ? "cursor-not-allowed"
            : "cursor-pointer hover:bg-blue-700"
        } px-6 py-2 bg-blue-600 text-white rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
      >
        Deploy Bot
      </button>
    </div>
  );
};

export default InputSection;