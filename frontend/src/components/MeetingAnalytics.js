import React from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const MeetingAnalytics = ({ transcript }) => {
  const getInteractionData = () => {
    const interactionCounts = {};

    transcript.forEach((item) => {
      const speaker = item.speaker || "Unknown Speaker";
      interactionCounts[speaker] = (interactionCounts[speaker] || 0) + 1;
    });

    return interactionCounts;
  };

  const interactionData = getInteractionData();
  const maxCount = Math.max(...Object.values(interactionData), 0);

  const data = {
    labels: Object.keys(interactionData),
    datasets: [
      {
        label: "Number of Interactions",
        data: Object.values(interactionData),
        backgroundColor: [
          "rgba(255, 99, 132, 0.2)",
          "rgba(54, 162, 235, 0.2)",
          "rgba(255, 206, 86, 0.2)",
          "rgba(75, 192, 192, 0.2)",
          "rgba(153, 102, 255, 0.2)",
          "rgba(255, 159, 64, 0.2)",
        ],
        borderColor: [
          "rgba(255, 99, 132, 1)",
          "rgba(54, 162, 235, 1)",
          "rgba(255, 206, 86, 1)",
          "rgba(75, 192, 192, 1)",
          "rgba(153, 102, 255, 1)",
          "rgba(255, 159, 64, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="bg-light-card dark:bg-dark-card p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">
        Interaction Levels
      </h2>

      {Object.keys(interactionData).length > 0 ? (
        <>
          {/* PIE CHART */}
          <div className="w-full h-64 mb-4">
            <Pie data={data} options={{ maintainAspectRatio: false }} />
          </div>

          {/* BAR DETAILS */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-light-text dark:text-dark-text">
              Interaction Details
            </h3>

            <div className="space-y-4">
              {Object.entries(interactionData).map(([person, count]) => {
                const barWidth =
                  maxCount > 0 ? (count / maxCount) * 100 : 0;

                return (
                  <div key={person}>
                    <div className="flex justify-between mb-1">
                      <span className="text-base font-medium text-light-text dark:text-dark-text">
                        {person}
                      </span>
                      <span className="text-sm font-medium text-light-text dark:text-dark-text">
                        {count} interactions
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div
                        className="bg-light-accent dark:bg-dark-accent h-2.5 rounded-full"
                        style={{ width: `${barWidth}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <p className="text-light-text dark:text-dark-text">
          No interaction data available yet.
        </p>
      )}
    </div>
  );
};

export default MeetingAnalytics;
