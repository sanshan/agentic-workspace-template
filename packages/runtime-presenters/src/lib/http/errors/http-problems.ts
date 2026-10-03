import { HttpStatus } from '@nestjs/common';

import { defineHttpProblem } from './problem-details.js';

export const INTERNAL_HTTP_PROBLEM = defineHttpProblem(
    'internal-error',
    HttpStatus.INTERNAL_SERVER_ERROR,
    'Internal Server Error',
);

export const INVALID_REQUEST_HTTP_PROBLEM = defineHttpProblem(
    'invalid-request',
    HttpStatus.BAD_REQUEST,
    'Invalid Request',
);

export const UNAUTHORIZED_HTTP_PROBLEM = defineHttpProblem(
    'unauthorized',
    HttpStatus.UNAUTHORIZED,
    'Unauthorized',
);

export const FORBIDDEN_HTTP_PROBLEM = defineHttpProblem(
    'forbidden',
    HttpStatus.FORBIDDEN,
    'Forbidden',
);

export const NOT_FOUND_HTTP_PROBLEM = defineHttpProblem(
    'not-found',
    HttpStatus.NOT_FOUND,
    'Not Found',
);

export const CONFLICT_HTTP_PROBLEM = defineHttpProblem(
    'conflict',
    HttpStatus.CONFLICT,
    'Conflict',
);

export const PAYLOAD_TOO_LARGE_HTTP_PROBLEM = defineHttpProblem(
    'payload-too-large',
    HttpStatus.PAYLOAD_TOO_LARGE,
    'Payload Too Large',
);

export const UNSUPPORTED_MEDIA_TYPE_HTTP_PROBLEM = defineHttpProblem(
    'unsupported-media-type',
    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    'Unsupported Media Type',
);

export const UNPROCESSABLE_ENTITY_HTTP_PROBLEM = defineHttpProblem(
    'unprocessable-entity',
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Unprocessable Entity',
);

export const TOO_MANY_REQUESTS_HTTP_PROBLEM = defineHttpProblem(
    'too-many-requests',
    HttpStatus.TOO_MANY_REQUESTS,
    'Too Many Requests',
);

export const SERVICE_UNAVAILABLE_HTTP_PROBLEM = defineHttpProblem(
    'service-unavailable',
    HttpStatus.SERVICE_UNAVAILABLE,
    'Service Unavailable',
);
