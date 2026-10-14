// Central error handler — must be the LAST middleware registered
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    engine: err.engine,
    isAvailabilityError: err.isAvailabilityError,
    onlineError: err.onlineError,
    offlineError: err.offlineError,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
