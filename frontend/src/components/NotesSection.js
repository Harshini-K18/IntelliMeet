import React from "react";

function NotesSection({ notes }) {
  return (
    <>
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">
        Important Notes
      </h2>
      <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md text-sm text-gray-600 dark:text-gray-300 h-40 overflow-y-auto">
        {notes && notes.length > 0 ? (
          notes.map((note, index) => (
            <p key={index} className="whitespace-pre-wrap mb-2">
              {note}
            </p>
          ))
        ) : (
          <p className="text-gray-400">
            Important notes will appear here...
          </p>
        )}
      </div>
    </>
  );
}

export default NotesSection;