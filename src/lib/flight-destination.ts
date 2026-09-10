/** A schedule cell is never a client/platform. Do not guess whether it is arrival or duration. */
export function isScheduleValue(value:string|null|undefined){
 const text=(value||'').trim().toLowerCase();
 const clock='(?:[01]?\\d|2[0-3])(?::[0-5]\\d(?::[0-5]\\d)?|h(?:[0-5]\\d)?)(?:\\s*(?:am|pm))?';
 const date='(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?)';
 return new RegExp(`^(?:${date}[ t])?${clock}(?:\\s*(?:-|a|às|ate|até)\\s*${clock})?$`).test(text)||new RegExp(`^${date}$`).test(text);
}
