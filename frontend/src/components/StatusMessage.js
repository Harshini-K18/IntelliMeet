import React from "react";
import {
  ClipboardDocumentListIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

const StatusMessage = ({ status, handleCopyBotId, isCopied }) => {
  return (
    <p
      className={`flex items-center justify-center pt-4 ${
        status.includes("Error")
          ? "text-danger"
          : "text-light-text dark:text-dark-text"
      }`}
    >
      {status}
      {status.startsWith("Bot deployed with ID:") && (
        <button
          onClick={handleCopyBotId}
          className="ml-2 text-light-accent dark:text-dark-accent hover:opacity-80 transition-colors duration-200"
          aria-label={isCopied ? "Copied" : "Copy bot ID"}
        >
          {isCopied ? (
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
          ) : (
            <ClipboardDocumentListIcon className="h-5 w-5" />
          )}
        </button>
      )}
    </p>
  );
};

export default StatusMessage;