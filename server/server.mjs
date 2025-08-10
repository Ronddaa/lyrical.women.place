import express from "express";
import cors from "cors";
import axios from "axios";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import env from "./utils/env.js";
import cookieParser from "cookie-parser";
import initMongoConnection from "./db/initMongoConnection.js";
import router from "./routers/index.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import {
  upsertunifieduser,
  updateunifieduserById,
} from "./services/unifiedusers.js";
import { utmTracker } from "./middlewares/utmMarks.js";
import { unifiedusersCollection } from "./db/models/unifiedusers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

await initMongoConnection();

const app = express();

const allowedOrigins = [
  "https://lyrical.women.place",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.1.4.138:3000",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,POST,PUT,DELETE,PATCH",
  allowedHeaders: "Content-Type,Authorization",
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

app.use(utmTracker);
app.use("/api", router);

const monoBankToken = env("MONOBANK_TOKEN");
const monoBankRedirectUrl = env(
  "MONOBANK_REDIRECT_URL",
  "https://lyrical.women.place/thank-you"
);
const monoBankWebhookUrl = env(
  "MONOBANK_WEBHOOK_URL",
  "https://lyrical.women.place/api/payment-callback"
);

const PORT = env("PORT", 3000);
const HOST = env("HOST", "0.0.0.0");

app.post("/api/create-payment", async (req, res, next) => {
  const { user, conferences } = req.body;

  if (
    !user ||
    !conferences ||
    !Array.isArray(conferences) ||
    conferences.length === 0
  ) {
    return res
      .status(400)
      .json({ error: "Missing required fields or invalid format" });
  }

  try {
    const fixedAmountUAH = 1500 * 100;

    const { unifieduser, conferenceIndex } = await upsertunifieduser({
      user,
      conferences,
    });
    const conferenceId = unifieduser.conferences[conferenceIndex]._id; // Эта строка была удалена, но её лучше вернуть, чтобы использовать в merchantPaymInfo

    const redirectUrl = monoBankRedirectUrl;

    // ⬅️ Объявляем объект body здесь
    const body = {
      amount: fixedAmountUAH,
      ccy: 980,
      redirectUrl,
      webHookUrl: monoBankWebhookUrl,
      merchantPaymInfo: {
        // Добавляем merchantPaymInfo обратно
        reference: `conf-${conferenceId}-${Date.now()}`,
        destination: `Оплата участия в конференции "${conferences[0].conference}"`,
      },
    };

    console.log("📤 Запрос в Monobank:", JSON.stringify(body, null, 2));

    const monoResponse = await axios.post(
      "https://api.monobank.ua/api/merchant/invoice/create",
      body, // ⬅️ Используем объявленный объект body
      {
        headers: {
          "X-Token": monoBankToken,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Ответ Monobank:", monoResponse.data);

    const paymentData = {
      invoiceId: monoResponse.data.invoiceId,
      status: "pending",
    };

    unifieduser.conferences[conferenceIndex].paymentData = paymentData;

    await updateunifieduserById(unifieduser._id, {
      conferences: unifieduser.conferences,
    });

    res.status(200).json({
      invoiceId: monoResponse.data.invoiceId,
      pageUrl: monoResponse.data.pageUrl,
    });
  } catch (error) {
    console.error(
      "❌ Ошибка при создании оплаты:",
      error.response?.data || error.message
    );
    next(error);
  }
});

// ---------- Callback MonoBank ----------
app.post("/api/payment-callback", async (req, res, next) => {
  const { invoiceId, status } = req.body;
  if (!invoiceId || !status) {
    return res.status(400).json({ error: "Missing invoiceId or status" });
  }
  try {
    const statusMap = {
      success: "paid",
      pending: "pending",
      failure: "failed",
    };
    const monoStatus = status.toLowerCase();
    const newPaymentStatus = statusMap[monoStatus] || "failed";

    const updatedUser = await unifiedusersCollection.findOneAndUpdate(
      { "conferences.paymentData.invoiceId": invoiceId },
      { $set: { "conferences.$[conf].paymentData.status": newPaymentStatus } },
      { arrayFilters: [{ "conf.paymentData.invoiceId": invoiceId }], new: true }
    );

    if (!updatedUser) {
      console.error(`❌ Ошибка: Инвойс с ID ${invoiceId} не найден.`);
      return res.status(404).json({ error: "Invoice not found" });
    }

    console.log(
      `✅ Статус оплаты для пользователя ${updatedUser._id} обновлен до: ${newPaymentStatus}`
    );
    res.status(200).json({ message: "Payment status updated" });
  } catch (error) {
    console.error("❌ Ошибка в payment-callback:", error);
    next(error);
  }
});

// ---------- Статика и SPA ----------
const staticFilesPath = join(__dirname, "../");

app.use(
  express.static(staticFilesPath, {
    setHeaders: (res, path) => {
      if (/\.(webp|jpg|png|gif)$/.test(path)) {
        res.setHeader("Cache-Control", "public, max-age=36000");
      }
    },
  })
);

app.get("/*", (req, res) => {
  res.sendFile(join(staticFilesPath, "index.html"));
});

app.use(errorHandler);

app.listen(PORT, HOST, () => {
  console.log(`Сервер запущен по адресу: http://${HOST}:${PORT}`);
});
