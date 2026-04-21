import { AttendanceService } from "./attendance.service";
import { AttendanceStatus } from "@prisma/client";
export declare class AttendanceController {
    private readonly attendanceService;
    constructor(attendanceService: AttendanceService);
    markAttendance(payload: {
        studentId: string;
        classId: string;
        date: Date;
        status: AttendanceStatus;
        remarks?: string;
    }): Promise<{
        class: {
            id: string;
            name: string;
        };
        student: {
            id: string;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        classId: string;
        studentId: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        remarks: string | null;
    }>;
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
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        classId: string;
        studentId: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        remarks: string | null;
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
            email: string;
            enrollmentNumber: string | null;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        classId: string;
        studentId: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        remarks: string | null;
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
            email: string;
            name: string | null;
        };
    }[]>;
}
