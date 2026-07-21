import * as Joi from 'joi';

export const environmentValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number().port().default(3001),

  DATABASE_URL: Joi.string().required(),

  BETTER_AUTH_SECRET: Joi.string().min(32).required(),

  BETTER_AUTH_BASE_URL: Joi.string().uri().default('http://localhost:3001'),

  BETTER_AUTH_JWKS_URL: Joi.string()
    .uri()
    .default('http://localhost:3001/api/auth/jwks'),

  AUTH_TRUSTED_ORIGINS: Joi.string().default('http://localhost:3000'),
});
