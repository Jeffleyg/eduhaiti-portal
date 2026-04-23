import { ClassesService } from "./classes.service";
export declare class ClassesController {
    private readonly classesService;
    constructor(classesService: ClassesService);
    createClass(payload: {
        name: string;
        level?: string;
        academicYearId: string;
        seriesId: string;
        teacherId?: string;
        maxStudents?: number;
    }): Promise<{
        series: {
            id: string;
            name: string;
        };
        teacher: {
            id: string;
            email: string;
            name: string | null;
        } | null;
        students: {
            id: string;
            name: string | null;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        academicYearId: string;
        seriesId: string;
        level: string;
        teacherId: string | null;
        maxStudents: number;
    }>;
    updateClass(classId: string, payload: {
        name?: string;
        teacherId?: string;
        maxStudents?: number;
    }): Promise<{
        teacher: {
            id: string;
            email: string;
            name: string | null;
        } | null;
        students: {
            id: string;
            name: string | null;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        academicYearId: string;
        seriesId: string;
        level: string;
        teacherId: string | null;
        maxStudents: number;
    }>;
    deleteClass(classId: string): Promise<{
        message: string;
    }>;
    enrollStudent(classId: string, payload: {
        studentId: string;
    }): Promise<{
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
        academicYearId: string;
        seriesId: string;
        level: string;
        teacherId: string | null;
        maxStudents: number;
    }>;
    removeStudent(classId: string, studentId: string): Promise<{
        students: {
            id: string;
            name: string | null;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        academicYearId: string;
        seriesId: string;
        level: string;
        teacherId: string | null;
        maxStudents: number;
    }>;
    getAllClasses(academicYearId?: string, seriesId?: string): Promise<({
        series: {
            id: string;
            name: string;
        };
        academicYear: {
            year: string;
        };
        teacher: {
            id: string;
            email: string;
            name: string | null;
        } | null;
        students: {
            id: string;
            name: string | null;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        academicYearId: string;
        seriesId: string;
        level: string;
        teacherId: string | null;
        maxStudents: number;
    })[]>;
    getAcademicYears(): Promise<{
        id: string;
        isActive: boolean;
        year: string;
        startDate: Date;
        endDate: Date;
    }[]>;
    getSeries(academicYearId?: string): Promise<{
        id: string;
        name: string;
        academicYear: {
            id: string;
            year: string;
        };
        academicYearId: string;
    }[]>;
    getMyClasses(req: {
        user?: {
            sub?: string;
            role?: string;
        };
    }): Promise<({
        series: {
            id: string;
            name: string;
        };
        academicYear: {
            id: string;
            year: string;
        };
        teacher: {
            id: string;
            name: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        academicYearId: string;
        seriesId: string;
        level: string;
        teacherId: string | null;
        maxStudents: number;
    })[]>;
    getClass(classId: string): Promise<{
        grades: {
            id: string;
            studentId: string;
            disciplineId: string;
            score: number;
        }[];
        series: {
            id: string;
            name: string;
        };
        teacher: {
            id: string;
            email: string;
            name: string | null;
        } | null;
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
        academicYearId: string;
        seriesId: string;
        level: string;
        teacherId: string | null;
        maxStudents: number;
    }>;
}
