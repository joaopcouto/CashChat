import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function sendGreetingMessage(twiml) {
  twiml.message(`👋 Oi, eu sou a ADAP – sua Assistente Direta ao Ponto.

Fui criada para te ajudar a organizar suas finanças de forma simples, direto por aqui no WhatsApp, sem complicação. 📊💸

Comigo, você consegue:

1️⃣ Anotar seus gastos em segundos
2️⃣ Acompanhar seus gastos por categoria (Lazer, Gastos fixos, etc.)
3️⃣ Acompanhar seu gasto total
4️⃣ Simples de remover um gasto caso anote errado
5️⃣ Gerar relatório de gastos por dia da semana
6️⃣ Gerar relatório de gastos por categoria
7️⃣ Dicas financeiras para o seu dia a dia

E tudo isso de forma automática. É só me mandar mensagens simples como:

1️⃣ "25 mercado"
2️⃣ "gasto total lazer"
3️⃣ "gasto total"
4️⃣ "remover #(código do gasto)"
5️⃣ "quanto gastei nos últimos 7 dias"
6️⃣ "onde foram meus gastos nos últimos 7 dias"
7️⃣ "onde posso deixar meu dinheiro para render mais?"


🔐 Seus dados são 100% seguros e privados.

Ah, e aproveita pra me seguir no Instagram também: @economia.em.30seg

Lá tem dicas diárias pra você gastar melhor e fazer seu dinheiro render mais! 🚀`);
}

export function sendHelpMessage(twiml) {
  twiml.message(`👋 Oi, eu sou a ADAP – sua Assistente Direta ao Ponto.

Fui criada para te ajudar a organizar suas finanças de forma simples, direto por aqui no WhatsApp, sem complicação. 📊💸

Comigo, você consegue:

1️⃣ Anotar seus gastos e receitas em segundos
2️⃣ Acompanhar seus gastos por categoria (Lazer, Gastos fixos, etc.)
3️⃣ Acompanhar seu gasto ou receita total
4️⃣ Simples de remover um gasto caso anote errado
5️⃣ Gerar relatório de gastos por dia da semana
6️⃣ Gerar relatório de gastos por categoria

E tudo isso de forma automática. É só me mandar mensagens simples como:

1️⃣ "25 mercado" ou "recebi 200 salário"
2️⃣ "gasto total lazer"
3️⃣ "gasto total" ou "receita total"
4️⃣ "remover #(código do gasto/receita)"
5️⃣ "quanto gastei nos últimos 7 dias"
6️⃣ "onde foram meus gastos nos últimos 7 dias"


🔐 Seus dados são 100% seguros e privados.

Ah, e aproveita pra me seguir no Instagram também: @economia.em.30seg

Lá tem dicas diárias pra você gastar melhor e fazer seu dinheiro render mais! 🚀`);
}

export function sendIncomeAddedMessage(twiml, incomeData) {
  twiml.message(
    `📝 *Receita adicionada*\n📌 ${incomeData.description.toUpperCase()} (_${
      incomeData.category.charAt(0).toUpperCase() +
      incomeData.category.slice(1)
    }_)\n💰 *R$ ${incomeData.amount.toFixed(
      2
    )}*\n\n📅 ${incomeData.date.toLocaleDateString("pt-BR")} - #${
      incomeData.messageId
    }`
  )
};

export function sendExpenseAddedMessage(twiml, expenseData) {
  twiml.message(
    `📝 *Gasto adicionado*\n📌 ${expenseData.description.toUpperCase()} (_${
      expenseData.category.charAt(0).toUpperCase() +
      expenseData.category.slice(1)
    }_)\n💰 *R$ ${expenseData.amount.toFixed(
      2
    )}*\n\n📅 ${expenseData.date.toLocaleDateString("pt-BR")} - #${
      expenseData.messageId
    }`
  );
}

export function sendIncomeDeletedMessage(twiml, incomeData) {
  twiml.message(`🗑️ Receita #_${incomeData.messageId}_ removida.`);
}

export function sendExpenseDeletedMessage(twiml, expenseData) {
  twiml.message(`🗑️ Gasto #_${expenseData.messageId}_ removido.`);
}

export function sendTotalExpensesMessage(twiml, total, category, type) {
  const categoryMessage = category
  ? ` em _*${category.charAt(0).toUpperCase() + category.slice(1)}*_`
  : "";
  const typeLabel = type === "income" ? "Receita" : "Gasto";
  twiml.message(`*${typeLabel} total*${categoryMessage}:\nR$ ${total.toFixed(2)}`);
}

export function sendTotalIncomeMessage(twiml, total) {
  twiml.message(`*Receita total*:\nR$ ${total.toFixed(2)}`);
}

export function sendTotalExpensesAllMessage(twiml, total) {
  twiml.message(`*Gasto total*:\nR$ ${total.toFixed(2)}`);
}

export function sendTotalExpensesLastMonthsMessage(twiml, spendingHistoryLastMonths, monthName) {
  twiml.message(`*Gasto total em ${monthName}*:\nR$ ${spendingHistoryLastMonths[0].total.toFixed(2)}`);
}

export async function sendFinancialHelpMessage(twiml, message) {
  const prompt = `You are a financial assistant who specializes in helping users with questions about investments, personal finance and planning. Please answer the following question clearly and helpfully, in Brazilian Portuguese:

  "${message}"`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
  });

  twiml.message(response.choices[0].message.content);
}

