// utils/jira.js
const axios = require("axios");
require("dotenv").config();

async function createJiraIssueFallback(task) {
  const { JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN, JIRA_PROJECT_KEY } = process.env;
  if (!JIRA_URL || !JIRA_USERNAME || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) {
    throw new Error("Jira environment variables are not configured");
  }

  // Validate task minimal shape
  if (!task || !(task.task || task.title || typeof task === "string")) {
    throw new Error("Invalid task object: missing .task or .title");
  }

  const auth = Buffer.from(`${JIRA_USERNAME}:${JIRA_API_TOKEN}`).toString("base64");

  const summary = (task.summary || task.title || task.task || (typeof task === "string" ? task.slice(0, 80) : "Meeting task")).toString().trim();
  const owner = (task.assigned_to || task.owner || "Unassigned").toString();
  const deadline = task.deadline || null;
  const original = task.original_line || "";

  // Build ADF description (multi-line)
  const plainDescParts = [
    `Task: ${task.task || task.title || summary}`,
    `Owner: ${owner}`,
    `Deadline: ${deadline || "Not set"}`,
  ];
  if (original) plainDescParts.push(`Original: ${original}`);
  const plainDesc = plainDescParts.join("\n");

  const adfDescription = {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: plainDesc,
          },
        ],
      },
    ],
  };

  const issueData = {
    fields: {
      project: { key: JIRA_PROJECT_KEY },
      summary,
      description: adfDescription, // ADF
      issuetype: { name: "Task" },
    },
  };

  try {
    const response = await axios.post(`${JIRA_URL}/rest/api/3/issue`, issueData, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15000,
    });
    return response.data; // contains id,key,self
  } catch (error) {
    // Build a helpful error with response body if present
    const respData = error.response?.data || null;
    const status = error.response?.status || null;
    const message = respData?.errorMessages?.join?.(", ") || respData?.message || error.message || "Unknown error";
    const full = { status, message, respData };
    const err = new Error(`Jira create failed: ${message}`);
    err.response = { status, data: respData };
    err._full = full;
    throw err;
  }
}

module.exports = { createJiraIssueFallback };