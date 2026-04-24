import { AttendanceService } from "./attendance.service";
import { Role, AttendanceStatus } from "@prisma/client";
export declare class AttendanceController {
    private readonly attendanceService;
    constructor(attendanceService: AttendanceService);
    markAttendance(req: {
        user?: {
            sub?: string;
            role?: Role;
        };
    }, payload: {
        studentId: string;
        classId: string;
        date: Date;
        status: AttendanceStatus;
        remarks?: string;
    }): Promise<any>;
    deleteAttendance(attendanceId: string): Promise<{
        message: string;
    }>;
    getMyAttendance(req: {
        user?: {
            sub?: string;
        };
    }, startDate?: string, endDate?: string): Promise<({
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
    getMyStats(req: {
        user?: {
            sub?: string;
        };
    }, classId: string): Promise<{
        absencePercentage: number;
        isAtRisk: boolean;
        total: number;
        present: number;
        absent: number;
        late: number;
        excused: number;
    }>;
    getClassAttendance(classId: string, date?: string): Promise<({
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
    getClassReport(classId: string): Promise<{
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
}
