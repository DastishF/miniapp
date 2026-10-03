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
    const checkAndSetUser = () => {
      const tg = window.Telegram?.WebApp;

      // 1. Настоящий пользователь Telegram Mini App
      if (tg && tg.initDataUnsafe?.user) {
        const tgUser = tg.initDataUnsafe.user;
        
        try {
          tg.ready();
          tg.expand();
        } catch (e) {
          console.warn("Telegram WebApp SDK init error:", e);
        }

        // 🔥 ВАЖНО: Стираем забагованный кэш "Дастана", если он там лежал
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

    // Пробуем определить юзера сразу
    const isRealTg = checkAndSetUser();

    // Если Telegram SDK задерживается при старте — делаем повторную проверку через 300мс
    const timer = setTimeout(() => {
      if (!checkAndSetUser()) {
        // 2. Только если это ТОЧНО не Telegram (например, обычный сайт)
        let localUserStr = localStorage.getItem("mock_tg_user");
        let localUser = localUserStr ? JSON.parse(localUserStr) : null;

        // Если в кэше лежал старый клон "dev_user_dastan" или его нет — создаем УНИКАЛЬНЫЙ ID
        if (!localUser || localUser.id === "dev_user_dastan" || localUser.firstName === "Дастан") {
          const uniqueId = "web_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
          localUser = {
            id: uniqueId,
            firstName: "Сотрудник",
            lastName: "Web",
            username: "user_" + uniqueId.substring(4, 8),
          };
          localStorage.setItem("mock_tg_user", JSON.stringify(localUser));
        }

        setUser(localUser);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  return user;
}