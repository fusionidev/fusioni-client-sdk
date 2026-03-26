import {Conversation, FusioniPayload} from '../types';
import {getApiClient} from './ApiClient';

export interface IConversationService {
    getConversation(conversationId: string): Promise<Conversation | undefined>;

    getConversationsByAgency(agencyId: string, page: number, size: number): Promise<Conversation[]>;

    getConversationsByIdsAndAgency(agencyId: string, ids: string[]): Promise<Conversation[]>;

    deleteConversation(conversationId: string): Promise<void>;

    createConversation(conversation: Omit<Conversation, 'id'>): Promise<string>;
}

export class LocalConversationService implements IConversationService {

    conversationService: RemoteConversationService;

    constructor(conversationService: RemoteConversationService) {
        this.conversationService = conversationService;
    }

    async createConversation(conversation: Omit<Conversation, "id">): Promise<string> {
        if (!conversation) {
            let reason = "No conversation was provided to create";
            console.error(reason)
            return Promise.reject(reason)
        }
        let conversationId = this.conversationService.createConversation(conversation);
        conversationId.then(value => this.saveToLocalStorage(value))
        return Promise.resolve(conversationId)
    }

    async deleteConversation(conversationId: string): Promise<void> {
        let conversations = this.loadConversations();
        conversations = conversations.filter(conv => conv !== conversationId)
        this.saveConversations(conversations);
        return Promise.resolve();
    }

    private saveToLocalStorage(conversationId: string): void {
        if (!conversationId) {
            console.warn("No conversation was provided")
            return;
        }
        let conversations: string[] = this.loadConversations();
        const existingIndex = conversations.indexOf(conversationId);
        if (existingIndex === -1) {
           conversations.push(conversationId);
        }
        this.saveConversations(conversations);
    }

    private saveConversations(conversations: string[]) {
        try {
            let conversationsStr = JSON.stringify(conversations)
            localStorage.setItem("conversations", conversationsStr)
        } catch (e) {
            console.log(e)
        }
    }

    private loadConversations() {
        let conversations: string[] = [];
        let conversationsStr = localStorage.getItem("conversations");
        console.log("conversationsStr", conversationsStr);
        if (conversationsStr) {
            try {
                conversations = JSON.parse(conversationsStr)
                console.log("conversations array", conversations);
            } catch (e) {
                console.error(e)
                conversations = [];
            }
        }
        return conversations;
    }

    async getConversation(conversationId: string): Promise<Conversation | undefined> {
        return this.conversationService.getConversation(conversationId);
    }

    async getConversationsByAgency(agencyId: string, page: number, size: number): Promise<Conversation[]> {
        let conversationIds = this.loadConversations();
        return this.conversationService.getConversationsByIdsAndAgency(agencyId, conversationIds);
    }

    async getConversationsByIdsAndAgency(agencyId: string, ids: string[]): Promise<Conversation[]> {
        return this.conversationService.getConversationsByIdsAndAgency(agencyId, ids);
    }

}

export class RemoteConversationService implements IConversationService {
    private getApiClient() {
        return getApiClient();
    }

    /**
     * Create a new conversation
     */
    async createConversation(conversation: Omit<Conversation, 'id'>): Promise<string> {
        try {
            const apiClient = this.getApiClient();
            console.log('Creating conversation with data:', conversation);

            // ApiClient.post returns the data directly, not the full response
            const responseData: any = await apiClient.post('/conversation', conversation);

            // Handle different response formats
            let conversationId: string = responseData.trim();

            if (!conversationId || conversationId === '') {
                return Promise.reject("No conversation id was received!")
            }

            return conversationId;
        } catch (error) {
            console.error(error)
            return Promise.reject(error)
        }
    }

    /**
     * Get a specific conversation by ID
     */
    async getConversation(conversationId: string): Promise<Conversation | undefined> {
        const apiClient = this.getApiClient();
        return await apiClient.get('/conversation', {
            params: {item_id: conversationId}
        });
    }

    /**
     * Get conversations for a specific agency with pagination
     */
    async getConversationsByAgency(
        agencyId: string,
        page: number = 0,
        size: number = 25
    ): Promise<Conversation[]> {
        const apiClient = this.getApiClient();
        const responseData: FusioniPayload<Conversation> = await apiClient.get(
            '/conversation/list',
            {
                params: {
                    agency_id: agencyId,
                    page,
                    size
                }
            }
        );

        if (responseData) {
            return responseData.body || [];
        }

        return [];
    }

    /**
     * Get conversations by IDs and agency ID
     */
    async getConversationsByIdsAndAgency(
        agencyId: string,
        ids: string[]
    ): Promise<Conversation[]> {
        const apiClient = this.getApiClient();
        const responseData: Conversation[] = await apiClient.get(
            '/conversation/by_ids_and_agency_id',
            {
                params: {
                    agency_id: agencyId,
                    ids: ids
                },
                paramsSerializer: { indexes: null },
            }
        );

        return responseData || [];
    }

    /**
     * Delete a conversation
     */
    async deleteConversation(conversationId: string): Promise<void> {
        const apiClient = this.getApiClient();
        await apiClient.delete('/conversation', {
            params: {item_id: conversationId}
        });
    }
}

// Singleton instance
let conversationServiceInstance: IConversationService | null = null;

export const getConversationService = (): IConversationService => {
    if (!conversationServiceInstance) {
        conversationServiceInstance = new LocalConversationService(new RemoteConversationService());
    }
    return conversationServiceInstance;
};
