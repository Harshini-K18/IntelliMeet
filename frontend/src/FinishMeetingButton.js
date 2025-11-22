import React, { useState } from "react";
import axios from "axios";

export default function FinishMeetingButton({ onDashboardGenerated, tasks }) {
  // 👆 IMPORTANT: receive tasks from parent (App.js)

  const [showPopup, setShowPopup] = useState(false);
  const [emails, setEmails] = useState([""]);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const addEmailField = () => setEmails([...emails, ""]);

  const updateEmail = (i, v) => {
    const arr = [...emails];
    arr[i] = v;
    setEmails(arr);
  };

  const removeEmail = (i) => {
    if (emails.length === 1) return;
    setEmails(emails.filter((_, index) => index !== i));
  };

  const handleFinishMeeting = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const cleanEmails = emails.map(e => e.trim()).filter(Boolean);
      if (cleanEmails.length === 0) {
        setErrorMsg("Please enter at least one email.");
        setLoading(false);
        return;
      }

      // 1️⃣ SEND PARTICIPANTS FIRST
      await axios.post("http://localhost:3001/participants", {
        meetingId: "default",
        emails: cleanEmails,
      });

      // 2️⃣ SEND FRONTEND TASKS TO BACKEND (NEW & IMPORTANT)
      await axios.post("http://localhost:3001/api/store-frontend-tasks", {
        tasks: tasks || [],
      });

      // 3️⃣ FINISH MEETING → TRIGGER DASHBOARD + EMAIL
      const response = await axios.post("http://localhost:3001/finish-meeting");

      if (response.data?.ok) {
        setSuccessMsg("Dashboard generated & emails sent!");

        if (onDashboardGenerated) onDashboardGenerated();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Error finishing meeting. Try again.");
    }

    setLoading(false);
  };

  return (
    <div className="text-center">

      <button
        onClick={() => setShowPopup(true)}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
      >
        Send Dashboard & Finish Meeting
      </button>

      {successMsg && <p className="text-green-600 mt-3 font-semibold">{successMsg}</p>}
      {errorMsg && <p className="text-red-600 mt-3 font-semibold">{errorMsg}</p>}

      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-lg w-96">

            <h2 className="text-xl font-bold mb-4 text-center">
              Enter Participant Emails
            </h2>

            {emails.map((email, index) => (
              <div key={index} className="flex gap-2 mb-3">
                <input
                  type="email"
                  placeholder={`Email ${index + 1}`}
                  value={email}
                  onChange={(e) => updateEmail(index, e.target.value)}
                  className="flex-1 p-2 border rounded-md dark:bg-dark-bg dark:text-white"
                />
                {emails.length > 1 && (
                  <button
                    className="px-3 py-1 bg-red-500 text-white rounded-md"
                    onClick={() => removeEmail(index)}
                  >
                    X
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addEmailField}
              className="text-blue-600 dark:text-blue-400 mb-4"
            >
              + Add another email
            </button>

            <button
              onClick={handleFinishMeeting}
              className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition mb-2"
            >
              {loading ? "Sending..." : "Send & Finish"}
            </button>

            <button
              onClick={() => setShowPopup(false)}
              className="w-full py-2 bg-gray-300 dark:bg-gray-700 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>

          </div>
        </div>
      )}
    </div>
  );
}
