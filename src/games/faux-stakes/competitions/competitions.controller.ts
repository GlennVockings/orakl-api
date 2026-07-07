import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Get,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { GamesService } from './competitions.service';
import { CreateGameDto } from './dto/create-competition.dto';
import { BetterAuthJwtGuard } from '../../../platform/auth/better-auth-jwt.guard';
import { getUserIdFromJwtPayload } from '../../../platform/auth/auth-user';
import { JoinGameDto } from './dto/join-competition.dto';
import { GameAccessService } from './competitions-access.service';

@Controller('games')
export class GamesController {
  constructor(
    private games: GamesService,
    private gameAccess: GameAccessService,
  ) {}

  @UseGuards(BetterAuthJwtGuard)
  @Post('/create')
  async create(@Req() req: { user: string }, @Body() body: CreateGameDto) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.games.createGame(userId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get()
  async getAll(@Req() req: { user: string }) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.games.getAll(userId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Post('/join')
  async joinGame(@Req() req: { user: string }, @Body() body: JoinGameDto) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.games.joinGame(userId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get(':gameId')
  async getGame(@Req() req: { user: string }, @Param('gameId') gameId: string) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.games.getGame(userId, gameId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Patch(':gameId/seen')
  async markSeen(
    @Req() req: { user: string },
    @Param('gameId') gameId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.games.markSeen(userId, gameId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Delete(':gameId')
  async deleteGame(
    @Req() req: { user: string },
    @Param('gameId') gameId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.gameAccess.requireGameAdmin(userId, gameId);
    return this.games.deleteGame(userId, gameId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get(':gameId/me')
  async getMe(@Req() req: { user: string }, @Param('gameId') gameId: string) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.games.getMe(userId, gameId);
  }
}
