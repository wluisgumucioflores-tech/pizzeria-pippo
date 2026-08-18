import { ConflictException } from '@nestjs/common';

export class CategoryHasProductsException extends ConflictException {
  constructor(message: string) {
    super({ message });
  }
}
