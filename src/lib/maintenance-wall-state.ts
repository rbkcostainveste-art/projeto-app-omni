import type {WallPost} from "@/components/operational-wall";
import {technicalDeadline,technicalCardBorder} from "./technical-case";
export function timelineStatus(post: WallPost) {
  if(post.technicalCase&&!post.actions.length)return technicalDeadline(post.technicalCase)||(post.technicalCase.investigation==="closed"?"Caso encerrado":"Em acompanhamento");
  const last = post.actions.flatMap(action=>action.executions).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0]?.result;
  if(post.maintenanceResult === "nonconforming" || last === "nonconforming" || post.actions.some(a=>a.status === "nonconforming")) return "Não conforme";
  if(post.resolved) return "Concluído";
  if((!post.actions.length&&post.maintenanceResult === "satisfactory") || post.actions.length>0&&post.actions.every(a=>a.status === "satisfactory"||a.status === "resolved")) return "Satisfatório · aguardando encerramento";
  return "Em acompanhamento";
}
export function timelineTone(post: WallPost, user: string) {
  if(post.technicalCase&&!post.actions.length)return technicalCardBorder(post.technicalCase);
  const lastResult = post.actions.flatMap((action) => action.executions).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]?.result;
  if(post.maintenanceResult === "nonconforming" || lastResult === "nonconforming" || post.actions.some((action) => action.status === "nonconforming")) return "border-red-500";
  if((!post.actions.length&&post.maintenanceResult === "satisfactory") || post.resolved || post.actions.length > 0 && post.actions.every((action) => action.status === "satisfactory" || action.status === "resolved")) return "border-emerald-500";
  return post.views.some((item) => item.employeeNumber === user) ? "border-blue-500" : "border-amber-400";
}
