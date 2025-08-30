import subprocess
import time

def start_recording(filename="meeting_recording.wav"):
    cmd = [
        "ffmpeg",
        "-y",
        "-f", "dshow",
        "-i", 'audio=Microphone Array (2- Realtek(R) Audio)',  # Use the exact name from ffmpeg output
        filename
    ]
    process = subprocess.Popen(cmd)
    return process

def stop_recording(process):
    process.terminate()