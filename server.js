// server.js
const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");  // or any HTTP client
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;  // you must set this in your .env file

// Helper: call Gemini generateContent endpoint
async function callGemini(prompt) {
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  const body = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    // you may add systemInstruction, etc. per docs
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

app.post("/analyze_tabs", async (req, res) => {
  const tabs = req.body.tabs;
  if (!Array.isArray(tabs)) {
    return res.status(400).json({ error: "Invalid tabs data" });
  }

  // Build a prompt for Gemini
  let prompt = "You are assessing whether the following browser tabs indicate the user is procrastinating rather than working. \n";
  prompt += "Here are the tabs:\n";
  for (const tab of tabs) {
    prompt += `- Title: ${tab.title || "N/A"}, URL: ${tab.url || "N/A"}\n`;
  }
  prompt += "\nPlease respond with: \"Procrastinating\" or \"Focused\", and a brief reasoning.";

  try {
    const aiResponse = await callGemini(prompt);
    // Example: the model response is in aiResponse.contents[0].parts[0].text
    const resultText = aiResponse.contents?.[0]?.parts?.[0]?.text || "No response";

    return res.json({ status: resultText });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
