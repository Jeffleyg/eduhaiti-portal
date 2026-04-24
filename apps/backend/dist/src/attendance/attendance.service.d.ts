import { PrismaService } from "../prisma/prisma.service";
import { AttendanceStatus, Role } from "@prisma/client";
export declare class AttendanceService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private buildAttendanceFamilyNotice;
    markAttendance(payload: {
        studentId: string;
        classId: string;
        date: Date;
        status: AttendanceStatus;
        remarks?: string;
    }, requester?: {
        id: string;
        role: Role;
    }): Promise<any>;
    findByStudent(studentId: string, startDate?: Date, endDate?: Date): Promise<({
        class: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        studentId: string;
        classId: string;
        date: Date;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        remarks: string | null;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    findByClass(classId: string, date?: Date): Promise<({
        student: {
            id: string;
            name: string | null;
            email: string;
            enrollmentNumber: string | null;
        };
    } & {
        id: string;
        studentId: string;
        classId: string;
        date: Date;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        remarks: string | null;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    getStudentAttendanceStats(studentId: string, classId: string): Promise<{
        absencePercentage: number;
        isAtRisk: boolean;
        total: number;
        present: number;
        absent: number;
        late: number;
        excused: number;
    }>;
    getClassAttendanceReport(classId: string): Promise<{
        absencePercentage: number;
        isAtRisk: boolean;
        total: number;
        present: number;
        absent: number;
        late: number;
        excused: number;
        student: {
            id: string;
            name: string | null;
            email: string;
        };
    }[]>;
    delete(attendanceId: string): Promise<{
        message: string;
    }>;
}
