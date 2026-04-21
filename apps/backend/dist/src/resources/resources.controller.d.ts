import { ResourcesService } from "./resources.service";
import { AssetOptimizationService } from "../content-delivery/services/asset-optimization.service";
export declare class ResourcesController {
    private readonly resourcesService;
    private readonly assetOptimizationService;
    constructor(resourcesService: ResourcesService, assetOptimizationService: AssetOptimizationService);
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
        description: string | null;
        classId: string;
        title: string;
        filePath: string;
        fileType: string;
        uploadedById: string;
    })[]>;
    uploadResource(classId: string, file: any, body: {
        title: string;
        description?: string;
    }, req: any): Promise<{
        optimization: {
            contentHash: string;
            sizeBytes: number;
        };
        uploadedBy: {
            id: string;
            email: string;
            name: string | null;
        };
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
    deleteResource(resourceId: string): Promise<{
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
