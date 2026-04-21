import { UsersService } from "./users.service";
import { CreateStudentDto } from "./dto/create-student.dto";
import { CreateTeacherDto } from "./dto/create-teacher.dto";
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
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
    createStudent(body: CreateStudentDto): Promise<{
        id: string;
        email: string;
        enrollmentNumber: string | null;
        name: string | null;
        role: import(".prisma/client").$Enums.Role;
    }>;
    createTeacher(body: CreateTeacherDto): Promise<{
        id: string;
        email: string;
        enrollmentNumber: string | null;
        name: string | null;
        role: import(".prisma/client").$Enums.Role;
    }>;
}
