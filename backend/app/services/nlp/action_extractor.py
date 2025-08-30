import re
from typing import List, Dict

ACTION_PAT = re.compile(r"\b(please|can you|assign|we will|let's|by\s+\w+day|\bETA\b|\bdue\b)\b", re.IGNORECASE)

def extract_action_items(segments: List[Dict]) -> List[Dict]:
    """
    Input: segments [{start, end, text, speaker?}]
    Output: [{title, owner, due_date, source_span}]
    """
    items = []
    for s in segments:
        t = s["text"]
        if ACTION_PAT.search(t):
            owner = None
            m = re.search(r"\b([A-Z][a-z]+)\b(?:\s+will|\s+to)", t)  # naive owner
            if m: owner = m.group(1)
            due = None
            d = re.search(r"\b(by\s+(Monday|Tuesday|Wednesday|Thursday|Friday|tomorrow|EOD|next week)\b)", t, re.I)
            if d: due = d.group(1)
            items.append({
                "title": t[:160],
                "owner": owner or "Unassigned",
                "due_date": due,
                "source_span": {"start": s["start"], "end": s["end"]}
            })
    return items
