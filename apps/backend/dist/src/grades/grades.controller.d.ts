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
        academicYearId: string;
        score: number;
        maxScore?: number;
        weight?: number;
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
    updateGrade(gradeId: string, payload: {
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
    deleteGrade(gradeId: string): Promise<{
        message: string;
    }>;
    publishGrades(classId: string, disciplineId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    getMyGrades(req: {
        user?: {
            sub?: string;
        };
    }, academicYearId?: string): Promise<({
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
    getStudentReport(req: {
        user?: {
            sub?: string;
        };
    }, academicYearId: string): Promise<{
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
    getClassGrades(classId: string, disciplineId?: string): Promise<({
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
    getClassAverage(classId: string, disciplineId: string): Promise<{
        average: number;
        count: number;
    }>;
}
