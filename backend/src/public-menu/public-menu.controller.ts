import { ApiTags } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';
import { PublicMenuService } from './public-menu.service';

// No @UseGuards on purpose — this controller backs the public marketing
// landing page and must be reachable without a JWT.
@ApiTags('public-menu')
@Controller('public')
export class PublicMenuController {
  constructor(private readonly publicMenuService: PublicMenuService) {}

  @Get('pizzas')
  listPizzas() {
    return this.publicMenuService.listPizzas();
  }

  @Get('branches')
  listBranches() {
    return this.publicMenuService.listBranches();
  }
}
