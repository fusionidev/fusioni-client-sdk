import type {Action} from '../services/ActionService';
import {getTranslation, Language} from '../i18n';
import type {
  ConversationInputField, ConversationInputFieldData, ConversationInputFieldDraftValue,
  ConversationInputFieldType, ConversationInputFieldValidationRule, ConversationInputFieldValue, ConversationProfile,
} from '../types/conversationProfile';

export const ALL_ACTIONS_INPUT_FIELD_KEY = '*';
export const normalizeActionLanguage = (language: string): string => language.trim().toLowerCase().split(/[-_]/, 1)[0] || 'en';

export function conversationInputFieldsForAction(action: Action, profile?: ConversationProfile): ConversationInputField[] {
  const fields = profile?.input_fields || [];
  const names = action.conversation_profile_input_field_names;
  return names == null ? fields : fields.filter(field => field.required || names.includes(field.name));
}

export function isConversationInputFieldValueEmpty(value: ConversationInputFieldValue | undefined): boolean {
  return value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length);
}

export function coerceDefaultValue(type: ConversationInputFieldType, value: ConversationInputFieldValue): {valid: boolean; value: ConversationInputFieldValue} {
  if (value == null || value === '') return {valid: true, value: null};
  switch (type) {
    case 'number': {
      const text = String(value).trim();
      const number = Number(text);
      return {valid: !!text && Number.isFinite(number), value: number};
    }
    case 'boolean': {
      if (typeof value === 'boolean') return {valid: true, value};
      const text = String(value).trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'on'].includes(text)) return {valid: true, value: true};
      if (['false', '0', 'no', 'n', 'off'].includes(text)) return {valid: true, value: false};
      return {valid: false, value: null};
    }
    case 'json':
      if (typeof value === 'object') return {valid: true, value};
      try { return {valid: true, value: JSON.parse(String(value)) as ConversationInputFieldValue}; }
      catch { return {valid: false, value: null}; }
    case 'list': {
      if (Array.isArray(value)) return {valid: true, value};
      const text = String(value).trim();
      if (text.startsWith('[')) {
        try {
          const parsed: unknown = JSON.parse(text);
          return {valid: Array.isArray(parsed), value: Array.isArray(parsed) ? parsed : null};
        } catch { return {valid: false, value: null}; }
      }
      return {valid: true, value: text.split(',').map(entry => entry.trim()).filter(Boolean)};
    }
    case 'file': {
      const entries = Array.isArray(value) ? value : [value];
      if (entries.some(entry => typeof entry !== 'string')) return {valid: false, value: null};
      const files = (entries as string[]).map(entry => entry.trim()).filter(Boolean);
      return {valid: true, value: files.length ? files : null};
    }
    case 'chat': return {valid: true, value: null};
    case 'date': return {valid: !!String(value).trim(), value: String(value).trim() || null};
    default: return {valid: true, value: String(value)};
  }
}

function satisfiesRule(type: ConversationInputFieldType, value: ConversationInputFieldValue, rule: ConversationInputFieldValidationRule): boolean {
  const {operator, value: expected} = rule;
  if (type === 'boolean') return operator === 'equals' && typeof expected === 'boolean' && value === expected;
  if (type === 'json' || type === 'file' || type === 'chat') return false;
  if (operator === 'min_length' || operator === 'max_length') {
    const length = Array.isArray(value) ? value.length : typeof value === 'string' ? value.trim().length : null;
    return length != null && typeof expected === 'number' && Number.isInteger(expected) && expected >= 0
      && (operator === 'min_length' ? length >= expected : length <= expected);
  }
  if (operator === 'contains' || operator === 'not_contains') {
    if (typeof expected !== 'string' || !expected.trim()) return false;
    const contains = Array.isArray(value)
      ? value.some(entry => String(entry).trim() === expected.trim())
      : typeof value === 'string' && value.trim().includes(expected.trim());
    return operator === 'contains' ? contains : !contains;
  }
  if (Array.isArray(value)) return false;
  const actual = typeof value === 'string' ? value.trim() : value;
  const target = typeof expected === 'string' ? expected.trim() : expected;
  if (type === 'number' && (typeof actual !== 'number' || typeof target !== 'number' || !Number.isFinite(target))) return false;
  if (type !== 'number' && (typeof actual !== 'string' || typeof target !== 'string' || !target)) return false;
  if (actual == null || target == null || typeof actual === 'object' || typeof actual === 'boolean' || typeof target === 'boolean') return false;
  switch (operator) {
    case 'equals': return actual === target;
    case 'not_equals': return actual !== target;
    case 'greater_than': return (type === 'number' || type === 'date') && actual > target;
    case 'greater_than_or_equal': return (type === 'number' || type === 'date') && actual >= target;
    case 'less_than': return (type === 'number' || type === 'date') && actual < target;
    case 'less_than_or_equal': return (type === 'number' || type === 'date') && actual <= target;
    default: return false;
  }
}

