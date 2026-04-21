import { Gender } from "@prisma/client";
export declare class CreateStudentDto {
    email: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    address: string;
    gender: Gender;
    fatherName?: string;
    motherName?: string;
    classId?: string;
}
