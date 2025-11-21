import React from "react";
import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";

const Navbar = ({ darkMode, toggleDarkMode }) => {
  return (
    <nav className="shadow-sm bg-light-card dark:bg-dark-card transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <a href="/" className="text-2xl font-bold text-light-text dark:text-dark-text">
              IntelliMeet
            </a>
          </div>
          <div className="flex items-center">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full focus:outline-none transition-colors duration-300 bg-light-accent text-light-bg dark:bg-dark-accent dark:text-dark-bg hover:opacity-90"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <SunIcon className="h-6 w-6" />
              ) : (
                <MoonIcon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;