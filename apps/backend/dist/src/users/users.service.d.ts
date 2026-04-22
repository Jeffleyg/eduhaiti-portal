import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../common/services/email.service";
import { CreateStudentDto } from "./dto/create-student.dto";
import { CreateTeacherDto } from "./dto/create-teacher.dto";
export declare class UsersService {
    private readonly prisma;
    private readonly emailService;
    constructor(prisma: PrismaService, emailService: EmailService);
    findById(userId: string): import(".prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        email: string;
        name: string | null;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    private generateEnrollmentNumber;
    private generateTempPassword;
    createStudent(payload: CreateStudentDto): Promise<{
        id: string;
        email: string;
        enrollmentNumber: string | null;
        name: string | null;
        role: import(".prisma/client").$Enums.Role;
    }>;
    createTeacher(payload: CreateTeacherDto): Promise<{
        id: string;
        email: string;
        enrollmentNumber: string | null;
        name: string | null;
        role: import(".prisma/client").$Enums.Role;
    }>;
    resendTempPassword(email: string): Promise<{
        success: boolean;
        email: string;
        expiresAt: Date;
    }>;
    findAllStudents(): Promise<{
        id: string;
        email: string;
        enrollmentNumber: string | null;
        name: string | null;
        firstName: string | null;
        lastName: string | null;
        isActive: boolean;
        createdAt: Date;
        classesAttending: {
            id: string;
            name: string;
            level: string;
        }[];
    }[]>;
    findAllTeachers(): Promise<{
        id: string;
        email: string;
        enrollmentNumber: string | null;
        name: string | null;
        firstName: string | null;
        lastName: string | null;
        subjects: string[];
        isActive: boolean;
        createdAt: Date;
        classesTeaching: {
            id: string;
            name: string;
            level: string;
        }[];
    }[]>;
}
