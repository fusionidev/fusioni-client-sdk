import {
  PipelineRequest,
  PipelineResponse
} from '../types';
import { ApiClient, getApiClient } from './ApiClient';

export class PipelineService {
  constructor(private readonly apiClient?: ApiClient) {}

  private getApiClient() {
    return this.apiClient ?? getApiClient();
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
  async executePipeline(request: PipelineRequest, signal?: AbortSignal): Promise<PipelineResponse> {
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
    const response = await apiClient.post<PipelineResponse>(
      `/journey/${request.agency_id}/exec`,
      request,
      {signal}
    );
    
    console.log('✅ PipelineService.executePipeline - Response received:', {
      answerCount: response.answer?.length || 0,
      messagesCount: response.messages?.length || 0,
      thoughtsCount: response.thoughts?.length || 0
    });
    
    return response;
  }

  /**
   * Queue a pipeline execution and return its acknowledgement.
   *
   * The completed response is emitted separately as a `message_stream` SSE event.
   */
  async executePipelineAsync(request: PipelineRequest, signal?: AbortSignal): Promise<PipelineResponse> {
    if (!request.conversation_id) {
      throw new Error('conversation_id is required for pipeline execution');
    }

    if (!request.agency_id) {
      throw new Error('agency_id is required for pipeline execution');
    }

    return this.getApiClient().post<PipelineResponse>('/journey/exec_async', request, {signal});
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
