export class ScanItemDto {
  ean: string;
  quantity: number;
}

export class CreateSessionDto {
  name: string;
  type?: string;
  scans: ScanItemDto[];
}

export class AddScansDto {
  scans: ScanItemDto[];
}
