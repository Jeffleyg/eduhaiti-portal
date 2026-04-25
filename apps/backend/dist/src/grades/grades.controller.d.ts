import { GradesService } from "./grades.service";
import { Role, GradeStatus } from "@prisma/client";
export declare class GradesController {
    private readonly gradesService;
    constructor(gradesService: GradesService);
    createGrade(req: {
        user?: {
            sub?: string;
            role?: Role;
        };
    }, payload: {
        studentId: string;
        classId: string;
        disciplineId: string;
        academicYearId?: string;
        score: number;
        maxScore?: number;
        weight?: number;
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
    updateGrade(gradeId: string, payload: {
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
    deleteGrade(gradeId: string): Promise<{
        message: string;
    }>;
    publishGrades(classId: string, disciplineId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    getMyGrades(req: {
        user?: {
            sub?: string;
        };
    }, academicYearId?: string): Promise<({
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
    getStudentReport(req: {
        user?: {
            sub?: string;
        };
    }, academicYearId: string): Promise<{
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
    getClassGrades(classId: string, disciplineId?: string): Promise<({
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
    getClassAverage(classId: string, disciplineId: string): Promise<{
        average: number;
        count: number;
    }>;
}
