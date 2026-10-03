// src/hooks/useTelegramUser.ts
import { useState, useEffect } from "react";

export interface TelegramUser {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
}

export function useTelegramUser(): TelegramUser | null {
  const [user, setUser] = useState<TelegramUser | null>(null);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 20; // 20 попыток * 120мс = ~2.4 секунды ожидания SDK Telegram

    const checkTgUser = (): boolean => {
      const tg = window.Telegram?.WebApp;

      if (tg) {
        try {
          tg.ready();
          tg.expand();
        } catch (e) {
          console.warn("Telegram WebApp init warning:", e);
        }
      }

      // Если данные от Telegram WebApp SDK зафиксированы
      if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        const tgUser = tg.initDataUnsafe.user;

        // 🔥 КРИТИЧНО: Принудительно удаляем фейковый кэш веб-версии
        localStorage.removeItem("mock_tg_user");

        const realUser: TelegramUser = {
          id: tgUser.id.toString(),
          firstName: tgUser.first_name || "Пользователь",
          lastName: tgUser.last_name || "",
          username: tgUser.username || "",
        };

        setUser(realUser);
        return true;
      }

      return false;
    };

    // 1. Пробуем определить сразу
    if (checkTgUser()) {
      return;
    }

    // 2. Опрашиваем SDK с интервалом в 120мс для медленных устройств
    const interval = setInterval(() => {
      attempts++;
      const success = checkTgUser();

      if (success || attempts >= maxAttempts) {
        clearInterval(interval);

        // 3. Только если это ТОЧНО внешний веб-сайт (прошло 2.4с и SDK не ответил)
        if (!success) {
          let localUserStr = localStorage.getItem("mock_tg_user");
          let localUser = localUserStr ? JSON.parse(localUserStr) : null;

          if (!localUser || localUser.id === "dev_user_dastan" || localUser.firstName === "Сотрудник") {
            const uniqueId = "web_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
            localUser = {
              id: uniqueId,
              firstName: "Гость Web",
              lastName: "",
              username: "user_" + uniqueId.substring(4, 8),
            };
            localStorage.setItem("mock_tg_user", JSON.stringify(localUser));
          }

          setUser(localUser);
        }
      }
    }, 120);

    return () => clearInterval(interval);
  }, []);

  return user;
}