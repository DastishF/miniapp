// src/components/TeamManagement.tsx
import { useState, useEffect } from "react";
import { doc, onSnapshot, updateDoc, collection, query, where } from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import { useTelegramUser } from "../hooks/useTelegramUser";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Shield, ShieldOff, UserMinus, Ban, Crown, Check, X, Copy, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface TeamManagementProps {
  team: any;
}

export function TeamManagement({ team }: TeamManagementProps) {
  const user = useTelegramUser();
  const [teamData, setTeamData] = useState<any>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // 🔥 Состояния для Аккордеона и Модалки Бана
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!team?.id || team.id === 'demo-team-id') return;
    const teamRef = doc(db, "teams", team.id);
    const unsubscribe = onSnapshot(teamRef, (snap) => {
      if (snap.exists()) setTeamData(snap.data());
    });
    return () => unsubscribe();
  }, [team]);

  useEffect(() => {
    if (!team?.code || team.id === 'demo-team-id') return;
    const q = query(collection(db, "joinRequests"), where("teamCode", "==", team.code), where("status", "==", "pending"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const reqs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPendingRequests(reqs);
    });
    return () => unsubscribe();
  }, [team?.code]);

  if (team?.id === 'demo-team-id') {
    return <div className="text-center p-6 text-muted-foreground">В демо-команде управление участниками отключено.</div>;
  }

  if (!teamData || !user) return <div className="text-center p-4 text-muted-foreground flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const members = teamData.members || [];
  const banned = teamData.banned || [];
  
  const myInfo = members.find((m: any) => String(m.userId) === String(user.id));
  const isMeAdmin = myInfo?.role === 'admin';

  const canManage = (target: any) => {
    if (!isMeAdmin) return false;
    if (String(myInfo.userId) === String(target.userId)) return false; 
    if (target.role === 'admin') return myInfo.joinedAt < target.joinedAt;
    return true;
  };

  const toggleExpand = (userId: string) => {
    setExpandedUserId(prev => prev === userId ? null : userId);
  };

  const updateMembersInDb = async (newMembers: any[], extraUpdates = {}) => {
    try {
      const teamRef = doc(db, "teams", team.id);
      await updateDoc(teamRef, { members: newMembers, ...extraUpdates });
    } catch (e: any) {
      alert("Ошибка базы данных: " + e.message);
      throw e;
    }
  };

  const handlePromote = (targetId: string) => updateMembersInDb(members.map((m: any) => m.userId === targetId ? { ...m, role: 'admin' } : m));
  const handleDemote = (targetId: string) => updateMembersInDb(members.map((m: any) => m.userId === targetId ? { ...m, role: 'member' } : m));
  const handleKick = (targetId: string) => updateMembersInDb(members.filter((m: any) => m.userId !== targetId));
  
  const handleBan = (targetId: string) => {
    const newMembers = members.filter((m: any) => m.userId !== targetId);
    updateMembersInDb(newMembers, { banned: [...banned, targetId] });
  };

  const handleApproveRequest = async (req: any) => {
    if (processingId) return;
    setProcessingId(req.id);
    try {
      const newMembers = [...members, {
        userId: req.userId || `temp_${Date.now()}`,
        name: req.employeeName,
        role: 'member',
        joinedAt: Date.now()
      }];
      await updateMembersInDb(newMembers);

      const reqRef = doc(db, "joinRequests", req.id);
      await updateDoc(reqRef, { status: 'approved' });
    } catch (e) {
      console.error("Сбой одобрения:", e);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectRequest = async (req: any) => {
    if (processingId) return;
    setProcessingId(req.id);
    try {
      const reqRef = doc(db, "joinRequests", req.id);
      await updateDoc(reqRef, { status: 'rejected' });
    } catch (e) {
      console.error("Сбой отклонения:", e);
    } finally {
      setProcessingId(null);
    }
  };

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(teamData.code);
    alert("Код скопирован!");
  };

  return (
    <div className="space-y-6">
      {/* 🔥 МОДАЛКА ПОДТВЕРЖДЕНИЯ БАНА */}
      {banTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div 
            style={{ maxWidth: '360px', width: '100%' }}
            className="bg-card rounded-2xl shadow-xl border overflow-hidden p-6 text-center animate-in fade-in zoom-in-95 duration-200 mx-auto"
          >
            <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <Ban className="h-6 w-6 text-red-600 dark:text-red-500" />
            </div>
            <h3 className="text-lg font-bold mb-2">Заблокировать участника?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Вы действительно хотите забанить <strong className="text-foreground">{banTarget.name}</strong>? Пользователь будет выгнан и не сможет подать повторную заявку.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" className="flex-1" onClick={() => setBanTarget(null)}>Отмена</Button>
              <Button 
                variant="destructive" 
                className="flex-1" 
                onClick={() => {
                  handleBan(banTarget.id);
                  setBanTarget(null);
                }}
              >
                Забанить
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Код: <span className="text-primary font-mono bg-primary/10 px-3 py-1 rounded text-xl">{teamData.code}</span>
            <Button variant="ghost" size="icon" onClick={copyCodeToClipboard} title="Скопировать код">
              <Copy className="h-5 w-5 text-muted-foreground hover:text-primary" />
            </Button>
          </CardTitle>
          <CardDescription>Отправьте этот код сотрудникам для присоединения.</CardDescription>
        </CardHeader>
      </Card>

      {isMeAdmin && pendingRequests.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-orange-600 dark:text-orange-400">
              Новые заявки ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-background border rounded-lg gap-3">
                <div>
                  <p className="font-medium text-sm">{req.employeeName}</p>
                  {req.employeePhone && <p className="text-xs text-muted-foreground">{req.employeePhone}</p>}
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button size="sm" disabled={processingId === req.id} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApproveRequest(req)}>
                    {processingId === req.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} 
                    Одобрить
                  </Button>
                  <Button size="sm" disabled={processingId === req.id} variant="destructive" className="flex-1 sm:flex-none" onClick={() => handleRejectRequest(req)}>
                    <X className="h-4 w-4 mr-1" /> Отклонить
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 🔥 УЧАСТНИКИ С АККОРДЕОНОМ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Участники команды ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((m: any) => {
            const hasPower = canManage(m);
            const isTargetAdmin = m.role === 'admin';
            const isExpanded = expandedUserId === m.userId;

            return (
              <div key={m.userId} className="p-3 border rounded-lg bg-card space-y-3 transition-all">
                <div 
                  className={`flex justify-between items-center ${hasPower ? 'cursor-pointer select-none' : ''}`}
                  onClick={() => hasPower && toggleExpand(m.userId)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{m.name}</p>
                      {String(m.userId) === String(user.id) && (
                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase font-bold">Вы</span>
                      )}
                    </div>
                    <p className="text-xs flex items-center gap-1 mt-1 text-muted-foreground">
                      {isTargetAdmin ? <Crown className="h-3 w-3 text-yellow-500" /> : <Shield className="h-3 w-3" />}
                      {isTargetAdmin ? "Администратор" : "Сотрудник"}
                    </p>
                  </div>

                  {/* Иконка раскрытия (только у тех, кем можно управлять) */}
                  {hasPower && (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  )}
                </div>

                {/* 🔥 РАСКРЫВАЮЩИЙСЯ СПИСОК АККОРДЕОНА */}
                {hasPower && isExpanded && (
                  <div className="pt-3 border-t space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    {!isTargetAdmin ? (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full justify-start text-xs h-9" 
                        onClick={(e) => { e.stopPropagation(); handlePromote(m.userId); }}
                      >
                        <Shield className="h-4 w-4 mr-2 text-primary" /> Дать права Админа
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full justify-start text-xs h-9 text-orange-500 hover:text-orange-600" 
                        onClick={(e) => { e.stopPropagation(); handleDemote(m.userId); }}
                      >
                        <ShieldOff className="h-4 w-4 mr-2" /> Забрать права
                      </Button>
                    )}

                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="w-full justify-start text-xs h-9 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" 
                      onClick={(e) => { e.stopPropagation(); handleKick(m.userId); }}
                    >
                      <UserMinus className="h-4 w-4 mr-2" /> Выгнать из команды
                    </Button>

                    <Button 
                      size="sm" 
                      variant="destructive" 
                      className="w-full justify-start text-xs h-9" 
                      onClick={(e) => { e.stopPropagation(); setBanTarget({ id: m.userId, name: m.name }); }}
                    >
                      <Ban className="h-4 w-4 mr-2" /> Забанить
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}