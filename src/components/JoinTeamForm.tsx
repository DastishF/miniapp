// src/components/JoinTeamForm.tsx
import { useState, useEffect } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ArrowLeft, Clock, CheckCircle, XCircle } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { findTeamByCode } from "../services/firebaseConfig";
import { useTelegramUser } from "../hooks/useTelegramUser"; // <-- Импортируем хук

interface JoinRequest {
  id: string;
  teamCode: string;
  employeeName: string;
  employeePhone: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  userId?: string; // <-- ДОБАВИЛИ ID ТЕЛЕГРАМА, чтобы админ знал кого одобрять
}

interface JoinTeamFormProps {
  onBack: () => void;
  onJoinSuccess: () => void;
}

export function JoinTeamForm({ onBack, onJoinSuccess }: JoinTeamFormProps) {
  const user = useTelegramUser(); // <-- Подхватываем юзера

  const [step, setStep] = useState<'form' | 'pending'>('form');
  const [teamCode, setTeamCode] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');
  const [request, setRequest] = useState<JoinRequest | null>(null);

  // 🔥 АВТОВСТАВКА: Заполняем имя из Telegram
  useEffect(() => {
    if (user) {
      const fullName = `${user.firstName} ${user.lastName || ""}`.trim();
      setEmployeeName(fullName);
    }
  }, [user]);

  const goToTasks = async (teamCodeValue: string) => {
    if (!teamCodeValue) {
      alert('Произошла ошибка. Не удалось определить команду.');
      setStep('form');
      return;
    }

    try {
      const team = await findTeamByCode(teamCodeValue);
      if (team) {
        localStorage.setItem('currentTeam', JSON.stringify(team));
        onJoinSuccess();
      } else {
        alert('Команда, в которую вас приняли, не найдена. Пожалуйста, попробуйте подать заявку еще раз.');
        setStep('form');
        setRequest(null);
      }
    } catch (error) {
      console.error("Ошибка при поиске команды:", error);
      alert("Произошла ошибка при загрузке данных команды.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Телефон теперь опционален (как договаривались), поэтому убрали жесткую проверку на него
    if (!teamCode.trim() || !employeeName.trim()) return;

    const upperCaseCode = teamCode.trim().toUpperCase();

    if (upperCaseCode === 'DEMO24') {
      const demoTeam = {
        id: 'demo-team-id',
        name: 'Демо Команда',
        code: 'DEMO24',
        createdAt: new Date()
      };
      localStorage.setItem('currentTeam', JSON.stringify(demoTeam));
      onJoinSuccess();
      return;
    }

    try {
      const team = await findTeamByCode(upperCaseCode);
      
      if (!team) {
        alert('Команда с таким кодом не найдена в базе данных. Проверьте правильность кода.');
        return;
      }

      // 🔥 НОВАЯ ПРОВЕРКА НА БАН
      if (team.banned && user && team.banned.includes(user.id)) {
        setError("Доступ запрещен: Вы были заблокированы администратором этой команды навсегда.");
        setLoading(false);
        return;
      }

      const newRequest = {
        teamCode: upperCaseCode,
        employeeName: employeeName.trim(),
        employeePhone: employeePhone.trim(),
        status: 'pending' as const,
        createdAt: Date.now(),
        userId: user ? user.id : undefined // <-- Прикрепляем Telegram ID к заявке
      };

      const docRef = await addDoc(collection(db, "joinRequests"), newRequest);

      setRequest({ ...newRequest, id: docRef.id });
      setStep('pending');
    } catch (err) {
      console.error("Ошибка Firebase:", err);
      alert("Не удалось связаться с сервером");
    }
  };

  const checkRequestStatus = async () => {
    if (!request || !request.id || request.id === 'temp') return;
    
    try {
      const requestRef = doc(db, "joinRequests", request.id);
      const docSnap = await getDoc(requestRef);
      
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as JoinRequest;
        
        if (data.status !== request.status) {
          setRequest(data);
          
          if (data.status === 'approved') {
            setTimeout(() => goToTasks(data.teamCode), 2000);
          }
        } else {
          alert("Статус пока не изменился. Ожидайте решения администратора.");
        }
      } else {
        alert("Не удалось найти вашу заявку. Возможно, она была удалена.");
        setStep('form');
        setRequest(null);
      }
    } catch (error) {
      console.error("Ошибка при проверке статуса:", error);
      alert("Произошла ошибка при проверке статуса.");
    }
  };

  if (step === 'pending' && request) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                {request.status === 'pending' && <Clock className="h-8 w-8 text-orange-500" />}
                {request.status === 'approved' && <CheckCircle className="h-8 w-8 text-green-500" />}
                {request.status === 'rejected' && <XCircle className="h-8 w-8 text-red-500" />}
              </div>
              
              <CardTitle>
                {request.status === 'pending' && 'Заявка отправлена'}
                {request.status === 'approved' && 'Заявка одобрена!'}
                {request.status === 'rejected' && 'Заявка отклонена'}
              </CardTitle>
              
              <CardDescription>
                {request.status === 'pending' && 'Ожидайте одобрения администратора команды'}
                {request.status === 'approved' && 'Добро пожаловать в команду!'}
                {request.status === 'rejected' && 'Администратор отклонил вашу заявку'}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="text-left space-y-2 p-4 bg-muted rounded-lg">
                <p><strong>Код команды:</strong> {request.teamCode}</p>
                <p><strong>Ваше ФИО:</strong> {request.employeeName}</p>
                {request.employeePhone && <p><strong>Телефон:</strong> {request.employeePhone}</p>}
                <p><strong>Статус:</strong> 
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                    request.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                    request.status === 'approved' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {request.status === 'pending' ? 'Ожидает' : 
                     request.status === 'approved' ? 'Одобрено' : 'Отклонено'}
                  </span>
                </p>
              </div>

              {request.status === 'pending' && (
                <Button onClick={checkRequestStatus} variant="outline" className="w-full">
                  Проверить статус
                </Button>
              )}

              {request.status === 'approved' && (
                <Button onClick={() => goToTasks(request.teamCode)} className="w-full">Перейти к задачам</Button>
              )}

              {request.status === 'rejected' && (
                <Button onClick={() => {
                  setStep('form');
                  setRequest(null);
                  setTeamCode('');
                  setEmployeeName('');
                  setEmployeePhone('');
                }} variant="outline" className="w-full">
                  Подать новую заявку
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
            <CardTitle>Присоединение к команде</CardTitle>
            <CardDescription>
              Введите код команды и ваши данные для подачи заявки
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamCode">Код команды *</Label>
                <Input
                  id="teamCode"
                  placeholder="Введите код команды"
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  style={{ textTransform: 'uppercase' }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeName">Ваше ФИО *</Label>
                <Input
                  id="employeeName"
                  placeholder="Иванов Иван Иванович"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  required
                />
                {user && <p className="text-xs text-muted-foreground">Имя автоматически подтянуто из Telegram</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeePhone">Номер телефона (необязательно)</Label>
                <Input
                  id="employeePhone"
                  type="tel"
                  placeholder="+7 (999) 123-45-67"
                  value={employeePhone}
                  onChange={(e) => setEmployeePhone(e.target.value)}
                />
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  После отправки заявки администратор команды получит ваши данные и сможет одобрить или отклонить запрос на присоединение.
                </p>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  💡 <strong>Для тестирования:</strong> Используйте код <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">DEMO24</code> для мгновенного доступа к демо-команде с примерами задач.
                </p>
              </div>

              <Button type="submit" className="w-full">
                Отправить заявку
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}