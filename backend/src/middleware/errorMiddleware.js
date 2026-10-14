// Central error handler — must be the LAST middleware registered
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || (res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || 'Internal server error';

  // Handle Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `An account with this ${field} already exists.`;
  }

  // Handle Mongoose CastError (bad ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((val) => val.message).join(', ');
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.engine !== undefined && { engine: err.engine }),
    ...(err.isAvailabilityError !== undefined && { isAvailabilityError: err.isAvailabilityError }),
    ...(err.onlineError !== undefined && { onlineError: err.onlineError }),
    ...(err.offlineError !== undefined && { offlineError: err.offlineError }),
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
