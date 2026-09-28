// src/App.tsx
import { createTask as fbCreateTask, updateTask as fbUpdateTask, deleteTask as fbDeleteTask, subscribeToTasks } from "./services/firebaseTasks";
import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from "./services/firebaseConfig";
import { useTelegramUser } from "./hooks/useTelegramUser";

import { TaskItem } from "./components/TaskItem";
import { AddTaskForm } from "./components/AddTaskForm";
import { TaskStats } from "./components/TaskStats";
import { TaskFilter } from "./components/TaskFilter";
import { TeamSelection } from "./components/TeamSelection";
import { CreateTeamForm } from "./components/CreateTeamForm";
import { JoinTeamForm } from "./components/JoinTeamForm";
import { TeamManagement } from "./components/TeamManagement";
import { ThemeToggle } from "./components/ThemeToggle";
import { NotificationBadge } from "./components/NotificationBadge";
import { Button } from "./components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Trash2, Settings, Building2, LogOut } from "lucide-react";

declare global {
  interface Window { google: any; Telegram?: { WebApp: { platform: string; openLink: (url: string) => void; }; }; }
}

interface Task {
  id: string; title: string; description?: string; completed: boolean; priority: "low" | "medium" | "high";
  createdAt: Date; archived?: boolean; assignedTo?: string | null; createdBy?: string | null; teamId?: string | null; dueDate?: string | null;
}
interface TeamMember { userId: string; name: string; role: "admin" | "member" | string; joinedAt: number; }
interface Team { id: string; name: string; description: string; adminName?: string; adminPhone?: string; code: string; createdAt: any; members?: TeamMember[]; }

type AppMode = "team-selection" | "create-team" | "join-team" | "task-manager";

const addToGoogleCalendar = async (title: string, description: string, dueDate: string, token: string) => {
  const event = { summary: title, description: description || 'Создано через Atrium Task', start: { date: dueDate }, end: { date: dueDate } };
  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(event),
    });
    if (response.status === 401) alert("Ошибка: Google отклонил токен (401). Переподключите календарь.");
  } catch (error: any) { console.error(`Ошибка сети к Google:`, error); }
};

