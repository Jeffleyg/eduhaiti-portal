import { ClassesService } from "./classes.service";
export declare class ClassesController {
    private readonly classesService;
    constructor(classesService: ClassesService);
    getMyClasses(req: {
        user?: {
            sub?: string;
            role?: string;
        };
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        level: string;
        teacherId: string;
    }[]>;
    getClass(classId: string): Promise<({
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
    getAllClasses(): Promise<({
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
}
