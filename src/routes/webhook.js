import express from "express";
import twilio from "twilio";
import { devLog } from "../helpers/logger.js";

import { interpretMessageWithAI } from "../services/aiService.js";
import {
  calculateTotalExpenses,
  getExpensesReport,
  getCategoryReport,
  getCurrentTotalSpent
} from "../helpers/totalUtils.js";
import {
  generateChart,
  generateCategoryChart,
} from "../services/chartService.js";
import { sendReportImage } from "../services/twilioService.js";
import Expense from "../models/Expense.js";
import UserStats from "../models/UserStats.js";
import { customAlphabet } from "nanoid";
import {
  sendGreetingMessage,
  sendHelpMessage,
  sendExpenseAddedMessage,
  sendExpenseDeletedMessage,
  sendTotalExpensesMessage,
  sendTotalExpensesAllMessage,
  sendFinancialHelpMessage,
  sendTotalExpensesLastMonthsMessage,
} from "../helpers/messages.js";
import { VALID_CATEGORIES } from "../utils/constants.js";
import { hasAcessToFeature } from "../helpers/userUtils.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();
  const userMessage = req.body.Body;
  const userId = req.body.From;

  const generateId = customAlphabet("1234567890abcdef", 5);

  try {
    const interpretation = await interpretMessageWithAI(userMessage);
    
    switch (interpretation.intent) {
      case "add_expense":
        const { amount, description, category } = interpretation.data;
        devLog(amount, description, category);
        devLog("Verificando se categoria é válida e acesso a categoria customizada...");
        const userHasFreeCategorization = await hasAcessToFeature(userId, "add_expense_new_category");

        if (VALID_CATEGORIES.includes(category) && !userHasFreeCategorization) {
          const newExpense = new Expense({
            userId,
            amount,
            description,
            category,
            date: new Date(),
            messageId: generateId(),
          });
          devLog("Salvando nova despesa:", newExpense);
          await newExpense.save();
          devLog("Enviando mensagem de confirmação ao usuário.");
          sendExpenseAddedMessage(twiml, newExpense);
          await UserStats.findOneAndUpdate(
            { userId },
            { $inc: { totalSpent: amount } },
            { upsert: true }
          );
        } else {
          const regex = new RegExp(description, "i");

          const similarExpense = await Expense.findOne({
            userId,
            description: { $regex: regex }
          }).sort({ date: -1 });

          if (userHasFreeCategorization && similarExpense?.category) {
            const inferredCategory = similarExpense.category;

            const newExpense = new Expense({
              userId,
              amount,
              description,
              category: inferredCategory,
              date: new Date(),
              messageId: generateId(),
            });
            devLog("Salvando nova despesa:", newExpense);
            await newExpense.save();
            devLog("Enviando mensagem de confirmação ao usuário.");
            sendExpenseAddedMessage(twiml, newExpense);
            await UserStats.findOneAndUpdate(
              { userId },
              { $inc: { totalSpent: amount } },
              { upsert: true }
            );
          } else {
            const fallbackCategory = VALID_CATEGORIES.includes(category) ? category : "outro";

            const newExpense = new Expense({
              userId,
              amount,
              description,
              category: fallbackCategory,
              date: new Date(),
              messageId: generateId(),
            });
            devLog("Salvando nova despesa:", newExpense);
            await newExpense.save();
            devLog("Enviando mensagem de confirmação ao usuário.");
            sendExpenseAddedMessage(twiml, newExpense);
            await UserStats.findOneAndUpdate(
              { userId },
              { $inc: { totalSpent: amount } },
              { upsert: true }
            );
          }
        }

        
        break;

      case "add_expense_new_category":
        if (!(await hasAcessToFeature(userId, "add_expense_new_category"))) {
          twiml.message("🚫 Este recurso está disponível como um complemento pago. Acesse o site para ativar: ")
          break;
        }

        const { amount: newAmount, description: newDescription, category: newCategory } = interpretation.data;

        //Adiciona a nova categoria ao banco
        if (!VALID_CATEGORIES.includes(newCategory)) {
          const userStats = await UserStats.findOneAndUpdate(
            { userId },
            { $addToSet: { createdCategories: newCategory} }, 
            { new: true, upsert: true } 
          );

          const newExpense = new Expense({
            userId,
            amount: newAmount,
            description: newDescription,
            category: newCategory,
            date: new Date(),
            messageId: generateId(),
          });
          devLog("Salvando nova despesa:", newExpense);
          await newExpense.save();
          devLog("Enviando mensagem de confirmação ao usuário.");
          sendExpenseAddedMessage(twiml, newExpense);
          await UserStats.findOneAndUpdate(
            { userId },
            { $inc: { totalSpent: newAmount } },
            { upsert: true }
          );
        } else {
          sendHelpMessage(twiml);
        }

        break;

      case "delete_expense":
        const { messageId } = interpretation.data;

        try {
          const expense = await Expense.findOneAndDelete({ userId, messageId });

          if (expense) {
            const isCustomCategory = !VALID_CATEGORIES.includes(expense.category);

            if (isCustomCategory) {
              const count = await Expense.countDocuments({ userId, category: expense.category });
              if (count === 0) {
                await UserStats.findOneAndUpdate(
                  { userId },
                  { $pull: { createdCategories: expense.category } }
                );
              }
            }

            sendExpenseDeletedMessage(twiml, expense);
            await UserStats.findOneAndUpdate(
              { userId },
              { $inc: { totalSpent: -expense.amount } }
            );
          } else {
            twiml.message(`🚫 Nenhum gasto encontrado com o ID #_${messageId}_ para exclusão.`);
          }
        } catch (error) {
          devLog("Erro ao excluir despesa pelo messageId:", error);
          twiml.message("🚫 Ocorreu um erro ao tentar excluir a despesa. Tente novamente.");
        }
        break;

      case "generate_daily_chart":
        try {
          const days = interpretation.data.days || 7;
          const reportData = await getExpensesReport(userId, days);

          if (reportData.length === 0) {
            twiml.message(
              `📉 Não há registros de gastos nos últimos ${days} dias.`
            );
          } else {
            const imageUrl = await generateChart(reportData, userId);
            await sendReportImage(userId, imageUrl);
          }
        } catch (error) {
          devLog("Erro ao gerar gráfico:", error);
          twiml.message(
            "❌ Ocorreu um erro ao gerar o relatório. Tente novamente."
          );
        }
        break;

      case "generate_category_chart":
        try {
          const days = interpretation.data.days || 30; // Por padrão, pega os últimos 30 dias
          const categoryReport = await getCategoryReport(userId, days);

          if (categoryReport.length === 0) {
            twiml.message(
              `📊 Não há registros de gastos nos últimos ${days} dias para gerar um relatório por categoria.`
            );
          } else {
            const imageFilename = await generateCategoryChart(
              categoryReport,
              userId
            );
            await sendReportImage(userId, imageFilename);
          }
        } catch (error) {
          devLog("Erro ao gerar gráfico por categorias:", error);
          twiml.message(
            "❌ Ocorreu um erro ao gerar o relatório por categorias. Tente novamente."
          );
        }
        break;

      case "get_total":
        const total = await calculateTotalExpenses(
          userId,
          interpretation.data.category
        );
        sendTotalExpensesMessage(twiml, total, interpretation.data.category);
        break;

      case "get_total_all":
        const totalAll = await getCurrentTotalSpent(userId);
        sendTotalExpensesAllMessage(twiml, totalAll);
        break;

      case "get_total_last_months":
        const getCurrentMonthFormatted = () => {
          const date = new Date();
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0'); // +1 porque janeiro = 0
          return `${year}-${month}`;
        };

        const currentMonth = getCurrentMonthFormatted();

        const monthName = interpretation.data.monthName;

        const interpretationDataMonth = interpretation.data.month;

        if (interpretationDataMonth < "2025-01" || interpretationDataMonth > currentMonth) {
          twiml.message("🚫 Mês inválido. Tente novamente.");
          break;
        } else {
          const spendingHistoryLastMonths = await UserStats.aggregate([
            { $match: { userId } },
            { $unwind: "$spendingHistory" },
            { $match: { "spendingHistory.month": interpretationDataMonth } },
            { $group: { _id: null, total: { $sum: "$spendingHistory.amount" } } },
          ]);

          sendTotalExpensesLastMonthsMessage(
            twiml,
            spendingHistoryLastMonths,
            monthName
          );
        }

        break;

      case "greeting":
        sendGreetingMessage(twiml);
        break;

      case "financial_help":
        if (!(await hasAcessToFeature(userId, "financial_help"))) {
          twiml.message("🚫 Este recurso está disponível como um complemento pago. Acesse o site para ativar.");
          break;
        }
        await sendFinancialHelpMessage(twiml, userMessage);
        break;

      default:
        sendHelpMessage(twiml);
        break;
    }
  } catch (err) {
    devLog("Erro ao interpretar a mensagem:", err);
    sendHelpMessage(twiml);
  }

  devLog("Resposta final do Twilio:", twiml.toString());
  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end(twiml.toString());
});

export default router;
