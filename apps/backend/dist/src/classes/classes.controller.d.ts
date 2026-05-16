import { ClassesService } from './classes.service';
export declare class ClassesController {
    private readonly classesService;
    constructor(classesService: ClassesService);
    createClass(req: {
        user?: {
            schoolId?: string;
        };
    }, payload: {
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
    updateClass(req: {
        user?: {
            schoolId?: string;
        };
    }, classId: string, payload: {
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
    deleteClass(req: {
        user?: {
            schoolId?: string;
        };
    }, classId: string): Promise<{
        message: string;
    }>;
    enrollStudent(req: {
        user?: {
            schoolId?: string;
        };
    }, classId: string, payload: {
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
    removeStudent(req: {
        user?: {
            schoolId?: string;
        };
    }, classId: string, studentId: string): Promise<{
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
    getAllClasses(req: {
        user?: {
            schoolId?: string;
        };
    }, academicYearId?: string, seriesId?: string): Promise<({
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
    getAcademicYears(req: {
        user?: {
            schoolId?: string;
        };
    }): Promise<{
        id: string;
        isActive: boolean;
        year: string;
        startDate: Date;
        endDate: Date;
    }[]>;
    getSeries(req: {
        user?: {
            schoolId?: string;
        };
    }, academicYearId?: string): Promise<{
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
            schoolId?: string;
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
    getClass(req: {
        user?: {
            schoolId?: string;
        };
    }, classId: string): Promise<{
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
        academicYear: {
            id: string;
            schoolId: string;
            year: string;
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
