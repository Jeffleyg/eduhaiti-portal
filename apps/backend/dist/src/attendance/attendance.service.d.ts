import { PrismaService } from "../prisma/prisma.service";
export declare class AttendanceService {
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
        status: string;
        date: Date;
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
        status: string;
        date: Date;
    })[]>;
    markAttendance(studentId: string, classId: string, date: Date, status: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        studentId: string;
        classId: string;
        status: string;
        date: Date;
    }>;
}
