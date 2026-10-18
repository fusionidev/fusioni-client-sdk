/** Session storage is re-read before each run so separate instances share threads. */
export class ActionConversationStore {
  private mirror: Record<string, string> = {};
  private blocked = false;
  readonly key: string;

  constructor(agencyId: string, prefix?: string) {
    const route = typeof window !== 'undefined' ? window.location.pathname : '';
    this.key = `${prefix ?? `${route}-action-buttons.conversations.`}${agencyId}`;
  }

  read(): Record<string, string> {
    try {
      if (this.blocked || typeof sessionStorage === 'undefined') return this.mirror;
      const parsed: unknown = JSON.parse(sessionStorage.getItem(this.key) || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      this.mirror = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] =>
        typeof entry[1] === 'string' && !!entry[1]));
      return this.mirror;
    } catch { return this.mirror; }
  }

  set(actionId: string, conversationId?: string | null): Record<string, string> {
    const values = {...this.read()};
    if (conversationId) values[actionId] = conversationId;
    else delete values[actionId];
    this.mirror = values;
    try {
      if (!this.blocked && typeof sessionStorage !== 'undefined') {
        if (Object.keys(values).length) sessionStorage.setItem(this.key, JSON.stringify(values));
        else sessionStorage.removeItem(this.key);
      }
    } catch { this.blocked = true; }
    return values;
  }
}
