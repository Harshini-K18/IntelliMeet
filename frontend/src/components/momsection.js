import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

const MomSection = () => {
  const [meetingsofminutes, setMeetingsofminutes] = useState("");

  useEffect(() => {
    const handleMoM = (data) => {
      console.log("Received MoM:", data); // Debugging log
      // Replace the existing minutes with the new ones
      setMeetingsofminutes(data.meetingsofminutes);
    };

    // Listen for the "meetingsofminutes" event from the backend
    socket.on("meetingsofminutes", handleMoM);

    // Cleanup the socket listener on component unmount
    return () => {
      socket.off("meetingsofminutes", handleMoM);
    };
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4 text-center text-light-text dark:text-dark-text">
        Minutes of Meeting
      </h2>
      <pre className="whitespace-pre-wrap text-center font-sans text-light-text dark:text-dark-text">
        {meetingsofminutes ||
          "Minutes of Meeting will appear here after the meeting."}
      </pre>
    </div>
  );
};

export default MomSection;