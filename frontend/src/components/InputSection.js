import React from "react";

const InputSection = ({ meetingUrl, setMeetingUrl, handleDeployBot }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <input
        type="text"
        placeholder="Enter Meeting URL"
        value={meetingUrl}
        onChange={(e) => setMeetingUrl(e.target.value)}
        className="flex-1 px-4 py-2 border border-light-accent rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-light-accent bg-light-bg text-light-text dark:bg-dark-bg dark:text-dark-text dark:placeholder-gray-400 dark:border-dark-accent dark:focus:ring-dark-accent transition-colors duration-300"
      />
      <button
        onClick={handleDeployBot}
        disabled={!meetingUrl}
        className="px-6 py-2 bg-light-accent text-light-bg rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-light-accent dark:bg-dark-accent dark:text-dark-bg dark:focus:ring-dark-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
      >
        Deploy Bot
      </button>
    </div>
  );
};

export default InputSection;