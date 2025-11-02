import React, { useState, useEffect } from 'react';

const ActionItemsSection = ({ transcript }) => {
  const [actionItems, setActionItems] = useState([]);

  useEffect(() => {
    const detectActionItems = () => {
      const items = [];
      const keywords = ['action item', 'task', 'follow up', 'to-do'];
      transcript.forEach(item => {
        const text = item.text.toLowerCase();
        keywords.forEach(keyword => {
          if (text.includes(keyword)) {
            items.push(item.text);
          }
        });
      });
      setActionItems([...new Set(items)]); // Remove duplicates
    };

    detectActionItems();
  }, [transcript]);

  const exportToJira = (task) => {
    const jiraUrl = `https://YOUR_JIRA_INSTANCE.atlassian.net/secure/CreateIssueDetails!init.jspa?summary=${encodeURIComponent(task)}`;
    window.open(jiraUrl, '_blank');
  };

  const exportToAsana = (task) => {
    const asanaUrl = `https://app.asana.com/0/0/list?text=${encodeURIComponent(task)}`;
    window.open(asanaUrl, '_blank');
  };

  const exportToTrello = (task) => {
    const trelloUrl = `https://trello.com/add-card?name=${encodeURIComponent(task)}`;
    window.open(trelloUrl, '_blank');
  };

  return (
    <div className="bg-light-card dark:bg-dark-card p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">Action Items</h2>
      {actionItems.length > 0 ? (
        <ul>
          {actionItems.map((item, index) => (
            <li key={index} className="mb-2 text-light-text dark:text-dark-text">
              {item}
              <div className="mt-2">
                <button onClick={() => exportToJira(item)} className="bg-blue-500 text-white px-2 py-1 rounded mr-2">Export to Jira</button>
                <button onClick={() => exportToAsana(item)} className="bg-pink-500 text-white px-2 py-1 rounded mr-2">Export to Asana</button>
                <button onClick={() => exportToTrello(item)} className="bg-green-500 text-white px-2 py-1 rounded">Export to Trello</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-light-text dark:text-dark-text">No action items detected.</p>
      )}
    </div>
  );
};

export default ActionItemsSection;