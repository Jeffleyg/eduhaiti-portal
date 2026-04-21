import { PrismaService } from "../prisma/prisma.service";
export declare class ClassesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(payload: {
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
    update(classId: string, payload: {
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
    delete(classId: string): Promise<{
        message: string;
    }>;
    enrollStudent(classId: string, studentId: string): Promise<{
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
    findByTeacher(teacherId: string): Promise<({
        series: {
            id: string;
            name: string;
        };
        teacher: {
            id: string;
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
    })[]>;
    findAll(academicYearId?: string, seriesId?: string): Promise<({
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
    findById(classId: string): Promise<{
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
    findByStudent(studentId: string): Promise<({
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
        academicYearId: string;
        seriesId: string;
        level: string;
        teacherId: string | null;
        maxStudents: number;
    })[]>;
    listAcademicYears(): Promise<{
        id: string;
        isActive: boolean;
        year: string;
        startDate: Date;
        endDate: Date;
    }[]>;
    listSeries(academicYearId?: string): Promise<{
        id: string;
        name: string;
        academicYear: {
            id: string;
            year: string;
        };
        academicYearId: string;
    }[]>;
}
