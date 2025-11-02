import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const MeetingAnalytics = ({ transcript }) => {
  const getSpeakerWordCount = () => {
    const speakerWords = {};
    transcript.forEach(item => {
      const speaker = item.speaker;
      const words = item.text.split(' ').length;
      if (speaker in speakerWords) {
        speakerWords[speaker] += words;
      } else {
        speakerWords[speaker] = words;
      }
    });
    return speakerWords;
  };

  const speakerData = getSpeakerWordCount();

  const data = {
    labels: Object.keys(speakerData),
    datasets: [
      {
        label: 'Words Spoken',
        data: Object.values(speakerData),
        backgroundColor: [
          'rgba(255, 99, 132, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(255, 206, 86, 0.2)',
          'rgba(75, 192, 192, 0.2)',
          'rgba(153, 102, 255, 0.2)',
          'rgba(255, 159, 64, 0.2)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="bg-light-card dark:bg-dark-card p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">Meeting Analytics</h2>
      {Object.keys(speakerData).length > 0 ? (
        <Pie data={data} />
      ) : (
        <p className="text-light-text dark:text-dark-text">No speaker data available yet.</p>
      )}
    </div>
  );
};

export default MeetingAnalytics;