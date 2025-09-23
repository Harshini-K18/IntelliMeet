import React from "react";

const Footer = () => {
  return (
    <footer className="absolute bottom-0 w-full flex flex-col text-center py-6 text-sm text-gray-900 dark:text-white">
      <a
        href="https://middlekid.io/"
        target="_blank"
        rel="noreferrer"
        className="font-semibold mb-2 text-blue-600 dark:text-yellow-500 hover:text-blue-700 dark:hover:text-yellow-600 hover:underline transition-colors duration-200"
      >
        Harshini K
      </a>
      <a
        href="https://github.com/Prerana-G/IntelliMeet-transcriber"
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 dark:text-yellow-500 hover:text-blue-700 dark:hover:text-yellow-600 hover:underline transition-colors duration-200"
      >
        View Project Repository
      </a>
    </footer>
  );
};

export default Footer;