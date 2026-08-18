import { ApiTags } from '@nestjs/swagger';
import { BadRequestException, Controller, Inject, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { STORAGE_PORT, type StoragePort } from './storage.port';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(@Inject(STORAGE_PORT) private readonly storagePort: StoragePort) {}

  @Post('upload')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');

    return this.storagePort.uploadProductImage({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
  }
}
