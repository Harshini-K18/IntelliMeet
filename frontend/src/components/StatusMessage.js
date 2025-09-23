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
          ? "text-red-600 dark:text-red-400"
          : "text-green-600 dark:text-green-600"
      }`}
    >
      {status}
      {status.startsWith("Bot deployed with ID:") && (
        <button
          onClick={handleCopyBotId}
          className="ml-2 text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-500 transition-colors duration-200"
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