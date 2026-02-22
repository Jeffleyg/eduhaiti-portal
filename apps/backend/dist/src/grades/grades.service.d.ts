import { PrismaService } from "../prisma/prisma.service";
export declare class GradesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findByStudent(studentId: string): Promise<({
        class: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            level: string;
            teacherId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        studentId: string;
        classId: string;
        subject: string;
        score: number;
        maxScore: number;
        status: string;
    })[]>;
    findByClass(classId: string): Promise<({
        student: {
            id: string;
            email: string;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        studentId: string;
        classId: string;
        subject: string;
        score: number;
        maxScore: number;
        status: string;
    })[]>;
    create(studentId: string, classId: string, subject: string, score: number, maxScore?: number): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        studentId: string;
        classId: string;
        subject: string;
        score: number;
        maxScore: number;
        status: string;
    }>;
    update(gradeId: string, score: number, status: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        studentId: string;
        classId: string;
        subject: string;
        score: number;
        maxScore: number;
        status: string;
    }>;
}
