import React, { useState } from "react";

export default function EmailPromptModal({ show, onClose, onSubmit }) {
  const [emails, setEmails] = useState("");

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-96">
        <h2 className="text-lg mb-3 font-semibold text-gray-900 dark:text-gray-200">
          Add Participant Emails
        </h2>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          Enter emails of meeting attendees (comma-separated)
        </p>

        <textarea
          className="w-full h-24 p-2 border rounded-md dark:bg-gray-700 dark:text-white"
          placeholder="example1@gmail.com, example2@yahoo.com"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
        />

        <div className="flex justify-end mt-4 gap-3">
          <button
            className="py-1 px-3 rounded-md border border-gray-400 dark:border-gray-600"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            className="py-1 px-3 bg-blue-600 text-white rounded-md"
            onClick={() => onSubmit(emails)}
          >
            Save Emails
          </button>
        </div>
      </div>
    </div>
  );
}
