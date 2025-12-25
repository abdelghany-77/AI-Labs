require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const path = require("path");

let pdfParse = require("pdf-parse");
console.log("pdf-parse require type:", typeof pdfParse);
try {
  console.log("pdf-parse keys:", Object.keys(pdfParse));
} catch (e) {}
console.log("pdf-parse has default:", !!(pdfParse && pdfParse.default));
if (typeof pdfParse !== "function" && pdfParse.default) {
  pdfParse = pdfParse.default;
}

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: "50mb" }));
app.use(cors());
app.use(express.static(path.join(process.cwd(), "public")));

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.post("/api/upload-pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("Processing PDF...");

    if (typeof pdfParse === "function") {
      const data = await pdfParse(req.file.buffer);
      return res.json({ text: data.text });
    }

    if (pdfParse && typeof pdfParse.PDFParse === "function") {
      const parser = new pdfParse.PDFParse({ data: req.file.buffer });
      const result = await parser.getText();
      if (typeof parser.destroy === "function") await parser.destroy();
      return res.json({ text: result.text });
    }

    throw new Error("Unsupported pdf-parse export shape");

    console.log("PDF Parsed Successfully");
    res.json({ text: data.text });
  } catch (error) {
    console.error("PDF Parsing Error:", error);
    res.status(500).json({ error: `Failed to parse PDF: ${error.message}` });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, provider } = req.body;
    let botResponse = "";

    // --- OpenAI ---
    if (provider === "openai") {
      const response = await axios.post(
        OPENAI_API_URL,
        {
          model: "gpt-4o-mini",
          temperature: 0.7,
          messages: messages,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
        }
      );
      botResponse = response.data.choices[0].message.content;
    }
    // --- Gemini ---
    else if (provider === "gemini") {
      const geminiContents = messages.map((msg) => {
        const role = msg.role === "assistant" ? "model" : "user";

        if (typeof msg.content === "string") {
          return { role, parts: [{ text: msg.content }] };
        }

        if (Array.isArray(msg.content)) {
          const parts = msg.content.map((item) => {
            if (item.type === "text") {
              return { text: item.text };
            } else if (item.type === "image_url") {
              const [meta, base64Data] = item.image_url.url.split(",");
              const mimeType = meta.split(":")[1].split(";")[0];
              return { inline_data: { mime_type: mimeType, data: base64Data } };
            }
          });
          return { role, parts };
        }
        return { role, parts: [{ text: "" }] };
      });

      const response = await axios.post(
        `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
        { contents: geminiContents },
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.candidates && response.data.candidates.length > 0) {
        botResponse = response.data.candidates[0].content.parts[0].text;
      } else {
        botResponse = "No response from Gemini.";
      }
    }

    res.json({ role: "assistant", content: botResponse });
  } catch (error) {
    console.error(
      "Chat Error:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Server Error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
