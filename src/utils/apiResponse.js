export const success = (res, data, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({ success: true, statusCode, message, data });

export const failure = (res, message, statusCode = 400, data = null) =>
  res.status(statusCode).json({ success: false, statusCode, message, data });
