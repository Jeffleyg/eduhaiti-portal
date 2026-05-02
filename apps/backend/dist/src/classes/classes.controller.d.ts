import { ClassesService } from './classes.service';
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
        level: string;
        academicYearId: string;
        seriesId: string;
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
        level: string;
        academicYearId: string;
        seriesId: string;
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
        level: string;
        academicYearId: string;
        seriesId: string;
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
        level: string;
        academicYearId: string;
        seriesId: string;
        teacherId: string | null;
        maxStudents: number;
    }>;
    getAllClasses(academicYearId?: string, seriesId?: string): Promise<({
        academicYear: {
            year: string;
        };
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
        level: string;
        academicYearId: string;
        seriesId: string;
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
        academicYear: {
            id: string;
            year: string;
        };
        id: string;
        name: string;
        academicYearId: string;
    }[]>;
    getMyClasses(req: {
        user?: {
            sub?: string;
            role?: string;
        };
    }): Promise<({
        academicYear: {
            id: string;
            year: string;
        };
        series: {
            id: string;
            name: string;
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
        level: string;
        academicYearId: string;
        seriesId: string;
        teacherId: string | null;
        maxStudents: number;
    })[]>;
    getClass(classId: string): Promise<{
        series: {
            id: string;
            name: string;
        };
        grades: {
            id: string;
            studentId: string;
            disciplineId: string;
            score: number;
        }[];
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
        level: string;
        academicYearId: string;
        seriesId: string;
        teacherId: string | null;
        maxStudents: number;
    }>;
}
