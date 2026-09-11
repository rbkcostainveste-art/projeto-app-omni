export const maintenanceCategories=['Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção','Power Check','Lavagem da CT Disk','Lavagem com produto','Procedimentos'] as const;
export function maintenanceCategory(category:string){return maintenanceCategories.find(value=>value===category.trim())||category.trim()||'Categoria não informada';}
export function maintenancePriorityRank(priority?:string){return ({critical:0,urgent:1,logged:1,priority:2} as Record<string,number>)[priority||'']??3;}

// A linked activity carries its report's technical axes, but keeps its own category.
export function wallPostHeading(post:{category:string;title:string;actions?:unknown[]},reportLabel?:string){
 if(!reportLabel||post.actions?.length)return {category:post.category,title:post.title};
 return {category:reportLabel,title:post.title.replace(/^(Pane|Discrepância)(?= · )/,reportLabel)};
}
