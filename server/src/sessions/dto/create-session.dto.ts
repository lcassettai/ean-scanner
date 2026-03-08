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

export class JoinSessionDto {
  accessCode: string;
}

export class ExtendSessionDto {
  accessCode: string;
}

export class UpdateScanDto {
  accessCode: string;
  ean: string;
  quantity?: number;
  internalCode?: string | null;
  productName?: string | null;
  price?: number | null;
  observations?: string | null;
}
