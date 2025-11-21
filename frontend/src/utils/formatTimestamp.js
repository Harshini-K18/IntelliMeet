export function formatTimestamp(ts) {
  if (!ts) return "Unknown";

  // Case 1: ISO string
  let d = new Date(ts);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Case 2: numeric timestamps (ms or microseconds)
  const num = Number(ts);
  if (!isNaN(num)) {
    d = new Date(num > 1e13 ? num / 1000 : num); // convert microseconds to ms
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  }

  return "Unknown";
}
