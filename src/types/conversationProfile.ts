export type ConversationInputFieldType = 'text' | 'prompt' | 'chat' | 'number' | 'boolean' | 'date' | 'json' | 'list' | 'file';
export type ConversationInputFieldValue = string | number | boolean | unknown[] | Record<string, unknown> | null;
export type ConversationInputFieldDraftValue = string | number | boolean | string[] | null;
export type ConversationInputFieldData = Record<string, ConversationInputFieldValue>;
export type ConversationInputFieldValidationOperator =
  | 'equals' | 'not_equals' | 'greater_than' | 'greater_than_or_equal'
  | 'less_than' | 'less_than_or_equal' | 'contains' | 'not_contains' | 'min_length' | 'max_length';

export interface ConversationInputFieldValidationRule {
  operator: ConversationInputFieldValidationOperator;
  value: string | number | boolean | null;
}

export interface ConversationInputFieldLabel {
  text: string;
  placeholder?: string | null;
  language: string;
}

export interface ConversationInputField {
  name: string;
  type: ConversationInputFieldType;
  description?: string | null;
  required: boolean;
  default_value?: ConversationInputFieldValue;
  labels?: ConversationInputFieldLabel[];
  validation_rules?: ConversationInputFieldValidationRule[];
}

export interface ConversationProfile {
  id?: string | null;
  agency_id?: string | null;
  name: string;
  tags?: string[];
  support_type?: 'journey' | 'agentic';
  agent_ids?: string[];
  input_fields: ConversationInputField[];
  enabled?: boolean;
  conversationExpiration?: number | null;
  [field: string]: unknown;
}
