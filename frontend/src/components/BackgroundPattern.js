// src/components/BackgroundPattern.js
import React from 'react';

const BackgroundPattern = () => {
  return (
    <div 
      className="fixed inset-0 -z-10"
      style={{
        '--light-color': 'rgba(79, 155, 255, 0.05)',  // Light blue
        '--dark-color': 'rgba(231, 144, 173, 0.05)',  // Light pink
      }}
    >
      {/* Main background with subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white dark:from-gray-900 to-gray-50 dark:to-gray-800" />
      
      {/* Watermark pattern */}
      <div 
        className="absolute inset-0 opacity-20 dark:opacity-10"
        style={{
          backgroundImage: `
            radial-gradient(
              circle at 25% 25%,
              var(--light-color) 0%,
              transparent 15%
            ),
            radial-gradient(
              circle at 75% 75%,
              var(--dark-color) 0%,
              transparent 15%
            )
          `,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
      {/* Subtle noise texture */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%\' height=\'100%\' filter=\'url(%23noiseFilter)\' /%3E%3C/svg%3E")',
          backgroundSize: '200px',
        }}
      />
    </div>
  );
};

export default BackgroundPattern;