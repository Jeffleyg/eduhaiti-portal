import { UsersService } from "./users.service";
import { CreateStudentDto } from "./dto/create-student.dto";
import { CreateTeacherDto } from "./dto/create-teacher.dto";
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
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
