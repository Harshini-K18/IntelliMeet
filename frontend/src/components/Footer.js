import React from "react";

const Footer = () => {
  return (
    <footer className="w-full bg-light-card dark:bg-dark-card border-t border-light-accent dark:border-dark-accent mt-10">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="text-center sm:text-left">
            <div className="text-lg font-semibold text-light-text dark:text-dark-text">
              IntelliMeet - Meetings Made Seamless with AI 
            </div>
            <div className="mt-2 text-sm text-light-text/80 dark:text-dark-text/80">
              Developed by Harshini K, Pragnya R, & Prerana G
            </div>
          </div>
          <a
            href="https://github.com/Harshini-K18/IntelliMeet"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-light-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:bg-dark-accent dark:focus:ring-dark-accent/50"
          >
            View Project Repository
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;