jest.mock('../../../platform/auth/jwt-verifier.service', () => ({
  JwtVerifierService: class JwtVerifierService {},
}));

import { UnauthorizedException } from '@nestjs/common';
import { GameType } from '@prisma/client';
import { WsException } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { JwtVerifierService } from '../../../platform/auth/jwt-verifier.service';
import { CompetitionAccessService } from '../../../platform/competitions/competition-access.service';
import { WsGateway } from './ws.gateway';

type Middleware = (socket: Socket, next: (error?: Error) => void) => void;

function createSocket(options?: {
  auth?: Record<string, unknown>;
  authorization?: string;
  userId?: string;
}) {
  const join = jest.fn().mockResolvedValue(undefined);

  const socket = {
    id: 'socket-1',

    handshake: {
      auth: options?.auth ?? {},
      headers: {
        authorization: options?.authorization,
      },
    },

    data: {
      userId: options?.userId,
    },

    join,
  } as unknown as Socket;

  return {
    socket,
    join,
  };
}

describe('WsGateway', () => {
  const verify = jest.fn();
  const requireGameCompetition = jest.fn();

  const jwtVerifier = {
    verify,
  } as unknown as JwtVerifierService;

  const competitionAccess = {
    requireGameCompetition,
  } as unknown as CompetitionAccessService;

  let gateway: WsGateway;
  let middleware: Middleware;

  beforeEach(() => {
    jest.clearAllMocks();

    gateway = new WsGateway(jwtVerifier, competitionAccess);

    const use = jest.fn((handler: Middleware) => {
      middleware = handler;
    });

    gateway.afterInit({
      use,
    } as unknown as Server);

    expect(use).toHaveBeenCalledTimes(1);
  });

  describe('connection authentication', () => {
    it('rejects a socket with no token', () => {
      const { socket } = createSocket();

      let receivedError: Error | undefined;

      const next = (error?: Error) => {
        receivedError = error;
      };

      middleware(socket, next);

      expect(receivedError).toBeInstanceOf(Error);
      expect(receivedError?.message).toBe('Authentication required');

      expect(verify).not.toHaveBeenCalled();
    });

    it('rejects an invalid JWT without exposing verifier details', async () => {
      const { socket } = createSocket({
        auth: {
          token: 'invalid-token',
        },
      });

      verify.mockRejectedValue(
        new UnauthorizedException('Detailed JWT failure'),
      );

      let receivedError: Error | undefined;

      const next = (error?: Error) => {
        receivedError = error;
      };

      middleware(socket, next);

      await Promise.resolve();
      await Promise.resolve();

      expect(verify).toHaveBeenCalledWith('invalid-token');

      expect(receivedError).toBeInstanceOf(Error);
      expect(receivedError?.message).toBe('Authentication failed');
    });

    it('accepts a valid JWT supplied through the Socket.IO auth handshake', async () => {
      const { socket } = createSocket({
        auth: {
          token: 'valid-token',
        },
      });

      verify.mockResolvedValue({
        id: 'user-1',
      });

      let receivedError: Error | undefined;
      let nextCalled = false;

      const next = (error?: Error) => {
        nextCalled = true;
        receivedError = error;
      };

      middleware(socket, next);

      await Promise.resolve();
      await Promise.resolve();

      expect(verify).toHaveBeenCalledWith('valid-token');

      expect(
        (socket as unknown as { data: { userId?: string } }).data.userId,
      ).toBe('user-1');

      expect(nextCalled).toBe(true);
      expect(receivedError).toBeUndefined();
    });

    it('accepts a Bearer token from the Authorization header', async () => {
      const { socket } = createSocket({
        authorization: 'Bearer header-token',
      });

      verify.mockResolvedValue({
        id: 'user-2',
      });

      let receivedError: Error | undefined;
      let nextCalled = false;

      const next = (error?: Error) => {
        nextCalled = true;
        receivedError = error;
      };

      middleware(socket, next);

      await Promise.resolve();
      await Promise.resolve();

      expect(verify).toHaveBeenCalledWith('header-token');

      expect(
        (socket as unknown as { data: { userId?: string } }).data.userId,
      ).toBe('user-2');

      expect(nextCalled).toBe(true);
      expect(receivedError).toBeUndefined();
    });
  });

  describe('join_competition_room', () => {
    it('rejects room access when the socket has no authenticated user', async () => {
      const { socket, join } = createSocket();

      await expect(
        gateway.handleJoinCompetitionRoom(
          {
            competitionId: 'competition-1',
          },
          socket as never,
        ),
      ).rejects.toThrow(WsException);

      await expect(
        gateway.handleJoinCompetitionRoom(
          {
            competitionId: 'competition-1',
          },
          socket as never,
        ),
      ).rejects.toThrow('Authentication required');

      expect(requireGameCompetition).not.toHaveBeenCalled();
      expect(join).not.toHaveBeenCalled();
    });

    it('rejects an empty competition id', async () => {
      const { socket, join } = createSocket({
        userId: 'user-1',
      });

      await expect(
        gateway.handleJoinCompetitionRoom(
          {
            competitionId: '',
          },
          socket as never,
        ),
      ).rejects.toThrow('A competitionId is required');

      expect(requireGameCompetition).not.toHaveBeenCalled();
      expect(join).not.toHaveBeenCalled();
    });

    it('rejects an authenticated non-member without revealing whether the competition exists', async () => {
      const { socket, join } = createSocket({
        userId: 'user-1',
      });

      requireGameCompetition.mockRejectedValue(new Error('Not a member'));

      await expect(
        gateway.handleJoinCompetitionRoom(
          {
            competitionId: 'competition-1',
          },
          socket as never,
        ),
      ).rejects.toThrow('Competition is unavailable');

      expect(requireGameCompetition).toHaveBeenCalledWith(
        'user-1',
        'competition-1',
        GameType.FAUX_STAKES,
      );

      expect(join).not.toHaveBeenCalled();
    });

    it('rejects a member of the wrong game type with the same generic response', async () => {
      const { socket, join } = createSocket({
        userId: 'user-1',
      });

      requireGameCompetition.mockRejectedValue(new Error('Wrong game type'));

      await expect(
        gateway.handleJoinCompetitionRoom(
          {
            competitionId: 'predictor-competition',
          },
          socket as never,
        ),
      ).rejects.toThrow('Competition is unavailable');

      expect(requireGameCompetition).toHaveBeenCalledWith(
        'user-1',
        'predictor-competition',
        GameType.FAUX_STAKES,
      );

      expect(join).not.toHaveBeenCalled();
    });

    it('allows an authenticated Faux Stakes member into the competition room', async () => {
      const { socket, join } = createSocket({
        userId: 'user-1',
      });

      requireGameCompetition.mockResolvedValue({
        id: 'membership-1',
        competitionId: 'competition-1',
        userId: 'user-1',
      });

      const result = await gateway.handleJoinCompetitionRoom(
        {
          competitionId: 'competition-1',
        },
        socket as never,
      );

      expect(requireGameCompetition).toHaveBeenCalledWith(
        'user-1',
        'competition-1',
        GameType.FAUX_STAKES,
      );

      expect(join).toHaveBeenCalledWith('competition:competition-1');

      expect(result).toEqual({
        ok: true,
      });
    });
  });
});
