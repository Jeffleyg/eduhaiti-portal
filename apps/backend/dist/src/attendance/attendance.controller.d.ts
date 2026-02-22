import { AttendanceService } from "./attendance.service";
export declare class AttendanceController {
    private readonly attendanceService;
    constructor(attendanceService: AttendanceService);
    getMyAttendance(req: {
        user?: {
            sub?: string;
        };
    }): Promise<({
        class: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            level: string;
            teacherId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        studentId: string;
        classId: string;
        status: string;
        date: Date;
    })[]>;
    getClassAttendance(req: {
        user?: {
            sub?: string;
        };
    }, classId: string): Promise<({
        student: {
            id: string;
            email: string;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        studentId: string;
        classId: string;
        status: string;
        date: Date;
    })[]>;
    markAttendance(body: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        studentId: string;
        classId: string;
        status: string;
        date: Date;
    }>;
}
