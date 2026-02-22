import { ResourcesService } from "./resources.service";
export declare class ResourcesController {
    private readonly resourcesService;
    constructor(resourcesService: ResourcesService);
    getByClass(classId: string): Promise<({
        uploadedBy: {
            id: string;
            email: string;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        classId: string;
        title: string;
        description: string | null;
        filePath: string;
        fileType: string;
        uploadedById: string;
    })[]>;
    uploadResource(classId: string, file: any, body: {
        title: string;
        description?: string;
    }, req: any): Promise<{
        uploadedBy: {
            id: string;
            email: string;
            name: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        classId: string;
        title: string;
        description: string | null;
        filePath: string;
        fileType: string;
        uploadedById: string;
    }>;
    deleteResource(resourceId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        classId: string;
        title: string;
        description: string | null;
        filePath: string;
        fileType: string;
        uploadedById: string;
    }>;
}
