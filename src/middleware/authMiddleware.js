const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'jalaram_estate_jwt_access_secret_key_2026_change_me';

const protect = (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token missing.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verification error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired.',
        errors: {
          name: 'TokenExpiredError',
          message: 'Access token expired.'
        }
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Not authorized, token invalid.',
      errors: {
        name: 'JsonWebTokenError',
        message: 'Invalid access token.'
      }
    });
  }
};

module.exports = { protect };
