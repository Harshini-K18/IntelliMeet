import React from "react";
import {
  ClipboardDocumentListIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

const StatusMessage = ({ status, handleCopyBotId, isCopied }) => {
  return (
    <p
      className={`flex items-center justify-center mb-6 ${
        status.includes("Error")
          ? "text-danger"
          : "text-secondary"
      }`}
    >
      {status}
      {status.startsWith("Bot deployed with ID:") && (
        <button
          onClick={handleCopyBotId}
          className="ml-2 text-primary dark:text-light hover:text-accent dark:hover:text-accent transition-colors duration-200"
          aria-label={isCopied ? "Copied" : "Copy bot ID"}
        >
          {isCopied ? (
            <CheckCircleIcon className="h-5 w-5" />
          ) : (
            <ClipboardDocumentListIcon className="h-5 w-5" />
          )}
        </button>
      )}
    </p>
  );
};

export default StatusMessage;