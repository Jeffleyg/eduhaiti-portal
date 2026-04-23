import { PrismaService } from "../prisma/prisma.service";
export declare class ResourcesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(classId: string, title: string, description: string | undefined, filePath: string, fileType: string, uploadedById: string): Promise<{
        uploadedBy: {
            id: string;
            email: string;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        classId: string;
        title: string;
        filePath: string;
        fileType: string;
        uploadedById: string;
    }>;
    findByClass(classId: string): Promise<({
        uploadedBy: {
            id: string;
            email: string;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        classId: string;
        title: string;
        filePath: string;
        fileType: string;
        uploadedById: string;
    })[]>;
    findLibraryBySeries(seriesId: string): Promise<({
        class: {
            id: string;
            name: string;
            seriesId: string;
            level: string;
        };
        uploadedBy: {
            id: string;
            email: string;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        classId: string;
        title: string;
        filePath: string;
        fileType: string;
        uploadedById: string;
    })[]>;
    findLibraryBySchool(schoolId: string): Promise<({
        class: {
            id: string;
            name: string;
            academicYear: {
                id: string;
                year: string;
                schoolId: string;
            };
            seriesId: string;
            level: string;
        };
        uploadedBy: {
            id: string;
            email: string;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        classId: string;
        title: string;
        filePath: string;
        fileType: string;
        uploadedById: string;
    })[]>;
    findById(resourceId: string): Promise<({
        uploadedBy: {
            id: string;
            email: string;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        classId: string;
        title: string;
        filePath: string;
        fileType: string;
        uploadedById: string;
    }) | null>;
    delete(resourceId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        classId: string;
        title: string;
        filePath: string;
        fileType: string;
        uploadedById: string;
    }>;
}
