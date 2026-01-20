// Простой тестовый endpoint для проверки работы serverless functions
// Используем CommonJS для совместимости с Vercel
const handler = async (req: any, res: any) => {
  console.log('✅ Test endpoint called');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  
  try {
    return res.status(200).json({ 
      ok: true, 
      message: 'Test endpoint works',
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url
    });
  } catch (error: any) {
    console.error('Test endpoint error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: error?.message 
    });
  }
};

module.exports = handler;

