/**
 * Extracts actionable notes from a given text based on predefined keywords.
 * @param {string} text - The input text (e.g., meeting transcript).
 * @returns {string} - Extracted notes as a single string.
 */
const takenotes = (text) => {
  // Define keywords to look for in the text
  const keywords = [
  "task",
  "job",
  "assign",
  "important",
  "deadline",
  "focus",
  "action",
  "priority",
  "reminder",
  "complete",
  "urgent",
  "follow-up",
  "deliverable",
  "progress",
  "update",
  "review",
  "meeting",
  "plan",
  "goal",
  "strategy",
  "next step",
  "milestone",
  "schedule",
  "target",
  "responsibility",
  "assignments",
  "due",
  "check",
  "note",
  "alert",
  "watch",
  "decision",
  "tasklist",
  "commitment",
  "objective" ,
  "today",
  "tomorrow",
  "week",
  "month",
  "quarter"
];


  // Split the text into sentences
  const sentences = text.split(". ");

  // Filter sentences that contain any of the keywords
  const notes = sentences.filter((sentence) =>
    keywords.some((keyword) => sentence.toLowerCase().includes(keyword))
  );

  console.log("Extracted Notes:", notes); // Debugging log
  // Join the filtered sentences into a single string
  return notes.join(". ");
};

module.exports = { takenotes };