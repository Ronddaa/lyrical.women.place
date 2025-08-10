import { useState, useEffect } from "react";
import styles from "./Form.module.css";
import api from "../../api/api.js"; // путь подкорректируй под свой проект
import lyricalIMG from './liricalIMG.webp'

export default function Form() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    telegramNick: "",
  });

  const [utmParams, setUtmParams] = useState({});
  const ticketPrice = 1500; // фиксированная сумма

  // Читаем UTM-метки из URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUtmParams({
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
    });
  }, []);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const isFormValid = () => {
    return (
      formData.firstName.trim() &&
      formData.lastName.trim() &&
      formData.email.trim() &&
      formData.phone.trim()
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid()) {
      alert("Будь ласка, заповніть усі обов'язкові поля.");
      return;
    }

    const cleanTelegramNick = formData.telegramNick.startsWith("@")
      ? formData.telegramNick.substring(1)
      : formData.telegramNick;

    try {
      const response = await api.createPayment({
        user: {
          fullName: {
            firstName: formData.firstName,
            lastName: formData.lastName,
          },
          phoneNumber: formData.phone,
          email: formData.email.toLowerCase(),
          telegram: {
            id: "",
            userName: cleanTelegramNick || "",
            firstName: "",
            languageCode: "",
            phone: "",
            isPremium: false,
            source: [],
            transitions: [],
          },
        },
        conferences: [
          {
            conference: "Bedtime poetry",
            type: "offline",
            ticketType: "standard", // фиксируем тариф
            ticketsQuantity: 1, // всегда один билет
            totalAmount: ticketPrice,
            takeBrunch: false,
            paymentData: {
              invoiceId: "",
              status: "pending",
            },
            promoCode: "",
            utmMarks: [
              {
                source: utmParams.utm_source,
                medium: utmParams.utm_medium,
                campaign: utmParams.utm_campaign,
              },
            ],
          },
        ],
      });

      if (response.pageUrl) {
        window.location.href = response.pageUrl;
      } else {
        console.error("Не вдалося отримати посилання на оплату.");
        alert("Виникла помилка. Будь ласка, спробуйте ще раз.");
      }
    } catch (error) {
      console.error("Помилка при створенні платежу:", error);
      alert(
        "Виникла помилка при створенні платежу. Будь ласка, спробуйте ще раз."
      );
    }
  };

  return (
    <section className={styles.FormSection}>
      <ul className={styles.wrapperForm}>
        <li>
          <form className={styles.Form} onSubmit={handleSubmit}>
            <h1 className={styles.title}>
              форма реєстрації на івент “У ліжку <br />з поезією”
            </h1>
            <p className={styles.textName}>by Olimpia Matushevska</p>
            <input
              id="firstName"
              type="text"
              className={styles.inputForm}
              placeholder="Ім’я*"
              value={formData.firstName}
              onChange={handleChange}
              required
            />
            <input
              id="lastName"
              type="text"
              className={styles.inputForm}
              placeholder="Прізвище*"
              value={formData.lastName}
              onChange={handleChange}
              required
            />
            <input
              id="email"
              type="email"
              className={styles.inputForm}
              placeholder="Email*"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <input
              id="phone"
              type="tel"
              className={styles.inputForm}
              placeholder="Телефон*"
              value={formData.phone}
              onChange={handleChange}
              required
            />
            <input
              id="telegramNick"
              type="text"
              className={styles.inputForm}
              placeholder="Telegram"
              value={formData.telegramNick}
              onChange={handleChange}
            />

            <button
              className={
                isFormValid()
                  ? styles.sendBtnForm
                  : `${styles.sendBtnForm} ${styles.sendBtnFormNoValid}`
              }
              type="submit"
              disabled={!isFormValid()}
            >
              Зареєструватися
            </button>
          </form>
        </li>
        <li className={styles.wrapperIMG}>
          <img src={lyricalIMG} alt="Anastasiia" width={685} height={856} />
        </li>
      </ul>
    </section>
  );
}
