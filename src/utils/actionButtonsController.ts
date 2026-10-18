import {getTranslation} from '../i18n';
import {Action, ActionService} from '../services/ActionService';
import {MessageService} from '../services/MessageService';
import type {FusioniMemoryMessage, PipelineResponse} from '../types';
import type {ActionButtonsProps, ActionExecutionState, ActionResult} from '../types/actionButtons';
import type {ConversationInputField, ConversationInputFieldData, ConversationProfile} from '../types/conversationProfile';
import {
  ALL_ACTIONS_INPUT_FIELD_KEY, buildConversationInputFieldData, collectConversationInputFieldUploads,
  conversationFieldError, conversationFieldLabel, conversationInputFieldsForAction,
  createConversationInputFieldDrafts, isConversationInputFieldDraftInvalid,
} from './conversationInputFields';
import {ActionConversationStore} from './actionConversationStore';
import {buildActionMessages, buildActionResult, buildActionResults, mergeActionMessages, orderActionHistory} from './actionResults';

export interface ActionButtonsState {
  actions: Action[];
  profiles: Record<string, ConversationProfile>;
  selectedAction: Action | null;
  isLoading: boolean;
  loadError: string;
  executionError: string;
  executingActionId: string | null;
  results: Record<string, ActionResult[]>;
  messages: Record<string, FusioniMemoryMessage[]>;
  conversations: Record<string, string>;
  executionStates: Record<string, ActionExecutionState>;
  fieldFormVisible: boolean;
  fieldFormSubmitted: boolean;
  fieldValues: ConversationInputFieldData;
  promptAttachments: Record<string, string[]>;
  pendingUploads: Record<string, boolean>;
  formVersion: number;
  hasExecutedSelectedAction: boolean;
}

export const initialActionButtonsState = (): ActionButtonsState => ({
  actions: [], profiles: {}, selectedAction: null, isLoading: false, loadError: '', executionError: '', executingActionId: null,
  results: {}, messages: {}, conversations: {}, executionStates: {}, fieldFormVisible: false, fieldFormSubmitted: false,
  fieldValues: {}, promptAttachments: {}, pendingUploads: {}, formVersion: 0, hasExecutedSelectedAction: false,
});

export class ActionButtonsController {
  state = initialActionButtonsState();
  private loadController?: AbortController;
  private executionController?: AbortController;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly touched = new Set<string>();
  private readonly store: ActionConversationStore;

  constructor(private readonly getProps: () => ActionButtonsProps, private readonly notify: (state: ActionButtonsState) => void) {
    const props = getProps();
    this.store = new ActionConversationStore(props.agencyId || '', props.conversationStorageKey);
  }

  private patch(patch: Partial<ActionButtonsState>): void {
    this.state = {...this.state, ...patch};
    this.notify(this.state);
  }

  private get props(): ActionButtonsProps { return this.getProps(); }
  private get language() { return this.props.currentLanguage || 'en'; }
  private get service(): ActionService { return new ActionService(this.props.apiClient); }

