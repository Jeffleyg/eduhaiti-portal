import { PrismaService } from '../prisma/prisma.service';
export declare class AssignmentsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(classId: string, title: string, description: string | undefined, dueDate: Date, filePath: string | undefined, createdById: string): Promise<{
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
    findByClass(classId: string): Promise<({
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
    findById(assignmentId: string): Promise<({
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
    }) | null>;
    findForStudent(studentId: string): Promise<({
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
    submitAssignment(assignmentId: string, studentId: string, filePath: string): Promise<{
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
    update(assignmentId: string, title: string, description: string | undefined, dueDate: Date): Promise<{
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
    gradeSubmission(submissionId: string, grade: number, feedback: string | undefined): Promise<{
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
    delete(assignmentId: string): Promise<{
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
