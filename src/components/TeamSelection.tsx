// src/components/TeamSelection.tsx
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import { useTelegramUser } from "../hooks/useTelegramUser";

import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Users, UserPlus, Building2, ArrowRight, Loader2 } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

interface TeamMember {
  userId: string;
  name: string;
  role: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  adminName?: string;
  adminPhone?: string;
  code: string;
  createdAt: any;
  members?: TeamMember[];
}

interface TeamSelectionProps {
  onCreateTeam: () => void;
  onJoinTeam: () => void;
  onSelectTeam?: (team: Team) => void;
}

export function TeamSelection({ onCreateTeam, onJoinTeam, onSelectTeam }: TeamSelectionProps) {
  const user = useTelegramUser();
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserTeams() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const teamsRef = collection(db, "teams");
        const querySnapshot = await getDocs(teamsRef);

        const matchedTeams: Team[] = [];

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const members: TeamMember[] = data.members || [];

          // Проверяем наличие пользователя в массиве участников
          const isMember = members.some((m) => String(m.userId) === String(user.id));

          if (isMember) {
            matchedTeams.push({
              id: docSnap.id,
              name: data.name,
              description: data.description,
              adminName: data.adminName,
              adminPhone: data.adminPhone,
              code: data.code,
              createdAt: data.createdAt,
              members: data.members,
            });
          }
        });

        setUserTeams(matchedTeams);
      } catch (error) {
        console.error("Ошибка при поиске команд пользователя:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserTeams();
  }, [user]);

  const handleSelect = (team: Team) => {
    localStorage.setItem("currentTeam", JSON.stringify(team));
    if (onSelectTeam) {
      onSelectTeam(team);
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6 my-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Менеджер Задач</h1>
          <p className="text-muted-foreground text-sm">
            {user ? `Добро пожаловать, ${user.firstName}!` : "Выберите роль для работы с задачами"}
          </p>
        </div>

        {/* БЛОК 1: Доступные команды пользователя */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Ваши рабочие пространства
          </h2>

          {loading ? (
            <Card className="p-6 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Поиск ваших команд...
            </Card>
          ) : userTeams.length > 0 ? (
            <div className="space-y-2">
              {userTeams.map((team) => (
                <Card
                  key={team.id}
                  className="cursor-pointer hover:border-primary transition-all duration-200 border bg-card/50"
                  onClick={() => handleSelect(team)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm leading-none mb-1">{team.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {team.description || `Код: ${team.code}`}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-4 text-center text-muted-foreground text-xs bg-muted/30 border-dashed">
              Вы пока не состоите ни в одной команде. Создайте новую или присоединитесь по коду ниже.
            </Card>
          )}
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Или</span>
          </div>
        </div>

        {/* БЛОК 2: Создать или присоединиться */}
        <div className="space-y-4">
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={onCreateTeam}>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">Создать команду</CardTitle>
              <CardDescription className="text-xs">
                Создайте новую команду и управляйте задачами сотрудников
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button className="w-full" onClick={(e) => { e.stopPropagation(); onCreateTeam(); }}>
                Создать команду
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={onJoinTeam}>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">Присоединиться к команде</CardTitle>
              <CardDescription className="text-xs">
                Подключитесь к существующей команде по коду или заявке
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button variant="outline" className="w-full" onClick={(e) => { e.stopPropagation(); onJoinTeam(); }}>
                Присоединиться
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}