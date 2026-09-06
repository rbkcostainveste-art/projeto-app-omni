/** Realtime updates can omit unchanged large JSON columns. Never put those partial rows into UI state. */
export function isCompleteSharedState(value: unknown): boolean {
 if(!value || typeof value!=="object")return false;
 const row=value as Record<string,unknown>;
 if(!Array.isArray(row.flights)||!row.flights.every(item=>item!==null&&typeof item==="object"))return false;
 if(!row.catalogs||typeof row.catalogs!=="object")return false;
 const catalogs=row.catalogs as Record<string,unknown>;
 return ["bases","models"].every(key=>Array.isArray(catalogs[key])&&(catalogs[key] as unknown[]).every(item=>typeof item==="string"))
 && ["aircraft","users"].every(key=>Array.isArray(catalogs[key])&&(catalogs[key] as unknown[]).every(item=>item!==null&&typeof item==="object"));
}
export async function completeSharedState<T>(event:unknown,read:()=>Promise<T>):Promise<T>{
 if(isCompleteSharedState(event))return event as T;
 const fresh=await read();
 if(!isCompleteSharedState(fresh))throw new Error("Atualização incompleta. Os dados atuais foram mantidos; tentando sincronizar novamente.");
 return fresh;
}
