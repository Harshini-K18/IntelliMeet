// backend/utils/jira.js
const axios = require('axios');
require('dotenv').config();

function normalizeBaseUrl(u) {
  if (!u) return null;
  u = (u || '').toString().trim();
  if (!u.startsWith('http')) u = `https://${u}`;
  return u.replace(/\/+$/, '');
}

const JIRA_URL = normalizeBaseUrl(process.env.JIRA_URL || process.env.JIRA_BASE || process.env.JIRA_BASE_URL);
const JIRA_USERNAME = process.env.JIRA_USERNAME || process.env.JIRA_EMAIL || process.env.JIRA_USER;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || process.env.JIRA_TOKEN;
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY || process.env.JIRA_PROJECT || 'SCRUM';

// Debug logging
console.log('Jira Configuration:');
console.log('- JIRA_URL:', JIRA_URL);
console.log('- JIRA_USERNAME:', JIRA_USERNAME ? '*** (set)' : 'Not set');
console.log('- JIRA_API_TOKEN:', JIRA_API_TOKEN ? '*** (set)' : 'Not set');
console.log('- JIRA_PROJECT_KEY:', JIRA_PROJECT_KEY);

function buildAuth() {
  if (!JIRA_USERNAME || !JIRA_API_TOKEN) {
    console.error('Missing Jira credentials. JIRA_USERNAME or JIRA_API_TOKEN not set.');
    return null;
  }
  const authString = `${JIRA_USERNAME}:${JIRA_API_TOKEN}`;
  return Buffer.from(authString).toString('base64');
}

function sanitize(s, max = 2000) {
  if (s === undefined || s === null) return '';
  let out = String(s);
  out = out.replace(/```[\s\S]*?```/g, ' ');
  out = out.replace(/`+/g, '');
  out = out.replace(/\s+/g, ' ').trim();
  if (out.length > max) out = out.slice(0, max - 3) + '...';
  return out;
}

async function createJiraIssueFallback(task) {
  console.log('Creating Jira issue with task:', JSON.stringify(task, null, 2));
  
  // Validate environment
  if (!JIRA_URL || !JIRA_USERNAME || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) {
    const error = new Error('Jira environment variables are not properly configured');
    error.details = {
      JIRA_URL: JIRA_URL ? 'set' : 'missing',
      JIRA_USERNAME: JIRA_USERNAME ? 'set' : 'missing',
      JIRA_API_TOKEN: JIRA_API_TOKEN ? 'set' : 'missing',
      JIRA_PROJECT_KEY: JIRA_PROJECT_KEY ? 'set' : 'missing'
    };
    console.error('Jira configuration error:', error.details);
    throw error;
  }

  // Validate task
  if (!task || !(task.task || task.title || typeof task === 'string')) {
    const error = new Error('Invalid task object: missing .task or .title');
    console.error('Task validation failed:', task);
    throw error;
  }

  // Prepare issue data
  const summary = sanitize(task.summary || task.title || task.task || (typeof task === 'string' ? task : ''), 140);
  const owner = sanitize(task.assigned_to || task.owner || 'Unassigned', 200);
  const deadline = task.deadline || null;
  const original = sanitize(task.original_line || task.original || '', 1000);
  const labels = Array.isArray(task.labels) 
    ? task.labels
        .map(l => sanitize(l, 80))
        .map(l => l.replace(/\s+/g, '-').toLowerCase()) // Replace spaces with hyphens
        .filter(l => l.length > 0) // Remove empty labels
    : [];

  // Create description in Atlassian Document Format (ADF)
  const descriptionContent = [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: `Task: ${sanitize(task.task || task.title || summary, 1000)}`
        }
      ]
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: `Owner: ${owner}`
        }
      ]
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: `Deadline: ${deadline || 'Not set'}`
        }
      ]
    }
  ];

  if (original) {
    descriptionContent.push(
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: `Original: ${original}`
          }
        ]
      }
    );
  }

  if (labels.length) {
    descriptionContent.push(
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: `Labels: ${labels.join(', ')}`
          }
        ]
      }
    );
  }

  const issueData = {
    fields: {
      project: { key: JIRA_PROJECT_KEY },
      summary,
      description: {
        type: 'doc',
        version: 1,
        content: descriptionContent
      },
      issuetype: { name: 'Task' }
    }
  };

  if (labels.length) {
    issueData.fields.labels = labels;
  }

  const url = `${JIRA_URL}/rest/api/3/issue`;
  const auth = buildAuth();
  
  if (!auth) {
    const error = new Error('Jira credentials missing (JIRA_USERNAME or JIRA_API_TOKEN).');
    console.error('Authentication error:', error.message);
    throw error;
  }

  const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  console.log('Sending request to Jira API:', {
    url,
    method: 'POST',
    headers: { ...headers, 'Authorization': 'Basic *** (redacted)' },
    data: issueData
  });

  try {
    const response = await axios.post(url, issueData, { 
      headers,
      timeout: 30000,
      validateStatus: status => status < 500 // Don't throw on 4xx errors
    });

    console.log('Jira API response:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });

    if (response.status >= 400) {
      const error = new Error(`Jira API error: ${response.status} ${response.statusText}`);
      error.response = response;
      throw error;
    }

    return response.data;
  } catch (error) {
    console.error('Jira API request failed:', {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : 'No response',
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers ? {
          ...error.config.headers,
          'Authorization': error.config.headers['Authorization'] ? 'Basic *** (redacted)' : 'Not set'
        } : 'No headers',
        data: error.config?.data
      }
    });

    const errorMessage = error.response?.data?.errorMessages?.join?.(', ') ||
                       error.response?.data?.message ||
                       error.message ||
                       'Unknown error';
    
    const enhancedError = new Error(`Jira create failed: ${errorMessage}`);
    enhancedError.response = error.response;
    throw enhancedError;
  }
}

module.exports = {
  createJiraIssueFallback,
};