export class ScanItemDto {
  ean: string;
  quantity: number;
  internalCode?: string;
  productName?: string;
  price?: number;
}

export class CreateSessionDto {
  name: string;
  type?: string;
  askInternalCode?: boolean;
  askProductName?: boolean;
  askPrice?: boolean;
  scans: ScanItemDto[];
}

export class AddScansDto {
  scans: ScanItemDto[];
}
