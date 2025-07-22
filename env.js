// env.js
module.exports = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_SHEETS_CLIENT_EMAIL: 'leitor-de-planilhas@orcamento-farmacia.iam.gserviceaccount.com',
  GOOGLE_SHEETS_PRIVATE_KEY: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};
