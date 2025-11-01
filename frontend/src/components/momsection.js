import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";


const socket = io("http://localhost:3001");


const MomSection = ({ darkMode }) => {
  const [meetingsofminutes, setMeetingsofminutes] = useState("");


  useEffect(() => {
    // Listen for the "meetingsofminutes" event from the backend
    socket.on("meetingsofminutes", (data) => {
      console.log("Received MoM:", data); // Debugging log
      setMeetingsofminutes(data.meetingsofminutes);
    });


    // Cleanup the socket listener on component unmount
    return () => socket.off("meetingsofminutes");
  }, []);


  return (
    <div className={`py-10 ${darkMode ? 'bg-primary text-light-text' : 'bg-light text-gray-800'}`}>
      <div className={`p-6 rounded-md shadow-md max-w-3xl w-full mx-auto ${darkMode ? 'bg-secondary' : 'bg-accent-light'}`}>
        <h2 className="text-2xl font-semibold mb-4 text-center">Minutes of Meeting</h2>
        <pre className="whitespace-pre-wrap text-center">
          {meetingsofminutes || "Minutes of Meeting will appear here after the meeting."}
        </pre> 
      </div> <br /> <br />
    </div> 
  );
};


export default MomSection;