import { GradesService } from "./grades.service";
export declare class GradesController {
    private readonly gradesService;
    constructor(gradesService: GradesService);
    getMyGrades(req: {
        user?: {
            sub?: string;
        };
    }): Promise<({
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
    getClassGrades(classId: string): Promise<({
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
    createGrade(body: any): Promise<{
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
