from collections import defaultdict

def speaker_stats(segments):
    # If diarization not added yet, everything will be under "S1"
    stats = defaultdict(lambda: {"turns": 0, "talk_time": 0.0, "words": 0})
    for s in segments:
        spk = s.get("speaker", "S1")
        stats[spk]["turns"] += 1
        stats[spk]["talk_time"] += max(0.0, s["end"] - s["start"])
        stats[spk]["words"] += len(s["text"].split())
    # return as list for JSON friendliness
    return [{"speaker": k, **v} for k, v in stats.items()]
