// src/hooks/useTelegramUser.ts
import { useState, useEffect } from "react";

export interface TelegramUser {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
}

export function useTelegramUser() {
  const [user, setUser] = useState<TelegramUser | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    // 1. Настоящее окружение Telegram Mini App
    if (tg && tg.initDataUnsafe?.user) {
      const tgUser = tg.initDataUnsafe.user;
      
      // Инициализируем Telegram WebApp (раскрытие на весь экран и уведомление о готовности)
      try {
        tg.ready();
        tg.expand();
      } catch (e) {
        console.warn("Telegram WebApp SDK init error:", e);
      }

      setUser({
        id: tgUser.id.toString(),
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || "",
        username: tgUser.username || "",
      });
    } else {
      // 2. Режим локальной разработки на ПК (localhost)
      let localUser = localStorage.getItem("mock_tg_user");
      
      if (!localUser) {
        localUser = JSON.stringify({
          id: "dev_user_dastan",
          firstName: "Дастан",
          lastName: "(Local)",
          username: "dastan_dev",
        });
        localStorage.setItem("mock_tg_user", localUser);
      }
      
      setUser(JSON.parse(localUser));
    }
  }, []);

  return user;
}