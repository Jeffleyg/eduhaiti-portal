import { PrismaService } from "../prisma/prisma.service";
export declare class ClassesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findByTeacher(teacherId: string): Promise<({
        students: {
            id: string;
            email: string;
            name: string | null;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        level: string;
        teacherId: string;
    })[]>;
    findAll(): Promise<({
        teacher: {
            id: string;
            email: string;
            name: string | null;
        };
        students: {
            id: string;
            name: string | null;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        level: string;
        teacherId: string;
    })[]>;
    findById(classId: string): Promise<({
        students: {
            id: string;
            email: string;
            name: string | null;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        level: string;
        teacherId: string;
    }) | null>;
    findByStudent(studentId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        level: string;
        teacherId: string;
    }[]>;
}
