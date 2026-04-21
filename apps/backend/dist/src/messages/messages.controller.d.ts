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
    getRecipients(req: {
        user?: {
            sub?: string;
            role?: string;
        };
    }): Promise<{
        id: string;
        email: string;
        name: string | null;
        role: import(".prisma/client").$Enums.Role;
    }[]>;
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
