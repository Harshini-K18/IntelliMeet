const natural = require("natural");
const math = require("mathjs");

// 🧠 In-memory transcript storage
let storedTranscripts = [];

/* ----------------------------------------------------
   🔹 Tokenization & Similarity Utilities (for TextRank)
----------------------------------------------------- */

/**
 * Tokenizes and cleans a sentence.
 * @param {string} sentence - Input sentence.
 * @returns {string[]} - Array of tokens.
 */
const tokenizeSentence = (sentence) => {
  const tokenizer = new natural.WordTokenizer();
  return tokenizer.tokenize(sentence.toLowerCase());
};

/**
 * Calculates cosine similarity between two sentences.
 * @param {string[]} tokens1
 * @param {string[]} tokens2
 * @returns {number}
 */
const calculateSimilarity = (tokens1, tokens2) => {
  const allTokens = Array.from(new Set([...tokens1, ...tokens2]));
  const vector1 = allTokens.map((t) => tokens1.filter((x) => x === t).length);
  const vector2 = allTokens.map((t) => tokens2.filter((x) => x === t).length);

  const dot = vector1.reduce((sum, v, i) => sum + v * vector2[i], 0);
  const mag1 = Math.sqrt(vector1.reduce((sum, v) => sum + v ** 2, 0));
  const mag2 = Math.sqrt(vector2.reduce((sum, v) => sum + v ** 2, 0));

  return mag1 && mag2 ? dot / (mag1 * mag2) : 0;
};

/**
 * Generates a similarity matrix between all sentences.
 * @param {string[]} sentences
 * @returns {Matrix}
 */
const generateSimilarityMatrix = (sentences) => {
  const matrix = [];
  for (let i = 0; i < sentences.length; i++) {
    const row = [];
    for (let j = 0; j < sentences.length; j++) {
      if (i === j) {
        row.push(0);
      } else {
        const sim = calculateSimilarity(
          tokenizeSentence(sentences[i]),
          tokenizeSentence(sentences[j])
        );
        row.push(sim);
      }
    }
    matrix.push(row);
  }
  return math.matrix(matrix);
};

/**
 * Applies the TextRank algorithm to rank sentence importance.
 * @param {Matrix} similarityMatrix
 * @param {number} dampingFactor
 * @param {number} threshold
 * @returns {number[]} scores
 */
const textRank = (similarityMatrix, dampingFactor = 0.85, threshold = 0.0001) => {
  const n = similarityMatrix.size()[0];
  let scores = Array(n).fill(1 / n);
  let delta = 1;

  while (delta > threshold) {
    const newScores = Array(n).fill((1 - dampingFactor) / n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (similarityMatrix.get([j, i]) > 0) {
          newScores[i] +=
            (dampingFactor * similarityMatrix.get([j, i]) * scores[j]) /
            (similarityMatrix.get([j, j]) || 1);
        }
      }
    }
    delta = Math.max(...newScores.map((s, i) => Math.abs(s - scores[i])));
    scores = newScores;
  }

  return scores;
};

/* ----------------------------------------------------
   🗒️ Core Meeting Utilities
----------------------------------------------------- */

/**
 * Extracts actionable notes from text using predefined keywords.
 */
const takenotes = (text = "") => {
  if (!text.trim()) return "";
  const keywords = ["task",
  "job",
  "assign",
  "important",
  "deadline",
  "focus",
  "action",
  "priority",
  "reminder",
  "complete",
  "urgent",
  "follow-up",
  "deliverable",
  "progress",
  "update",
  "review",
  "meeting",
  "plan",
  "goal",
  "strategy",
  "next step",
  "milestone",
  "schedule",
  "target",
  "responsibility",
  "assignments",
  "due",
  "check",
  "note",
  "alert",
  "watch",
  "decision",
  "tasklist",
  "commitment",
  "objective" ,
  "today",
  "tomorrow",
  "week",
  "month",
  "quarter"];
  const sentences = text.split(/[.?!]\s+/);
  const notes = sentences.filter((s) =>
    keywords.some((k) => s.toLowerCase().includes(k))
  );
  return notes.length ? notes.join(". ").trim() : "";
};

/**
 * Generates structured Minutes of Meeting (MoM).
 */
