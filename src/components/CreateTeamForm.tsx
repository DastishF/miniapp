// src/components/CreateTeamForm.tsx
import { useState, useEffect } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import { useTelegramUser } from "../hooks/useTelegramUser"; // <-- Наш новый хук

import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

interface Team {
  id: string;
  name: string;
  description: string;
  adminName: string;
  adminPhone: string;
  code: string;
  createdAt: Date;
}

interface CreateTeamFormProps {
  onBack: () => void;
  onTeamCreated: (team: Team) => void;
}

export function CreateTeamForm({ onBack, onTeamCreated }: CreateTeamFormProps) {
  const user = useTelegramUser(); // <-- Подхватываем юзера из Telegram

  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 🔥 АВТОВСТАВКА: Как только хук получил данные, заполняем поле имени
  useEffect(() => {
    if (user) {
      const fullName = `${user.firstName} ${user.lastName || ""}`.trim();
      setAdminName(fullName);
    }
  }, [user]);

  const generateTeamCode = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Телефон сделали необязательным, проверяем только Название и ФИО
    if (!teamName.trim() || !adminName.trim()) {
      setError("Заполните обязательные поля (Название и ФИО)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const code = generateTeamCode();

      // Подготавливаем данные для Firebase
      const teamData = {
        name: teamName.trim(),
        description: description.trim(),
        adminName: adminName.trim(),
        adminPhone: adminPhone.trim(),
        code,
        createdAt: Date.now(),
        // 🔥 МУЛЬТИ-КОМАНДНОСТЬ: Сразу записываем создателя в массив участников
        members: user ? [{
          userId: user.id,
          name: adminName.trim(),
          role: "admin",
          joinedAt: Date.now()
        }] : []
      };

      // Пушим в базу данных
      const docRef = await addDoc(collection(db, "teams"), teamData);

      // Формируем объект для возврата в App.tsx
      const team: Team = {
        id: docRef.id,
        name: teamData.name,
        description: teamData.description,
        adminName: teamData.adminName,
        adminPhone: teamData.adminPhone,
        code: teamData.code,
        createdAt: new Date(),
      };

      // Переход в задачи
      onTeamCreated(team);
    } catch (e) {
      console.error(e);
      setError("Ошибка при создании команды");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <ThemeToggle />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Создание команды</CardTitle>
            <CardDescription>
              Команда будет создана, и вы сразу перейдёте к задачам
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Название команды *</Label>
                <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Например: Проект Альфа" />
              </div>

              <div className="space-y-2">
                <Label>Описание (необязательно)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Для чего эта команда?" />
              </div>

              <div className="space-y-2">
                <Label>Ваше ФИО *</Label>
                <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Иван Иванов" />
                {/* Подсказка для пользователя, что мы не украли имя, а взяли из TG */}
                {user && <p className="text-xs text-muted-foreground">Имя автоматически подтянуто из Telegram</p>}
              </div>

              <div className="space-y-2">
                <Label>Телефон (необязательно)</Label>
                <Input value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} placeholder="+7 777 000 00 00" />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Создание..." : "Создать команду"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}