export default function App() {
  const user = useTelegramUser(); 
  const [mode, setMode] = useState<AppMode>("team-selection");
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState<"tasks" | "archive" | "management">("tasks");
  const [googleToken, setGoogleToken] = useState<string | null>(() => localStorage.getItem("google_access_token"));
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      if (accessToken) {
        setGoogleToken(accessToken); localStorage.setItem("google_access_token", accessToken); window.location.hash = "";
      }
    }
  }, []);

  const handleConnectGoogle = () => {
    if (!window.google || !window.google.accounts) return;
    const isTelegramMobile = window.Telegram?.WebApp && (window.Telegram.WebApp.platform === 'android' || window.Telegram.WebApp.platform === 'ios');
    if (isTelegramMobile) {
      window.Telegram.WebApp.openLink(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${import.meta.env.VITE_GOOGLE_CLIENT_ID}&redirect_uri=https://miniapp-fawn-omega.vercel.app&response_type=token&scope=https://www.googleapis.com/auth/calendar.events`);
      return;
    }
    window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: (response: any) => { if (response.access_token) { setGoogleToken(response.access_token); localStorage.setItem("google_access_token", response.access_token); } },
    }).requestAccessToken();
  };

  useEffect(() => {
    if (!window.google || !window.google.accounts) {
      const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; document.head.appendChild(script);
    }
    const savedTeam = localStorage.getItem("currentTeam");
    if (savedTeam) { try { setCurrentTeam(JSON.parse(savedTeam)); setMode("task-manager"); return; } catch (e) {} }
    const savedTasks = localStorage.getItem("tasks");
    if (savedTasks) { try { setTasks(JSON.parse(savedTasks).map((t: any) => ({ ...t, createdAt: new Date(t.createdAt) }))); } catch (e) {} }
  }, []);

  useEffect(() => {
    if (!currentTeam || !user) return;
    if (currentTeam.id === 'demo-team-id') return;
    
    const unsubscribeTeam = onSnapshot(doc(db, "teams", currentTeam.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const members = data.members || [];
        const isStillMember = data.code === 'DEMO24' || members.some((m: any) => String(m.userId) === String(user.id));
        
        if (!isStillMember) {
          localStorage.removeItem("currentTeam"); setCurrentTeam(null); setMode("team-selection");
        } else {
          const updatedTeam = { id: snap.id, ...data } as Team;
          setCurrentTeam(updatedTeam); localStorage.setItem("currentTeam", JSON.stringify(updatedTeam));
        }
      } else {
        localStorage.removeItem("currentTeam"); setCurrentTeam(null); setMode("team-selection");
      }
    });
    return () => unsubscribeTeam();
  }, [currentTeam?.id, user]);

  useEffect(() => {
    if (!currentTeam) { setTasks([]); setArchivedTasks([]); return; }
    if (currentTeam.id === 'demo-team-id') return;

    const unsubscribe = subscribeToTasks(currentTeam.id, (firebaseTasks) => {
      setTasks(firebaseTasks.filter((t) => !t.archived).map((t) => ({ ...t, createdAt: new Date(t.createdAt) })));
      setArchivedTasks(firebaseTasks.filter((t) => t.archived).map((t) => ({ ...t, createdAt: new Date(t.createdAt) })));
    });
    return () => { try { unsubscribe(); } catch (e) {} };
  }, [currentTeam?.id]);

  const addTask = async (taskData: Omit<Task, "id" | "completed" | "createdAt"> & { dueDate?: string | null }) => {
    const savedToken = localStorage.getItem("google_access_token");
    try { await Promise.allSettled([
      taskData.dueDate && savedToken ? addToGoogleCalendar(taskData.title, taskData.description || '', taskData.dueDate.split('T')[0].trim(), savedToken) : Promise.resolve(),
      currentTeam && currentTeam.id !== 'demo-team-id' ? fbCreateTask({ ...taskData, completed: false, archived: false, teamId: currentTeam.id, createdAt: Date.now() }) : Promise.resolve()
    ]); } catch (e) {}
  };

  const toggleTaskComplete = async (id: string) => { if (currentTeam) try { await fbUpdateTask(id, { completed: !(tasks.find((x) => x.id === id) || archivedTasks.find((x) => x.id === id))?.completed }); } catch (e) {} };
  const archiveTask = async (id: string) => { if (currentTeam) try { await fbUpdateTask(id, { archived: true }); } catch (e) {} };
  const restoreTask = async (id: string) => { if (currentTeam) try { await fbUpdateTask(id, { archived: false }); } catch (e) {} };
  const deleteArchivedPermanently = async (id: string) => { if (currentTeam) try { await fbDeleteTask(id); } catch (e) {} };
  const clearCompleted = async () => { if (currentTeam) for (const t of tasks.filter((t) => t.completed)) try { await fbUpdateTask(t.id, { archived: true }); } catch (e) {} };
  const clearArchive = async () => { if (currentTeam) for (const t of archivedTasks) try { await fbDeleteTask(t.id); } catch (e) {} };
  const handleUpdateTask = async (updatedTask: Task) => { if (currentTeam) try { await fbUpdateTask(updatedTask.id, { title: updatedTask.title, description: updatedTask.description, priority: updatedTask.priority, dueDate: updatedTask.dueDate }); } catch (e) {} };

  const handleSelectTeam = (team: Team) => { setCurrentTeam(team); setMode("task-manager"); };
  const handleSwitchTeam = () => { setMode("team-selection"); };

  const handleLeaveTeamConfirm = async () => {
    if (!currentTeam || !user) return;
    
    if (currentTeam.id === 'demo-team-id' || currentTeam.code === 'DEMO24') {
      localStorage.removeItem("currentTeam"); setCurrentTeam(null); setShowLeaveModal(false); setMode("team-selection"); return;
    }

    try {
      const teamRef = doc(db, "teams", currentTeam.id);
      const teamSnap = await getDoc(teamRef);
      
      if (teamSnap.exists()) {
        const teamData = teamSnap.data();
        let members = teamData.members || [];
        
        const myInfo = members.find((m: any) => String(m.userId) === String(user.id));
        members = members.filter((m: any) => String(m.userId) !== String(user.id));

        if (myInfo && myInfo.role === 'admin') {
          const remainingAdmins = members.filter((m: any) => m.role === 'admin');
          if (remainingAdmins.length === 0 && members.length > 0) {
            members.sort((a: any, b: any) => a.joinedAt - b.joinedAt);
            members[0].role = 'admin';
          }
        }

        if (members.length === 0) {
          await deleteDoc(teamRef);
        } else {
          await updateDoc(teamRef, { members });
        }
        
        localStorage.removeItem("currentTeam");
        setCurrentTeam(null);
        setShowLeaveModal(false);
        setMode("team-selection");
      }
    } catch (e: any) {
      console.error("Ошибка при выходе из команды:", e);
      alert("Ошибка при выходе из команды: " + e.message);
    }
  };

  const filteredTasks = tasks.filter((task) => filter === "active" ? !task.completed : filter === "completed" ? task.completed : true);
  const taskCounts = { all: tasks.length, active: tasks.filter((t) => !t.completed).length, completed: tasks.filter((t) => t.completed).length };

  if (mode === "team-selection") return <TeamSelection onCreateTeam={() => setMode("create-team")} onJoinTeam={() => setMode("join-team")} onSelectTeam={handleSelectTeam} />;
  if (mode === "create-team") return <CreateTeamForm onBack={() => setMode("team-selection")} onTeamCreated={(team) => { setCurrentTeam(team); localStorage.setItem("currentTeam", JSON.stringify(team)); setMode("task-manager"); }} />;
  if (mode === "join-team") return <JoinTeamForm onBack={() => setMode("team-selection")} onJoinSuccess={() => { const saved = localStorage.getItem("currentTeam"); if (saved) { setCurrentTeam(JSON.parse(saved)); setMode("task-manager"); } }} />;

  return (
    <div className="min-h-screen bg-background relative">
      {/* 🔥 ИСПРАВЛЕННОЕ МОДАЛЬНОЕ ОКНО ВЫХОДА (Строгие 360px) */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div 
            style={{ maxWidth: '360px', width: '100%' }}
            className="bg-card rounded-2xl shadow-xl border overflow-hidden p-6 text-center animate-in fade-in zoom-in-95 duration-200 mx-auto"
          >
            <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <LogOut className="h-6 w-6 text-red-600 dark:text-red-500" />
            </div>
            <h3 className="text-lg font-bold mb-2">Выйти из команды?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Вы действительно хотите покинуть команду <strong className="text-foreground">{currentTeam?.name}</strong>?
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" className="flex-1" onClick={() => setShowLeaveModal(false)}>Отмена</Button>
              <Button variant="destructive" className="flex-1" onClick={handleLeaveTeamConfirm}>Да, выйти</Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-6">
        <div className="flex flex-col mb-6 gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Менеджер Задач</h1>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={() => setShowLeaveModal(true)} className="text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-950">
                <LogOut className="h-4 w-4 mr-1" /> Выйти
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSwitchTeam} className="flex-1 justify-start gap-2 border-primary/20 hover:bg-primary/5">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="truncate max-w-[120px]">{currentTeam ? currentTeam.name : "Без команды"}</span>
            </Button>
            <Button variant={googleToken ? "secondary" : "outline"} size="sm" onClick={handleConnectGoogle} className={googleToken ? "text-green-600 border-green-200" : ""}>
              {googleToken ? "📅 Подключен" : "📅 Календарь"}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="tasks">Задачи</TabsTrigger>
            <TabsTrigger value="management" className="relative">
              <Settings className="h-4 w-4 mr-1" /> Управление
              <NotificationBadge teamCode={currentTeam?.code} className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center" />
            </TabsTrigger>
            <TabsTrigger value="archive">Архив</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-6 space-y-6">
            <TaskStats tasks={tasks} />
            <TaskFilter currentFilter={filter} onFilterChange={setFilter} taskCounts={taskCounts} />
            {taskCounts.completed > 0 && <Button variant="outline" size="sm" onClick={clearCompleted} className="w-full"><Trash2 className="h-4 w-4 mr-2" /> Очистить выполненные</Button>}
            <div className="space-y-3 pb-24">
              {filteredTasks.map((task) => <TaskItem key={task.id} task={task} onToggleComplete={toggleTaskComplete} onDelete={archiveTask} onEdit={setEditingTask} />)}
            </div>
            <AddTaskForm onAddTask={addTask} editingTask={editingTask} onUpdateTask={handleUpdateTask} onCancelEdit={() => setEditingTask(null)} />
          </TabsContent>

          <TabsContent value="archive" className="mt-6 space-y-6">
            <h2 className="text-lg font-semibold">Архив задач</h2>
            {archivedTasks.length === 0 ? <p className="text-muted-foreground text-center py-6">Архив пуст</p> : (
              <div className="space-y-3">
                {archivedTasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-4 bg-muted flex justify-between items-center">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => restoreTask(task.id)}>Восстановить</Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteArchivedPermanently(task.id)}>Удалить</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {archivedTasks.length > 0 && <Button variant="destructive" className="w-full" onClick={clearArchive}>Очистить архив</Button>}
          </TabsContent>

          <TabsContent value="management" className="mt-6">
            {currentTeam && <TeamManagement team={currentTeam} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}