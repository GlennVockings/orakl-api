import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CompetitionAccessService } from '../competition-access.service';

type AuthenticatedRequest = {
  user?: {
    id?: string;
  };
  params: {
    competitionId?: string;
  };
};

@Injectable()
export class CompetitionMemberGuard implements CanActivate {
  constructor(private readonly competitionAccess: CompetitionAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const userId = request.user?.id;
    const competitionId = request.params.competitionId;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user was not found');
    }

    if (!competitionId) {
      throw new BadRequestException('Competition ID was not provided');
    }

    await this.competitionAccess.requireCompetitionMember(
      userId,
      competitionId,
    );

    return true;
  }
}