export function findFailedConversationInputFieldValidationRule(field: ConversationInputField, value: ConversationInputFieldValue): ConversationInputFieldValidationRule | null {
  return field.validation_rules?.find(rule => !satisfiesRule(field.type, value, rule)) || null;
}

export function isConversationInputFieldDraftInvalid(field: ConversationInputField, value: ConversationInputFieldValue | undefined): boolean {
  if (field.type === 'chat') return false;
  if (isConversationInputFieldValueEmpty(value)) return field.required;
  const result = coerceDefaultValue(field.type, value ?? null);
  return !result.valid || (result.value !== null && !!findFailedConversationInputFieldValidationRule(field, result.value));
}

export function createConversationInputFieldDrafts(fields: readonly ConversationInputField[]): Record<string, ConversationInputFieldDraftValue> {
  return Object.fromEntries(fields.map(field => {
    const value = field.default_value;
    if (value == null) return [field.name, field.type === 'boolean' ? false : field.type === 'file' ? [] : null];
    return [field.name, typeof value === 'object' || field.type === 'json' || field.type === 'list'
      ? (typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)) : value];
  }));
}

export function buildConversationInputFieldData(fields: readonly ConversationInputField[], values: Readonly<ConversationInputFieldData>): ConversationInputFieldData {
  const context: ConversationInputFieldData = {};
  for (const field of fields) {
    const raw = values[field.name];
    if (field.type === 'file' || field.type === 'chat' || isConversationInputFieldValueEmpty(raw)) continue;
    const result = coerceDefaultValue(field.type, raw);
    if (result.valid && result.value != null) {
      context[field.name] = (field.type === 'text' || field.type === 'prompt') && typeof result.value === 'string'
        ? result.value.trim() : result.value;
    }
  }
  return context;
}

export function collectConversationInputFieldUploads(fields: readonly ConversationInputField[], values: Readonly<ConversationInputFieldData>): string[] {
  return fields.flatMap(field => {
    if (field.type !== 'file') return [];
    const result = coerceDefaultValue('file', values[field.name] ?? null);
    return result.valid && Array.isArray(result.value) ? result.value.map(String) : [];
  });
}

export function conversationFieldLabel(field: ConversationInputField, language: string): string {
  return (field.labels?.find(label => normalizeActionLanguage(label.language) === normalizeActionLanguage(language))?.text
    || field.labels?.[0]?.text || field.name).trim();
}

export function conversationFieldPlaceholder(field: ConversationInputField, language: string): string {
  return field.labels?.find(label => normalizeActionLanguage(label.language) === normalizeActionLanguage(language))?.placeholder?.trim()
    || field.labels?.find(label => label.placeholder?.trim())?.placeholder?.trim() || '';
}

export function conversationFieldError(field: ConversationInputField, value: ConversationInputFieldValue | undefined, language: Language): string {
  if (isConversationInputFieldValueEmpty(value)) return getTranslation(language, 'actions.fieldRequired');
  const result = coerceDefaultValue(field.type, value ?? null);
  if (!result.valid || result.value == null) return getTranslation(language, 'actions.fieldInvalid');
  const rule = findFailedConversationInputFieldValidationRule(field, result.value);
  if (!rule) return getTranslation(language, 'actions.fieldInvalid');
  const expected = typeof rule.value === 'boolean' ? getTranslation(language, rule.value ? 'common.yes' : 'common.no') : String(rule.value);
  return getTranslation(language, `actions.validation.${rule.operator}`).replace('{value}', expected);
}
