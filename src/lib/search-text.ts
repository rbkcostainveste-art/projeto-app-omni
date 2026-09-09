export function normalizeSearch(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g,"");}
export function matchesSearch(value:string,query:string){return query.trim().split(/\s+/).every(part=>normalizeSearch(value).includes(normalizeSearch(part)));}
