import { FusioniPayload, PipelineResponse } from '../types';
import { ApiClient, getApiClient } from './ApiClient';
import type {ConversationInputFieldData, ConversationProfile} from '../types/conversationProfile';

export interface ActionLiteral {
  text: string;
  description?: string;
  prompt: string;
  language: string;
}

export interface Action {
  id?: string;
  title: string;
  key?: string | null;
  icon?: string | null;
  icon_color?: string | null;
  agency_id: string;
  enabled?: boolean;
  literals?: ActionLiteral[];
  groups?: string[];
  conversation_profile_id?: string | null;
  conversation_profile_input_field_names?: string[] | null;
  maintain_conversation?: boolean;
  results_sort?: 'asc' | 'desc';
  show_results?: boolean;
}

export interface ExecuteAction {
  action_id: string;
  lang: string;
  conversation_id?: string;
  context?: ConversationInputFieldData;
  image?: string | string[];
}

export interface ActionSuggestion {
  id?: string;
  label: string;
  prompt: string;
}

export function resolveActionLiteral(
  action: Action,
  language: string
): ActionLiteral | undefined {
  if (!action.literals?.length) {
    return undefined;
  }
  return (
    action.literals.find((l) => l.language.toLowerCase().split(/[-_]/)[0] === language.toLowerCase().split(/[-_]/)[0])
    ?? action.literals.find((l) => l.language === 'en')
    ?? action.literals[0]
  );
}

export function toActionSuggestion(
  action: Action,
  language: string
): ActionSuggestion | null {
  if (action.enabled === false) {
    return null;
  }
  const literal = resolveActionLiteral(action, language);
  const label = (literal?.text || action.title || '').trim();
  const prompt = (literal?.prompt || literal?.text || action.title || '').trim();
  if (!label) {
    return null;
  }
  return {
    id: action.id,
    label,
    prompt: prompt || label,
  };
}

export class ActionService {
  constructor(private readonly apiClient?: ApiClient) {}

  private getApiClient() {
    return this.apiClient ?? getApiClient();
  }

  async findByActionGroupTags(agencyId: string, tags: readonly string[], signal?: AbortSignal): Promise<Action[]> {
    return (await this.getApiClient().get<Action[]>('/action/by_group_tags', {
      params: {agency_id: agencyId, tags: [...tags]},
      paramsSerializer: {indexes: null},
      signal,
    })) || [];
  }

  async getConversationProfiles(agencyId: string, signal?: AbortSignal): Promise<ConversationProfile[]> {
    return (await this.getApiClient().get<ConversationProfile[]>('/action/conversation-profiles', {
      params: {agency_id: agencyId}, signal,
    })) || [];
  }

  getConversationProfile(profileId: string, signal?: AbortSignal): Promise<ConversationProfile> {
    return this.getApiClient().get<ConversationProfile>('/conversation-profile', {
      params: {item_id: profileId}, signal,
    });
  }

  execute(agencyId: string, request: ExecuteAction, signal?: AbortSignal): Promise<PipelineResponse> {
    return this.getApiClient().post<PipelineResponse>('/action/exec', request, {
      params: {agency_id: agencyId}, signal,
    });
  }

  async findByConversationProfileId(agencyId: string, conversationProfileId: string, signal?: AbortSignal): Promise<Action[]> {
    if (!agencyId || !conversationProfileId?.trim()) return [];
    return (await this.getApiClient().get<Action[]>('/action/by_conversation_profile', {
      params: {agency_id: agencyId, conversation_profile_id: conversationProfileId},
      signal,
    })) || [];
  }

  async findEnabledByAgencyId(agencyId: string): Promise<Action[]> {
    const apiClient = this.getApiClient();
    return await apiClient.get<Action[]>('/action/enabled', {
      params: {
        agency_id: agencyId,
      },
    });
  }

  async findByAgencyId(
    agencyId: string,
    page: number = 0,
    size: number = 100
  ): Promise<Action[]> {
    const apiClient = this.getApiClient();
    const response = await apiClient.get<FusioniPayload<Action>>('/action/list', {
      params: {
        agency_id: agencyId,
        page,
        size,
      },
    });

    return response?.body ?? [];
  }
}

let actionServiceInstance: ActionService | null = null;

export const getActionService = (): ActionService => {
  if (!actionServiceInstance) {
    actionServiceInstance = new ActionService();
  }
  return actionServiceInstance;
};
