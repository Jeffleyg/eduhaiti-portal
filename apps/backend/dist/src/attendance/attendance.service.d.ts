import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus, Role } from '@prisma/client';
import { HybridOutboundSmsService } from '../hybrid-gateway/services/hybrid-outbound-sms.service';
export declare class AttendanceService {
    private readonly prisma;
    private readonly hybridOutboundSms;
    private readonly logger;
    constructor(prisma: PrismaService, hybridOutboundSms: HybridOutboundSmsService);
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
    private notifyGuardiansAboutAbsence;
    private to160Chars;
    findByStudent(studentId: string, startDate?: Date, endDate?: Date): Promise<({
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
    findByClass(classId: string, date?: Date): Promise<({
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
            email: string;
            name: string | null;
        };
    }[]>;
    delete(attendanceId: string): Promise<{
        message: string;
    }>;
}
