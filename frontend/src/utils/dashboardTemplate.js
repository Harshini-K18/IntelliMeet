module.exports = function createDashboardHTML(data) {
  return `
  <html>
  <head>
    <style>
      body {
        font-family: Arial, sans-serif;
        padding: 20px;
      }
      h1 {
        color: #1f4fff;
        border-bottom: 2px solid #1f4fff;
        padding-bottom: 5px;
      }
      h2 {
        color: #333;
        margin-top: 25px;
        border-left: 4px solid #1f4fff;
        padding-left: 8px;
      }
      .section-box {
        background: #f5f7ff;
        padding: 15px;
        border-radius: 8px;
        margin-top: 10px;
        border: 1px solid #d5ddff;
      }
      ul {
        padding-left: 20px;
      }
      .item {
        margin-bottom: 8px;
      }
    </style>
  </head>

  <body>
    <h1>IntelliMeet – Meeting Dashboard</h1>

    <h2>Meeting Summary</h2>
    <div class="section-box">${data.summary}</div>

    <h2>Minutes of Meeting (MoM)</h2>
    <div class="section-box">
      <ul>
        ${data.mom.map(i => `<li class="item">${i}</li>`).join("")}
      </ul>
    </div>

    <h2>Action Items</h2>
    <div class="section-box">
      <ul>
        ${data.actionItems.map(i => `<li class="item">${i}</li>`).join("")}
      </ul>
    </div>

    <h2>Tasks</h2>
    <div class="section-box">
      <ul>
        ${data.tasks.map(i => `<li class="item">${i}</li>`).join("")}
      </ul>
    </div>

    <h2>Analytics</h2>
    <div class="section-box">
       Participants: ${data.analytics.participantCount} <br>
       Total Duration: ${data.analytics.duration} minutes <br>
       Total Messages: ${data.analytics.messageCount}
    </div>

    <h2>Important Notes</h2>
    <div class="section-box">
      <ul>
        ${data.notes.map(n => `<li class="item">${n}</li>`).join("")}
      </ul>
    </div>
  </body>
  </html>
  `;
};
