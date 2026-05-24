import { FusioniPayload } from '../types';
import { getApiClient } from './ApiClient';

export interface ActionLiteral {
  text: string;
  prompt: string;
  language: string;
}

export interface Action {
  id?: string;
  title: string;
  agency_id: string;
  enabled?: boolean;
  literals?: ActionLiteral[];
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
    action.literals.find((l) => l.language === language)
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
  private getApiClient() {
    return getApiClient();
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
