import express from "express";
import cors from "cors";
import axios from "axios";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Импорты для MongoDB и ваших сервисов
import env from "./utils/env.js";
import initMongoConnection from "./db/initMongoConnection.js";
import router from "./routers/index.js"; // Оставляем ваш роутер
import { errorHandler } from "./middlewares/errorHandler.js"; // Оставляем ваш errorHandler
import {
  upsertunifieduser,
  updateunifieduserById,
} from "./services/unifiedusers.js";
import { unifiedusersCollection } from "./db/models/unifiedusers.js";
import { utmTracker } from "./middlewares/utmMarks.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Подключаемся к базе данных
await initMongoConnection();

const app = express();

// Настройки CORS
const allowedOrigins = [
  "https://lyrical.women.place",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.1.2.122:3000",
];

const corsOptions = {
  origin: (origin, callback) => {
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

// Middlewares
app.use(utmTracker);
// Подключаем роутер для /api
app.use("/api", router);

// Константы для Monobank
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

  const purchase = conferences[0];

  try {
    if (typeof purchase.totalAmount !== "number" || purchase.totalAmount <= 0) {
      return res.status(400).json({ error: "Некорректная сумма для оплаты" });
    }

    const { unifieduser, conferenceIndex } = await upsertunifieduser({
      user,
      conferences,
    });

    const redirectUrl = monoBankRedirectUrl;
    const monoResponse = await axios.post(
      "[https://api.monobank.ua/api/merchant/invoice/create](https://api.monobank.ua/api/merchant/invoice/create)",
      {
        amount: purchase.totalAmount, // Используем сумму из запроса
        ccy: 980,
        redirectUrl,
        webHookUrl: monoBankWebhookUrl,
      },
      {
        headers: {
          "X-Token": monoBankToken,
          "Content-Type": "application/json",
        },
      }
    );

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
    console.error("Ошибка при создании оплаты:", error);
    next(error);
  }
});

app.post("/api/payment-callback", async (req, res, next) => {
  const { invoiceId, status } = req.body;

  if (!invoiceId || !status) {
    console.log("Missing invoiceId or status in callback.");
    return res.status(400).json({ error: "Missing invoiceId or status" });
  }

  try {
    const unifieduser = await unifiedusersCollection.findOne({
      "conferences.paymentData.invoiceId": invoiceId,
    });

    if (!unifieduser) {
      console.log("Invoice not found for invoiceId:", invoiceId);
      return res.status(404).json({ error: "Invoice not found" });
    }

    const statusMap = {
      success: "paid",
      pending: "pending",
      failure: "failed",
    };
    const monoStatus = status.toLowerCase();

    const conferenceToUpdate = unifieduser.conferences.find(
      (conf) => conf.paymentData?.invoiceId === invoiceId
    );

    if (conferenceToUpdate) {
      conferenceToUpdate.paymentData.status = statusMap[monoStatus] || "failed";
      await updateunifieduserById(unifieduser._id, {
        conferences: unifieduser.conferences,
      });
      console.log(
        `Unified user ${unifieduser._id} saved successfully AFTER payment callback.`
      );
    } else {
      console.warn(
        `⚠️ Конференция с invoiceId ${invoiceId} не найдена в unifieduser ${unifieduser._id}`
      );
    }

    res.status(200).json({ message: "Payment status updated" });
  } catch (error) {
    console.error("Error in payment-callback:", error);
    next(error);
  }
});

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

// Обработчик ошибок
app.use(errorHandler);

app.listen(PORT, HOST, async () => {
  console.log(`Сервер запущен по адресу: http://${HOST}:${PORT}`);
});
