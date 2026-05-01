# IntelliMeet

IntelliMeet is an AI meeting assistant that joins online meetings, captures live transcripts, extracts action items, generates Minutes of Meeting, creates analytics, exports a PDF dashboard, emails meeting outcomes to participants, and can push tasks into Jira.

## Features

- Deploy a meeting bot for Google Meet, Zoom, or Microsoft Teams using Recall.ai
- Stream live meeting transcripts to the dashboard with Socket.IO
- Generate Minutes of Meeting with Ollama
- Extract action items from transcripts
- Save one or multiple tasks to Jira
- View meeting analytics with Chart.js
- Download transcripts
- Generate and download a PDF meeting dashboard
- Email the meeting dashboard to participants
- Light and dark mode React UI

## Screenshots

<img width="1917" height="867" alt="Screenshot 2025-12-01 170447" src="https://github.com/user-attachments/assets/771221fa-9f7c-49af-b465-1da83c6cb37e" />
<img width="1919" height="862" alt="Screenshot 2025-12-01 170549" src="https://github.com/user-attachments/assets/aced3418-348e-4822-be25-7a60aab9e5cd" />
<img width="1904" height="866" alt="Screenshot 2025-11-23 143441" src="https://github.com/user-attachments/assets/d9d81125-e600-4614-b520-c78679274c3c" />
<img width="1897" height="871" alt="Screenshot 2025-11-23 143413" src="https://github.com/user-attachments/assets/6178217c-0ac2-48fd-a019-46e0ec9bc74b" />



## Tech Stack

- **Frontend:** React, Tailwind CSS, Axios, Socket.IO Client, Chart.js
- **Backend:** Node.js, Express, Socket.IO, Puppeteer, Nodemailer
- **AI:** Ollama
- **Meeting Bot:** Recall.ai
- **Integrations:** Jira, email/SMTP

## Project Structure

```text
IntelliMeet/
+-- backend/
|   +-- index.js
|   +-- utils/
|       +-- jira.js
|       +-- takenotes.js
|       +-- taskExtractor.js
+-- frontend/
|   +-- public/
|   +-- src/
|       +-- components/
|       +-- utils/
|       +-- App.js
+-- docs/
|   +-- images/
+-- package.json
+-- README.md
```

## Prerequisites

Install these before running the project:

- Node.js and npm
- Ollama running locally
- A Recall.ai API key
- Jira credentials, if you want Jira task creation
- SMTP credentials, if you want email delivery

## Environment Variables

Create a `.env` file inside the `backend/` folder:

```env
PORT=3001
FRONTEND_URL=http://localhost:3000

RECALL_API_KEY=your_recall_api_key
RECALL_BASE_URL=https://api.recall.ai/v1
WEBHOOK_URL=your_public_webhook_url/webhook/transcription

OLLAMA_MODEL=gemma:2b
OLLAMA_ENDPOINT=http://localhost:11434/api/generate

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_app_password
EMAIL_FROM=your_email@example.com
DEFAULT_PARTICIPANTS=person1@example.com,person2@example.com

JIRA_URL=https://your-domain.atlassian.net
JIRA_USERNAME=your_jira_email@example.com
JIRA_API_TOKEN=your_jira_api_token
JIRA_PROJECT_KEY=SCRUM
```

For local frontend configuration, you can optionally create `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:3001
```

## Installation

Clone the repository:

```bash
git clone https://github.com/your-username/intellimeet.git
cd intellimeet
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Install backend dependencies:

```bash
cd ../backend
npm install
```

## Running Locally

Start Ollama:

```bash
ollama serve
```

Pull the model if needed:

```bash
ollama pull gemma:2b
```

Start the backend:

```bash
cd backend
npm start
```

Start the frontend in another terminal:

```bash
cd frontend
npm start
```

Open the app:

```text
http://localhost:3000
```

## How It Works

1. Enter a Google Meet, Zoom, or Teams meeting URL.
2. IntelliMeet deploys a Recall.ai bot to the meeting.
3. Recall.ai sends transcript events to the backend webhook.
4. The backend streams transcript updates to the React dashboard.
5. Ollama generates MoM and extracts tasks from the meeting transcript.
6. The app creates analytics and a PDF dashboard.
7. The dashboard can be emailed to participants and tasks can be saved to Jira.

## Main API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Backend health check |
| `POST` | `/deploy-bot` | Deploy meeting bot |
| `POST` | `/webhook/transcription` | Recall.ai webhook endpoint |
| `POST` | `/generate-mom` | Generate Minutes of Meeting |
| `POST` | `/extract-tasks` | Extract action items |
| `POST` | `/participants` | Store participant emails |
| `POST` | `/finish-meeting` | Generate dashboard and send emails |
| `GET` | `/dashboard` | View generated dashboard |
| `GET` | `/download-pdf` | Download dashboard PDF |
| `POST` | `/api/save-to-jira` | Save one task to Jira |
| `POST` | `/api/save-multiple-to-jira` | Save multiple tasks to Jira |


## Notes

- The backend runs on port `3001` by default.
- The frontend runs on port `3000` by default.
- To receive Recall.ai webhooks locally, expose the backend with a tunneling tool such as ngrok and use that public URL as `WEBHOOK_URL`.
- Email delivery requires valid SMTP credentials.
- Jira integration requires Jira Cloud API credentials and a valid project key.

## License

This project is open for learning and development. Add a license file before publishing if you want to define usage rights clearly.
