
const express = require("express");
const multer = require("multer");
const vision = require("@google-cloud/vision");
const { Configuration, OpenAIApi } = require("openai");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const { calculateBudget } = require("./utils/logic");

require("dotenv").config();
const upload = multer({ storage: multer.memoryStorage() });
const app = express();
app.use(express.json());

const visionClient = new vision.ImageAnnotatorClient();
const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));

const sheets = google.sheets({
  version: "v4",
  auth: new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\n/g, "\n")
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  })
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const SHEET_ID = process.env.SHEET_ID;
const SHEET_RANGE = process.env.SHEET_RANGE;

app.post("/webhook", upload.single("file"), async (req, res) => {
  try {
    const [ocrRes] = await visionClient.documentTextDetection({ image: { content: req.file.buffer } });
    const text = ocrRes.fullTextAnnotation.text;

    const interpretRes = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: `Interprete esta prescrição médica e liste o nome de cada composto e a quantidade (com formato: nome, quantidade, unidade):\n${text}`,

      max_tokens: 500
    });
    const formulaText = interpretRes.data.choices[0].text.trim();

    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE
    });
    const baseData = sheetRes.data.values;

    const budget = calculateBudget(formulaText, baseData);
    const message = \`Olá! Aqui está seu orçamento:\n\n\${budget.details}\n💰 *Total: R$ \${budget.total.toFixed(2)}*\`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "certamh@gmail.com",
      subject: "Orçamento de Manipulação",
      text: \`Orçamento enviado para cliente via WhatsApp:\n\n\${message}\`
    });

    res.json({ reply: message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Desculpe, ocorreu um erro ao processar sua receita." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Server rodando na porta \${PORT}\`));
