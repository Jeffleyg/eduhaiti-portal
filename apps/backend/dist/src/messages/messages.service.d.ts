import { PrismaService } from "../prisma/prisma.service";
export declare class MessagesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findReceivedBy(userId: string): Promise<({
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
    findSentBy(userId: string): Promise<({
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
    send(fromId: string, toId: string, subject: string, body: string): Promise<{
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
