const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {

  const authHeader = req.header('Authorization');

  if (!authHeader) {
    return res.status(401).json({ message: 'Нет токена, авторизация отклонена' });
  }

  try {

    const token = authHeader.split(' ')[1]; 
    
    if (!token) {
      return res.status(401).json({ message: 'Некорректный формат токена' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = decoded; 
    
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    res.status(401).json({ message: 'Токен не валиден или просрочен' });
  }
};