import { apiClient } from "./api";
export const getNotices = async () => (await apiClient.get("/notices")).data;
export const saveNotices = async (notices) => (await apiClient.put("/notices", notices)).data;
export const markNoticeReadApi = async (id, read) => (await apiClient.patch(`/notices/${id}`, { read })).data;
export const deleteNoticeApi = async (id) => { await apiClient.delete(`/notices/${id}`); };

function toMinutes(value) { const [h,m]=value.split(":").map(Number); return h*60+m; }
function formatTime(value) { const [h,m]=value.split(":").map(Number); return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`; }
export function generateNotices(timetable, planner, today = new Date()) {
  const day = new Intl.DateTimeFormat("en-US", { weekday:"short" }).format(today).slice(0,3);
  const now = today.getHours()*60+today.getMinutes();
  const classNotices = timetable.filter(e=>e.day===day).map(e=>({id:`auto-${e.id}`,title:(toMinutes(e.startTime)-now>0&&toMinutes(e.startTime)-now<=30)?`${e.subject} starts in ${toMinutes(e.startTime)-now} minutes`:`${e.subject} today at ${formatTime(e.startTime)}`,detail:`${e.type} session in ${e.room} with ${e.faculty}.`,type:e.type,dueDate:today.toISOString().slice(0,10),read:false,createdAt:today.toISOString()}));
  const taskNotices=(planner?.tasks||[]).filter(t=>!t.done).slice(0,3).map(t=>({id:`planner-${t.id}`,title:`${t.subject} study task due soon`,detail:t.label,type:"Study",dueDate:t.date,read:false,createdAt:today.toISOString()}));
  return [...classNotices,...taskNotices];
}
