import { PrismaService } from "../prisma/prisma.service";
import { GradeStatus, Role } from "@prisma/client";
export declare class GradesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(payload: {
        studentId: string;
        classId: string;
        disciplineId: string;
        academicYearId: string;
        score: number;
        maxScore?: number;
        weight?: number;
    }, requester?: {
        id: string;
        role: Role;
    }): Promise<{
        discipline: {
            id: string;
            name: string;
        };
        student: {
            id: string;
            email: string;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        academicYearId: string;
        classId: string;
        studentId: string;
        disciplineId: string;
        score: number;
        maxScore: number;
        weight: number;
        status: import(".prisma/client").$Enums.GradeStatus;
    }>;
    update(gradeId: string, payload: {
        score?: number;
        status?: GradeStatus;
    }): Promise<{
        discipline: {
            id: string;
            name: string;
        };
        student: {
            id: string;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        academicYearId: string;
        classId: string;
        studentId: string;
        disciplineId: string;
        score: number;
        maxScore: number;
        weight: number;
        status: import(".prisma/client").$Enums.GradeStatus;
    }>;
    delete(gradeId: string): Promise<{
        message: string;
    }>;
    publishGrades(classId: string, disciplineId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    findByStudent(studentId: string, academicYearId?: string): Promise<({
        discipline: {
            id: string;
            name: string;
        };
        class: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        academicYearId: string;
        classId: string;
        studentId: string;
        disciplineId: string;
        score: number;
        maxScore: number;
        weight: number;
        status: import(".prisma/client").$Enums.GradeStatus;
    })[]>;
    findByClass(classId: string, disciplineId?: string): Promise<({
        discipline: {
            id: string;
            name: string;
        };
        student: {
            id: string;
            email: string;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        academicYearId: string;
        classId: string;
        studentId: string;
        disciplineId: string;
        score: number;
        maxScore: number;
        weight: number;
        status: import(".prisma/client").$Enums.GradeStatus;
    })[]>;
    calculateClassAverage(classId: string, disciplineId: string): Promise<{
        average: number;
        count: number;
    }>;
    getStudentReport(studentId: string, academicYearId: string): Promise<{
        studentId: string;
        academicYearId: string;
        grades: ({
            discipline: {
                id: string;
                name: string;
            };
            class: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            academicYearId: string;
            classId: string;
            studentId: string;
            disciplineId: string;
            score: number;
            maxScore: number;
            weight: number;
            status: import(".prisma/client").$Enums.GradeStatus;
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
