import { PrismaService } from "../prisma/prisma.service";
import { GradeStatus, Role } from "@prisma/client";
export declare class GradesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(payload: {
        studentId: string;
        classId: string;
        disciplineId: string;
        academicYearId?: string;
        score: number;
        maxScore?: number;
        weight?: number;
    }, requester?: {
        id: string;
        role: Role;
    }): Promise<{
        student: {
            id: string;
            name: string | null;
            email: string;
        };
        discipline: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        studentId: string;
        classId: string;
        disciplineId: string;
        academicYearId: string;
        score: number;
        maxScore: number;
        weight: number;
        status: import(".prisma/client").$Enums.GradeStatus;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(gradeId: string, payload: {
        score?: number;
        status?: GradeStatus;
    }): Promise<{
        student: {
            id: string;
            name: string | null;
        };
        discipline: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        studentId: string;
        classId: string;
        disciplineId: string;
        academicYearId: string;
        score: number;
        maxScore: number;
        weight: number;
        status: import(".prisma/client").$Enums.GradeStatus;
        createdAt: Date;
        updatedAt: Date;
    }>;
    delete(gradeId: string): Promise<{
        message: string;
    }>;
    publishGrades(classId: string, disciplineId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    findByStudent(studentId: string, academicYearId?: string): Promise<({
        class: {
            id: string;
            name: string;
        };
        discipline: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        studentId: string;
        classId: string;
        disciplineId: string;
        academicYearId: string;
        score: number;
        maxScore: number;
        weight: number;
        status: import(".prisma/client").$Enums.GradeStatus;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    findByClass(classId: string, disciplineId?: string): Promise<({
        student: {
            id: string;
            name: string | null;
            email: string;
        };
        discipline: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        studentId: string;
        classId: string;
        disciplineId: string;
        academicYearId: string;
        score: number;
        maxScore: number;
        weight: number;
        status: import(".prisma/client").$Enums.GradeStatus;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    calculateClassAverage(classId: string, disciplineId: string): Promise<{
        average: number;
        count: number;
    }>;
    getStudentReport(studentId: string, academicYearId: string): Promise<{
        studentId: string;
        academicYearId: string;
        grades: ({
            class: {
                id: string;
                name: string;
            };
            discipline: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            studentId: string;
            classId: string;
            disciplineId: string;
            academicYearId: string;
            score: number;
            maxScore: number;
            weight: number;
            status: import(".prisma/client").$Enums.GradeStatus;
            createdAt: Date;
            updatedAt: Date;
        })[];
        summary: {};
    }>;
    listAcademicYearsForStudent(studentId: string): Promise<{
        id: string;
        isActive: boolean;
        year: string;
        startDate: Date;
        endDate: Date;
    }[]>;
    getStudentEvolution(studentId: string, academicYearId?: string): Promise<{
        studentId: string;
        academicYearId: string | null;
        overallAverage: number;
        timeline: {
            period: string;
            average: number;
            samples: number;
        }[];
        byDiscipline: {
            disciplineId: string;
            disciplineName: string;
            average: number;
            samples: number;
        }[];
    }>;
}