  async loadActions(): Promise<void> {
    this.dispose();
    this.touched.clear();
    const props = this.props;
    const agencyId = props.agencyId;
    const tags = [...new Set((props.tags || []).map(tag => tag.trim()).filter(Boolean))];
    this.state = initialActionButtonsState();
    this.patch({isLoading: !!agencyId && !!tags.length, conversations: this.store.read()});
    if (!agencyId || !tags.length) return;
    const controller = new AbortController();
    this.loadController = controller;
    try {
      const [actions, profiles] = await Promise.all([
        this.service.findByActionGroupTags(agencyId, tags, controller.signal),
        this.service.getConversationProfiles(agencyId, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      this.patch({actions: actions.filter(action => action.enabled !== false && !!action.id),
        profiles: Object.fromEntries(profiles.filter(profile => profile.id).map(profile => [profile.id!, profile])), isLoading: false});
      void this.restoreHistory(agencyId, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) this.patch({isLoading: false, loadError: this.errorMessage(error, 'actions.loadFailed')});
    }
  }

  resolveAction(action?: Action | string): Action | null {
    return typeof action === 'string' ? this.state.actions.find(item => item.id === action || item.key === action) || null
      : action || this.state.selectedAction;
  }

  isDisabled(action: Action | null): boolean {
    return action?.enabled === false || (!!action?.key && this.props.actionEnabledStates?.[action.key] === false);
  }

  fields(action = this.state.selectedAction): ConversationInputField[] {
    return action?.conversation_profile_id ? conversationInputFieldsForAction(action, this.state.profiles[action.conversation_profile_id]) : [];
  }

  configuredValues(action = this.state.selectedAction): ConversationInputFieldData {
    return {...this.props.actionInputFieldValues?.[ALL_ACTIONS_INPUT_FIELD_KEY],
      ...(action?.key ? this.props.actionInputFieldValues?.[action.key] : {})};
  }

  promptedFields(action = this.state.selectedAction): ConversationInputField[] {
    const values = this.configuredValues(action);
    return this.fields(action).filter(field => !Object.prototype.hasOwnProperty.call(values, field.name) || values[field.name] === undefined);
  }

  async executeAction(input: Action | string): Promise<void> {
    const action = this.resolveAction(input);
    if (!this.props.agencyId || !action?.id || this.state.executingActionId || this.isDisabled(action)) return;
    this.patch({selectedAction: action, executionError: '', fieldFormVisible: false, fieldFormSubmitted: false,
      fieldValues: {}, promptAttachments: {}, pendingUploads: {}, hasExecutedSelectedAction: false});
    if (action.conversation_profile_id && !this.state.profiles[action.conversation_profile_id]) {
      const controller = new AbortController();
      this.executionController = controller;
      this.patch({executingActionId: action.id});
      try {
        const profile = await this.service.getConversationProfile(action.conversation_profile_id, controller.signal);
        if (controller.signal.aborted) return;
        if (!profile?.id) throw new Error('Conversation profile is unavailable.');
        this.patch({profiles: {...this.state.profiles, [profile.id]: profile}, executingActionId: null});
      } catch (error) {
        if (!controller.signal.aborted) this.patch({executingActionId: null, executionError: this.errorMessage(error, 'actions.profileFailed')});
        return;
      }
    }
    if (this.isDisabled(action) || !this.validateConfigured(action)) return;
    if (this.promptedFields(action).length) {
      this.patch({fieldFormVisible: true, fieldFormSubmitted: false, hasExecutedSelectedAction: false,
        fieldValues: createConversationInputFieldDrafts(this.promptedFields(action)), promptAttachments: {}, pendingUploads: {},
        formVersion: this.state.formVersion + 1});
      return;
    }
    await this.runAction(action);
  }

  setFieldValue(name: string, value: ConversationInputFieldData[string]): void {
    this.patch({fieldValues: {...this.state.fieldValues, [name]: value}});
  }

  setPromptAttachments(name: string, images: string[]): void { this.patch({promptAttachments: {...this.state.promptAttachments, [name]: images}}); }
  setUploadsPending(name: string, pending: boolean): void { this.patch({pendingUploads: {...this.state.pendingUploads, [name]: pending}}); }

  private validateConfigured(action: Action): boolean {
    const configured = this.configuredValues(action);
    const invalid = this.fields(action).find(field => Object.prototype.hasOwnProperty.call(configured, field.name)
      && configured[field.name] !== undefined && isConversationInputFieldDraftInvalid(field, configured[field.name]));
    if (!invalid) return true;
    this.patch({executionError: `${conversationFieldLabel(invalid, this.language)}: ${conversationFieldError(invalid, configured[invalid.name], this.language)}`,
      executionStates: {...this.state.executionStates, [action.id!]: 'error'}});
    return false;
  }

  private inputData(action: Action): {context: ConversationInputFieldData; uploads: string[]} {
    const configured = this.configuredValues(action);
    const fields = this.fields(action);
    const context = buildConversationInputFieldData(this.promptedFields(action), this.state.fieldValues);
    for (const field of fields) {
      if (field.type !== 'file' && field.type !== 'chat' && configured[field.name] !== undefined) context[field.name] = configured[field.name];
    }
    return {context, uploads: [...collectConversationInputFieldUploads(fields, configured),
      ...collectConversationInputFieldUploads(this.promptedFields(action), this.state.fieldValues), ...Object.values(this.state.promptAttachments).flat()]};
  }

  chatInputData(): {context: ConversationInputFieldData; uploads: string[]} | null {
    const action = this.state.selectedAction;
    if (!action || this.isDisabled(action) || !this.validateConfigured(action)) return null;
    this.patch({fieldFormSubmitted: true});
    if (Object.values(this.state.pendingUploads).some(Boolean)
      || this.promptedFields(action).some(field => isConversationInputFieldDraftInvalid(field, this.state.fieldValues[field.name]))) return null;
    return this.inputData(action);
  }

  async submitFields(): Promise<void> {
    const action = this.state.selectedAction;
    if (!action?.id || !this.state.fieldFormVisible || this.state.executingActionId || !this.chatInputData()) return;
    await this.runAction(action);
  }

  cancelFields(): void {
    this.patch({selectedAction: this.state.selectedAction?.maintain_conversation ? this.state.selectedAction : null,
      fieldFormVisible: false, fieldFormSubmitted: false, fieldValues: {}, promptAttachments: {}, pendingUploads: {}, executionError: ''});
  }

  startNewConversation(input?: Action | string): void {
    const action = this.resolveAction(input);
    if (!action?.id || this.state.executingActionId) return;
    this.touched.add(action.id);
    const results = {...this.state.results}, messages = {...this.state.messages};
    delete results[action.id]; delete messages[action.id];
    this.patch({results, messages, conversations: this.store.set(action.id), hasExecutedSelectedAction: false});
  }

  private async runAction(action: Action): Promise<void> {
    const agencyId = this.props.agencyId;
    if (!agencyId || !action.id || this.state.executingActionId || this.isDisabled(action)) return;
    const {context, uploads} = this.inputData(action);
    if (!action.maintain_conversation) this.startNewConversation(action);
    this.touched.add(action.id);
    const conversationId = action.maintain_conversation ? this.store.read()[action.id] : undefined;
    this.executionController?.abort();
    const controller = new AbortController();
    this.executionController = controller;
    this.clearTimer(action.id);
    this.patch({selectedAction: action, executionError: '', executingActionId: action.id, fieldFormVisible: false,
      fieldFormSubmitted: false, hasExecutedSelectedAction: true, executionStates: {...this.state.executionStates, [action.id]: 'loading'}});
    try {
      const response = await this.service.execute(agencyId, {action_id: action.id, lang: this.language,
        ...(conversationId ? {conversation_id: conversationId} : {}),
        ...(Object.keys(context).length ? {context} : {}), ...(uploads.length ? {image: uploads} : {})}, controller.signal);
      if (controller.signal.aborted) return;
      if (response.has_error) throw new Error(response.error_message || getTranslation(this.language, 'actions.executionFailed'));
      const incoming = buildActionResults(response, this.props.apiBaseUrl);
      let results = this.state.results, messages = this.state.messages;
      if (action.show_results) {
        const kept = results[action.id] || [];
        results = {...results, [action.id]: !action.maintain_conversation ? incoming
          : action.results_sort === 'asc' ? [...kept, ...incoming] : [...incoming, ...kept]};
        if (action.maintain_conversation) messages = {...messages, [action.id]: mergeActionMessages(messages[action.id] || [],
          buildActionMessages(response, agencyId), action.results_sort || 'desc')};
      }
      this.patch({results, messages, executingActionId: null,
        conversations: action.maintain_conversation ? this.store.set(action.id, response.conversation_id || conversationId) : this.state.conversations,
        executionStates: {...this.state.executionStates, [action.id]: 'success'}});
      this.timers.set(action.id, setTimeout(() => {
        this.timers.delete(action.id!);
        if (this.state.executionStates[action.id!] === 'success') this.patch({executionStates: {...this.state.executionStates, [action.id!]: 'idle'}});
      }, 5000));
      this.props.onResponse?.(action.show_results ? results[action.id] : incoming);
    } catch (error) {
      if (!controller.signal.aborted) this.patch({executingActionId: null, executionError: this.errorMessage(error, 'actions.executionFailed'),
        executionStates: {...this.state.executionStates, [action.id]: 'error'}});
    }
  }

  emitChatResponse(response: PipelineResponse): void { this.props.onResponse?.(buildActionResults(response, this.props.apiBaseUrl)); }

  private async restoreHistory(agencyId: string, signal: AbortSignal): Promise<void> {
    if (this.props.showActionResult === false) return;
    const actions = this.state.actions.filter(action => action.maintain_conversation && action.show_results && this.state.conversations[action.id!]);
    const histories = await Promise.all(actions.map(action => new MessageService(this.props.apiClient)
      .getMessages(this.state.conversations[action.id!], agencyId, signal).catch(() => [])));
    if (signal.aborted) return;
    const results = {...this.state.results}, messages = {...this.state.messages};
    let latest: {action: Action; time: number} | undefined;
    actions.forEach((action, index) => {
      const history = histories[index];
      if (this.touched.has(action.id!)) return;
      const answers = history.filter(message => message.role === 'assistant').map(message => buildActionResult(message.content || '', message.extra_data,
        message.execution_time_ms, message.extra_data?.output_variables, this.props.apiBaseUrl));
      if (!answers.length || results[action.id!]) return;
      results[action.id!] = action.results_sort === 'asc' ? answers : answers.reverse();
      messages[action.id!] = orderActionHistory(history, action.results_sort || 'desc').map(message => ({...message, shouldAnimate: false}));
      const time = Math.max(0, ...history.map(message => new Date(message.created).getTime() || 0));
      if (!latest || time > latest.time) latest = {action, time};
    });
    this.patch({results, messages, selectedAction: this.state.selectedAction || latest?.action || null});
  }

  private errorMessage(error: unknown, key: string): string {
    const failure = error instanceof Error ? error : new Error(String(error));
    this.props.onError?.(failure);
    const detail = (error as {response?: {data?: {detail?: unknown}}} | null)?.response?.data?.detail;
    return typeof detail === 'string' && detail.trim() ? detail : getTranslation(this.language, key);
  }

  private clearTimer(actionId: string): void {
    clearTimeout(this.timers.get(actionId));
    this.timers.delete(actionId);
  }

  dispose(): void {
    this.loadController?.abort(); this.executionController?.abort();
    this.timers.forEach(timer => clearTimeout(timer)); this.timers.clear();
  }
}
