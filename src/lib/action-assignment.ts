export function assignmentIds(value: string) {
  return [...new Set(value.split(',').map(id => id.trim().replace(/^mat\.\s*/i, '')).filter(Boolean))];
}

export function requiresActionAcknowledgement(author: string, user: string) {
  return author !== user;
}