const generatestructuredminutes = () => {
  if (storedTranscripts.length === 0)
    return "No transcripts available to generate structured minutes.";

  const transcript = storedTranscripts.join(". ");
  const sentences = transcript.split(/[.?!]\s+/);

  const keyPointsKeywords = ["discuss", "talk", "mention", "highlight", "focus", "note", "point", "overview", "summary", "review","update"];
  const decisionsKeywords = ["decide", "agree", "approve", "finalize", "conclude","settle","resolve","determine","choose","move forward","move ahead","move","look","plan","strategy","approach","planning"];
  const actionItemsKeywords = ["task", "assign", "responsibility", "deadline", "action", "follow-up", "complete", "due", "deliverable", "next step","commitment","objective","goal","target","schedule","assignments","check","note","alert","watch"];

  const keyPoints = sentences.filter((s) =>
    keyPointsKeywords.some((k) => s.toLowerCase().includes(k))
  );
  const decisions = sentences.filter((s) =>
    decisionsKeywords.some((k) => s.toLowerCase().includes(k))
  );
  const actionItems = sentences.filter((s) =>
    actionItemsKeywords.some((k) => s.toLowerCase().includes(k))
  );

  return `
Minutes of Meeting

Key Points:
${keyPoints.length ? keyPoints.join(". ") : "No key points identified."}

Decisions Made:
${decisions.length ? decisions.join(". ") : "No decisions made."}

Action Items:
${actionItems.length ? actionItems.join(". ") : "No action items identified."}
  `.trim();
};

/**
 * Summarizes the meeting transcript using TextRank algorithm.
 */
const summarizetranscript = () => {
  if (storedTranscripts.length === 0) return "No transcripts available to summarize.";

  const fullTranscript = storedTranscripts.join(". ");
  const sentences = fullTranscript.split(/[.?!]\s+/);

  // Step 1: Clean and filter sentences
  const cleanedSentences = sentences.filter(
    (s) =>
      s.trim().length > 5 && // Remove very short sentences
      !/^(hi|hello|hey|okay|ok|yeah|sure|hmm|how are you|thank you|bye)$/i.test(s.trim()) // Remove meaningless sentences
  );

  if (cleanedSentences.length === 0) {
    return "No meaningful sentences found to summarize.";
  }

  // Step 2: Generate similarity matrix
  const similarityMatrix = generateSimilarityMatrix(cleanedSentences);

  // Step 3: Apply TextRank algorithm
  const scores = textRank(similarityMatrix);

  // Step 4: Rank sentences by TextRank score
  const rankedSentences = cleanedSentences
    .map((sentence, index) => ({ sentence, score: scores[index] }))
    .sort((a, b) => b.score - a.score);

  // Step 5: Boost sentences with meeting-specific keywords
  const meetingKeywords = ["decide", "discuss", "assign", "task", "deadline", "plan", "agree"];
  rankedSentences.forEach((item) => {
    const keywordBoost = meetingKeywords.some((k) => item.sentence.toLowerCase().includes(k))
      ? 0.2 // Boost score by 20% if it contains a meeting keyword
      : 0;
    item.score += keywordBoost;
  });

  // Step 6: Sort again after boosting
  rankedSentences.sort((a, b) => b.score - a.score);

  // Step 7: Select top sentences (limit to 5 sentences)
  const topSentences = rankedSentences
    .slice(0, Math.min(5, rankedSentences.length)) // Select top 3–5 sentences
    .map((item) => item.sentence);

  // Step 8: Remove redundancy (avoid repeating similar sentences)
  const uniqueSentences = [];
  const sentenceSet = new Set();
  topSentences.forEach((sentence) => {
    const tokens = tokenizeSentence(sentence);
    const sentenceKey = tokens.join(" ");
    if (!sentenceSet.has(sentenceKey)) {
      uniqueSentences.push(sentence);
      sentenceSet.add(sentenceKey);
    }
  });

  return `Meeting Summary:\n${uniqueSentences.join(". ")}.`;
};

/**
 * Adds a new transcript chunk.
 */
const addTranscript = (newText) => {
  if (newText && newText.trim()) storedTranscripts.push(newText.trim());
};

/* ----------------------------------------------------
   🧩 Exports
----------------------------------------------------- */
module.exports = {
  takenotes,
  generatestructuredminutes,
  summarizetranscript,
  addTranscript,
  storedTranscripts,
};
