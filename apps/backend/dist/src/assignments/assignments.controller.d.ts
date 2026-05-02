import { AssignmentsService } from './assignments.service';
export declare class AssignmentsController {
    private readonly assignmentsService;
    constructor(assignmentsService: AssignmentsService);
    getByClass(classId: string): Promise<({
        createdBy: {
            id: string;
            email: string;
            name: string | null;
        };
        submissions: ({
            student: {
                id: string;
                email: string;
                name: string | null;
            };
        } & {
            grade: number | null;
            id: string;
            updatedAt: Date;
            studentId: string;
            status: import(".prisma/client").$Enums.AssignmentStatus;
            filePath: string;
            assignmentId: string;
            submittedAt: Date;
            feedback: string | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        classId: string;
        description: string | null;
        maxScore: number;
        status: import(".prisma/client").$Enums.AssignmentStatus;
        title: string;
        filePath: string | null;
        dueDate: Date;
        createdById: string;
    })[]>;
    getMyAssignments(req: any): Promise<({
        createdBy: {
            id: string;
            email: string;
            name: string | null;
        };
        submissions: ({
            student: {
                id: string;
                email: string;
                name: string | null;
            };
        } & {
            grade: number | null;
            id: string;
            updatedAt: Date;
            studentId: string;
            status: import(".prisma/client").$Enums.AssignmentStatus;
            filePath: string;
            assignmentId: string;
            submittedAt: Date;
            feedback: string | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        classId: string;
        description: string | null;
        maxScore: number;
        status: import(".prisma/client").$Enums.AssignmentStatus;
        title: string;
        filePath: string | null;
        dueDate: Date;
        createdById: string;
    })[]>;
    createAssignment(classId: string, file: any, body: {
        title: string;
        description?: string;
        dueDate: string;
    }, req: any): Promise<{
        createdBy: {
            id: string;
            email: string;
            name: string | null;
        };
        submissions: ({
            student: {
                id: string;
                email: string;
                name: string | null;
            };
        } & {
            grade: number | null;
            id: string;
            updatedAt: Date;
            studentId: string;
            status: import(".prisma/client").$Enums.AssignmentStatus;
            filePath: string;
            assignmentId: string;
            submittedAt: Date;
            feedback: string | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        classId: string;
        description: string | null;
        maxScore: number;
        status: import(".prisma/client").$Enums.AssignmentStatus;
        title: string;
        filePath: string | null;
        dueDate: Date;
        createdById: string;
    }>;
    submitAssignment(assignmentId: string, file: any, req: any): Promise<{
        student: {
            id: string;
            email: string;
            name: string | null;
        };
    } & {
        grade: number | null;
        id: string;
        updatedAt: Date;
        studentId: string;
        status: import(".prisma/client").$Enums.AssignmentStatus;
        filePath: string;
        assignmentId: string;
        submittedAt: Date;
        feedback: string | null;
    }>;
    gradeSubmission(submissionId: string, body: {
        grade: number;
        feedback?: string;
    }): Promise<{
        grade: number | null;
        id: string;
        updatedAt: Date;
        studentId: string;
        status: import(".prisma/client").$Enums.AssignmentStatus;
        filePath: string;
        assignmentId: string;
        submittedAt: Date;
        feedback: string | null;
    }>;
    deleteAssignment(assignmentId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        classId: string;
        description: string | null;
        maxScore: number;
        status: import(".prisma/client").$Enums.AssignmentStatus;
        title: string;
        filePath: string | null;
        dueDate: Date;
        createdById: string;
    }>;
}
