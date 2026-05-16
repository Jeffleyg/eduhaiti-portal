import { UsersService } from './users.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { ResendTempPasswordDto } from './dto/resend-temp-password.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAllStudents(req: {
        user?: {
            schoolId?: string;
        };
    }): Promise<{
        id: string;
        email: string;
        enrollmentNumber: string | null;
        name: string | null;
        firstName: string | null;
        lastName: string | null;
        fatherName: string | null;
        motherName: string | null;
        isActive: boolean;
        createdAt: Date;
        classesAttending: {
            id: string;
            name: string;
            level: string;
        }[];
    }[]>;
    findAllTeachers(req: {
        user?: {
            schoolId?: string;
        };
    }): Promise<{
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
    createStudent(req: {
        user?: {
            schoolId?: string;
        };
    }, body: CreateStudentDto): Promise<{
        id: string;
        email: string;
        enrollmentNumber: string | null;
        name: string | null;
        role: import(".prisma/client").$Enums.Role;
    }>;
    createTeacher(req: {
        user?: {
            schoolId?: string;
        };
    }, body: CreateTeacherDto): Promise<{
        id: string;
        email: string;
        enrollmentNumber: string | null;
        name: string | null;
        role: import(".prisma/client").$Enums.Role;
    }>;
    resendTempPassword(body: ResendTempPasswordDto): Promise<{
        success: boolean;
        email: string;
        expiresAt: Date;
    }>;
}
