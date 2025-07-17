
function parseFormula(text) {
  const lines = text.split("\n").filter(l => l.trim());
  return lines.map(l => {
    const [name, qty, unit] = l.split(",");
    return { name: name.trim(), qty: parseFloat(qty), unit: unit.trim() };
  });
}

function calculateBudget(formulaText, baseData) {
  const items = parseFormula(formulaText);
  let total = 0;
  let details = "";

  items.forEach(item => {
    const row = baseData.find(r => r[0].toLowerCase() === item.name.toLowerCase());
    if (!row) {
      details += `⚠️ *${item.name}*: preço não encontrado\n`;
      return;
    }
    const pricePerUnit = parseFloat(row[1]);
    const cost = pricePerUnit * item.qty;
    total += cost;
    details += `• ${item.name}: ${item.qty} ${item.unit} × R$ ${pricePerUnit.toFixed(2)} = R$ ${cost.toFixed(2)}\n`;
  });

  return { total, details };
}

module.exports = { calculateBudget };
