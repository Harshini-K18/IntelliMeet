import React from "react";

const Footer = () => {
  return (
    <footer className="w-full flex flex-col text-center py-6 text-sm text-light-text dark:text-dark-text mt-10">
      <div className="font-semibold mb-2">
        Developed by: Harshini K , Pragnya R , Prerana G
      </div>
      <a
        href="https://github.com/Harshini-K18/IntelliMeet-2.0"
        target="_blank"
        rel="noreferrer"
        className="text-light-accent dark:text-dark-accent hover:opacity-80 hover:underline transition-colors duration-200"
      >
        View Project Repository
      </a>
    </footer>
  );
};

export default Footer;
