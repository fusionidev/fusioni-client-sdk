import {ApiClient, getApiClient} from './ApiClient';
import {FusioniMemoryMessage, FusioniPayload} from "../types";

export class MessageService {
    constructor(private readonly apiClient?: ApiClient) {}

    private getApiClient() {
        return this.apiClient ?? getApiClient();
    }

    /**
     * Delete Message
     * @param messageId
     * @param agencyId
     */
    async deleteMessage(messageId: string, agencyId: string): Promise<void> {
        const apiClient = this.getApiClient();
        await (apiClient as any).client.delete('/mem', {
            params: {
                item_id: messageId,
                agency_id: agencyId
            }
        });
    }

    async likeMessage(messageId: string, agencyId: string, like: -1 | 0 | 1): Promise<boolean> {
        const apiClient = this.getApiClient();
        return apiClient.put<boolean>('/mem/like', {
            message_id: messageId,
            agency_id: agencyId,
            like,
        });
    }

    /**
     * Get Messages
     * @param conversationId
     * @param agencyId
     */
    async getMessages(conversationId: string, agencyId: string, signal?: AbortSignal): Promise<FusioniMemoryMessage[]> {
        const apiClient = this.getApiClient();
        const response = await apiClient.get<FusioniPayload<FusioniMemoryMessage>>(
            '/mem/messages',
            {
                params: {
                    agency_id: agencyId,
                    conversation_id: conversationId
                },
                signal,
            }
        );

        return response?.body || [];
    }
}

// Singleton instance
let messageServiceInstance: MessageService | null = null;

export const getMessageService = (): MessageService => {
    if (!messageServiceInstance) {
        messageServiceInstance = new MessageService();
    }
    return messageServiceInstance;
};
