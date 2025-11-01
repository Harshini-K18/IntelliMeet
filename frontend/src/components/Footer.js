import React from "react";

const Footer = () => {
  return (
    <footer className="absolute bottom-0 w-full flex flex-col text-center py-6 text-sm text-primary dark:text-light">
      <a
        /*href="https://middlekid.io/" 
        target="_blank"
        rel="noreferrer"
        className="font-semibold mb-2 text-secondary dark:text-accent hover:text-primary dark:hover:text-light hover:underline transition-colors duration-200" */
      >
        Developed by: Harshini K , Prerana G, Pragnya R
      </a>
      <a
        href="https://github.com/Harshini-K18/IntelliMeet-2.0"
        target="_blank"
        rel="noreferrer"
        className="text-secondary dark:text-accent hover:text-primary dark:hover:text-light hover:underline transition-colors duration-200"
      >
        View Project Repository
      </a>
    </footer>
  );
};

export default Footer;