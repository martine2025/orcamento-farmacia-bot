const env = require('./env');
const OPENAI_API_KEY = env.OPENAI_API_KEY;
const GOOGLE_SHEETS_CLIENT_EMAIL = env.GOOGLE_SHEETS_CLIENT_EMAIL;
const GOOGLE_SHEETS_PRIVATE_KEY = env.GOOGLE_SHEETS_PRIVATE_KEY;
const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");
const vision = require("@google-cloud/vision");
const { calculateBudget } = require("./utils/logic");
console.log("🔍 TODAS VARIÁVEIS DE AMBIENTE:");
console.log(JSON.stringify(process.env, null, 2));


require("dotenv").config();
console.log("🔍 OPENAI_API_KEY carregada:", process.env.OPENAI_API_KEY);
console.log("🔍 GOOGLE_SHEETS_CLIENT_EMAIL carregada:", process.env.GOOGLE_SHEETS_CLIENT_EMAIL);

const app = express();
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// Validação de variáveis de ambiente
const requiredEnv = [
  "OPENAI_API_KEY",
  "GOOGLE_SHEETS_CLIENT_EMAIL",
  "GOOGLE_SHEETS_PRIVATE_KEY",
  "EMAIL_USER",
  "EMAIL_PASS",
  "SHEET_ID",
  "SHEET_RANGE"
];

requiredEnv.forEach((name) => {
  if (!process.env[name]) {
    console.error(`❌ Variável de ambiente ${name} não está definida.`);
    process.exit(1);
  }
});

// Inicializando OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Inicializando Vision API
const visionClient = new vision.ImageAnnotatorClient();

// Inicializando Google Sheets
const sheets = google.sheets({
  version: "v4",
  auth: new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, "\n")
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  })
});

// Inicializando Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const SHEET_ID = process.env.SHEET_ID;
const SHEET_RANGE = process.env.SHEET_RANGE;

app.post("/webhook", upload.single("file"), async (req, res) => {
  try {
    const [ocrRes] = await visionClient.documentTextDetection({
      image: { content: req.file.buffer }
    });

    const text = ocrRes.fullTextAnnotation.text;

    const interpretRes = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{
        role: "user",
        content: `Interprete esta prescrição médica e liste o nome de cada composto e a quantidade (com formato: nome, quantidade, unidade):\n${text}`
      }]
    });

    const formulaText = interpretRes.choices[0].message.content.trim();

    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE
    });

    const baseData = sheetRes.data.values;

    const budget = calculateBudget(formulaText, baseData);

    const message = `Olá! Aqui está seu orçamento:\n\n${budget.details}\n💰 *Total: R$ ${budget.total.toFixed(2)}*`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "certamh@gmail.com",
      subject: "Orçamento de Manipulação",
      text: `Orçamento enviado para cliente via WhatsApp:\n\n${message}`
    });

    res.json({ reply: message });
  } catch (err) {
    console.error("❌ Erro ao processar receita:", err);
    res.status(500).json({ reply: "Desculpe, ocorreu um erro ao processar sua receita." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));

