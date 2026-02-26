export declare class ScanItemDto {
    ean: string;
    quantity: number;
}
export declare class CreateSessionDto {
    name: string;
    type?: string;
    scans: ScanItemDto[];
}
export declare class AddScansDto {
    scans: ScanItemDto[];
}
