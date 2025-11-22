import React, { useState } from "react";
import axios from "axios";

const TaskExtractor = () => {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [pastedTranscript, setPastedTranscript] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);

  // ---------------------------------------------
  // Extract Tasks
  // ---------------------------------------------
  const extractTasks = async () => {
    if (!pastedTranscript.trim()) {
      setTasks([]);
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const response = await axios.post("http://localhost:3001/extract-tasks", {
        transcript: pastedTranscript,
      });

      let extractedTasks = [];

      if (response.data && response.data.tasks) {
        if (Array.isArray(response.data.tasks)) {
          extractedTasks = response.data.tasks;
        } else if (typeof response.data.tasks === "string") {
          try {
            const parsed = JSON.parse(response.data.tasks);
            if (Array.isArray(parsed)) extractedTasks = parsed;
          } catch (err) {
            console.error("JSON parse error:", err);
            setError("Failed to parse server output.");
          }
        }
      }

      setTasks(extractedTasks);
    } catch (err) {
      console.error(err);
      setError("Failed to extract tasks. Check backend server.");
    }

    setIsExtracting(false);
  };

  // ---------------------------------------------
  // Copy Tasks
  // ---------------------------------------------
  const copyToClipboard = () => {
    const text = tasks
      .map(
        (t) =>
          `Task: ${t.task}
Owner: ${t.assigned_to || t.owner || "Unassigned"}
Deadline: ${t.deadline || "Not set"}
Source: ${t.original_line || ""}
`
      )
      .join("\n\n");

    navigator.clipboard.writeText(text);
  };

  // ---------------------------------------------
  // Email Tasks
  // ---------------------------------------------
  const emailTasks = () => {
    const subject = "Meeting Tasks";
    const body = tasks
      .map(
        (task) =>
          `Task: ${task.task}%0AOwner: ${
            task.assigned_to || task.owner || "Unassigned"
          }%0ADeadline: ${
            task.deadline || "Not set"
          }%0AOriginal: ${encodeURIComponent(task.original_line || "")}`
      )
      .join("%0A%0A");

    window.location.href = `mailto:?subject=${encodeURIComponent(
      subject
    )}&body=${body}`;
  };

  // ---------------------------------------------
  // Save ONE Task → Jira
  // ---------------------------------------------
  const saveToJira = async (task) => {
    try {
      await axios.post("http://localhost:3001/api/save-to-jira", {
        task,
      });
      alert("Task saved to Jira!");
    } catch (err) {
      console.error(err);
      alert("Failed to save task to Jira.");
    }
  };

  // ---------------------------------------------
  // Save ALL Tasks → Jira
  // ---------------------------------------------
  const saveAllToJira = async () => {
    try {
      await axios.post("http://localhost:3001/api/save-multiple-to-jira", {
        tasks,
      });
      alert("All tasks saved to Jira!");
    } catch (err) {
      console.error(err);
      alert("Failed to save all tasks to Jira.");
    }
  };

  // ---------------------------------------------
  // Save ALL Tasks → Backend Dashboard (Option B)
  // ---------------------------------------------
  const saveTasksToDashboard = async () => {
    try {
      await axios.post("http://localhost:3001/api/store-frontend-tasks", {
        tasks,
      });

      alert("Tasks sent to Dashboard! They will appear when you finish meeting.");
    } catch (err) {
      console.error(err);
      alert("Failed to send tasks to dashboard.");
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Task Extractor</h2>

      {/* ------------------------------------------------ */}
      {/* TEXTAREA */}
      {/* ------------------------------------------------ */}
      <textarea
        className="w-full p-3 border rounded mb-3"
        rows="10"
        placeholder="Paste transcript here..."
        value={pastedTranscript}
        onChange={(e) => setPastedTranscript(e.target.value)}
      ></textarea>

      {/* ------------------------------------------------ */}
      {/* BUTTONS */}
      {/* ------------------------------------------------ */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={extractTasks}
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={isExtracting || !pastedTranscript.trim()}
        >
          {isExtracting ? "Extracting..." : "Extract Tasks"}
        </button>

        <button
          onClick={() => {
            setPastedTranscript("");
            setTasks([]);
          }}
          className="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
        >
          Clear
        </button>
      </div>

      {error && <p className="text-red-500">{error}</p>}

      {/* ------------------------------------------------ */}
      {/* TASK LIST */}
      {/* ------------------------------------------------ */}
      <div className="space-y-4">
        {tasks.map((task, i) => (
          <div key={i} className="p-4 border rounded-lg bg-gray-50">
            <p className="font-semibold">{task.task}</p>

            <p className="text-sm text-gray-600">
              <strong>Owner:</strong> {task.assigned_to || "Unassigned"}
            </p>

            <p className="text-sm text-gray-600">
              <strong>Deadline:</strong> {task.deadline || "Not set"}
            </p>

            {task.original_line && (
              <p className="text-sm text-gray-500 italic">
                Source: "{task.original_line}"
              </p>
            )}

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => saveToJira(task)}
                className="bg-blue-500 text-white py-1 px-3 rounded"
              >
                Save to Jira
              </button>

              <button
                onClick={() =>
                  navigator.clipboard.writeText(JSON.stringify(task, null, 2))
                }
                className="bg-gray-500 text-white py-1 px-3 rounded"
              >
                Copy
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------ */}
      {/* FOOTER BUTTONS */}
      {/* ------------------------------------------------ */}
      {tasks.length > 0 && (
        <div className="mt-5 pt-4 border-t flex flex-wrap gap-2">
          <button
            onClick={saveAllToJira}
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          >
            Save All to Jira
          </button>

          <button
            onClick={saveTasksToDashboard}
            className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
          >
            Save to Dashboard
          </button>

          <button
            onClick={emailTasks}
            className="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
          >
            Email Tasks
          </button>

          <button
            onClick={copyToClipboard}
            className="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
          >
            Copy Tasks
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskExtractor;
