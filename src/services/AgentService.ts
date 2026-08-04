import {getApiClient} from './ApiClient';

export class AgentService {
  async getAvatar(agencyId: string, agentId: string): Promise<string | null> {
    const avatar = await getApiClient().get<string | null>('/agent/avatar', {
      params: {
        agency_id: agencyId,
        agent_id: agentId,
      },
    });
    return avatar || null;
  }
}

let agentServiceInstance: AgentService | null = null;

export const getAgentService = (): AgentService => {
  if (!agentServiceInstance) {
    agentServiceInstance = new AgentService();
  }
  return agentServiceInstance;
};
