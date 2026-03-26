import {getApiClient} from './ApiClient';
import {FusioniMemoryMessage, FusioniPayload} from "../types";
import {AxiosResponse} from "axios";

export class MessageService {
    private getApiClient() {
        return getApiClient();
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

    /**
     * Get Messages
     * @param conversationId
     * @param agencyId
     */
    async getMessages(conversationId: string, agencyId: string): Promise<FusioniMemoryMessage[]> {
        const apiClient = this.getApiClient();
        const response: AxiosResponse<FusioniPayload<FusioniMemoryMessage>> = await (apiClient as any).client.get(
            '/mem/messages',
            {
                params: {
                    agency_id: agencyId,
                    conversation_id: conversationId
                }
            }
        );

        if (response.data) {
            return response.data.body || [];
        }

        return [];
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
