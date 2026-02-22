import { MessagesService } from "./messages.service";
export declare class MessagesController {
    private readonly messagesService;
    constructor(messagesService: MessagesService);
    getInbox(req: {
        user?: {
            sub?: string;
        };
    }): Promise<({
        from: {
            id: string;
            email: string;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        subject: string;
        fromId: string;
        toId: string;
        body: string;
        isRead: boolean;
    })[]>;
    getSent(req: {
        user?: {
            sub?: string;
        };
    }): Promise<({
        to: {
            id: string;
            email: string;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        subject: string;
        fromId: string;
        toId: string;
        body: string;
        isRead: boolean;
    })[]>;
    sendMessage(body: any, req: {
        user?: {
            sub?: string;
        };
    }): Promise<{
        from: {
            name: string | null;
        };
        to: {
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        subject: string;
        fromId: string;
        toId: string;
        body: string;
        isRead: boolean;
    }>;
}
