export class ScanItemDto {
  ean: string;
  quantity: number;
  internalCode?: string;
  productName?: string;
  price?: number;
  observations?: string;
}

export class CreateSessionDto {
  name: string;
  type?: string;
  askQuantity?: boolean;
  askInternalCode?: boolean;
  askProductName?: boolean;
  askPrice?: boolean;
  scans: ScanItemDto[];
}

export class AddScansDto {
  scans: ScanItemDto[];
}
