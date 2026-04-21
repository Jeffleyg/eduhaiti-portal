import { Gender } from "@prisma/client";
declare class NewClassDto {
    name: string;
    level?: string;
    academicYearId?: string;
    seriesId?: string;
}
export declare class CreateTeacherDto {
    email: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    address: string;
    gender: Gender;
    fatherName?: string;
    motherName?: string;
    subjects?: string[];
    classIds?: string[];
    newClasses?: NewClassDto[];
}
export {};
