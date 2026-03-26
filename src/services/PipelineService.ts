import { AxiosResponse } from 'axios';
import {
  PipelineRequest,
  PipelineResponse
} from '../types';
import { getApiClient } from './ApiClient';

export class PipelineService {
  private getApiClient() {
    return getApiClient();
  }

  /**
   * Execute a pipeline request.
   *
   * The API typically returns `messages` with the full turn batch for the exchange,
   * including the persisted **user** message that matches the request. Clients that
   * optimistically append a local user bubble should remove that row from state when
   * merging `response.messages` (ChatWidget tags it with `fusion_sdk_optimistic_user`
   * in `extra_data` and strips it—same pattern as removing the loading message).
   */
  async executePipeline(request: PipelineRequest): Promise<PipelineResponse> {
    // Debug logging to track conversation_id
    console.log('🔍 PipelineService.executePipeline - Request received:', {
      conversation_id: request.conversation_id,
      agency_id: request.agency_id,
      inp: request.inp?.substring(0, 100) + (request && request.inp && request.inp?.length > 100 ? '...' : ''),
      hasImage: !!request.image,
      hasAudio: !!request.audio,
      agent_id: request.agent_id,
      fullRequest: request
    });

    // Validate required fields
    if (!request.conversation_id) {
      console.error('❌ PipelineService.executePipeline - conversation_id is missing!', request);
      throw new Error('conversation_id is required for pipeline execution');
    }

    if (!request.agency_id) {
      console.error('❌ PipelineService.executePipeline - agency_id is missing!', request);
      throw new Error('agency_id is required for pipeline execution');
    }

    const apiClient = this.getApiClient();
    const response: AxiosResponse<PipelineResponse> = await (apiClient as any).client.post(
      `/pipeline/${request.agency_id}/exec`,
      request
    );
    
    console.log('✅ PipelineService.executePipeline - Response received:', {
      answerCount: response.data.answer?.length || 0,
      messagesCount: response.data.messages?.length || 0,
      thoughtsCount: response.data.thoughts?.length || 0
    });
    
    return response.data;
  }
}

// Singleton instance
let pipelineServiceInstance: PipelineService | null = null;

export const getPipelineService = (): PipelineService => {
  if (!pipelineServiceInstance) {
    pipelineServiceInstance = new PipelineService();
  }
  return pipelineServiceInstance;
};
